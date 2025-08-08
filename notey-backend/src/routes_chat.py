from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
import logging
from uuid import UUID
from pydantic import BaseModel

from .supabase_client import supabase_client
from services.auth import verify_supabase_token, UserContext
from .concept_extractor import extract_concepts_from_transcript
import google.generativeai as genai
import os

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = genai.GenerativeModel('gemini-2.0-flash-exp')

class ChatRequest(BaseModel):
    query: str
    concept: Optional[str] = None

class QuestionRequest(BaseModel):
    question: str
    context_type: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]]
    related_concepts: List[str]

@router.get("/concept/{concept_name}/notes")
async def get_notes_by_concept(
    concept_name: str,
    user_context = Depends(verify_supabase_token)
) -> Dict[str, Any]:
    """
    Retrieve all notes (transcripts, summaries) that mention a specific concept.
    This is used for RAG context building.
    """
    try:
        # 1. Find the concept by name
        concepts = await supabase_client.select(
            table="concepts",
            columns="id,name",
            filters={"name": f"ilike.%{concept_name}%"},
            limit=1,
            user_token=user_context.token
        )
        
        if not concepts:
            return {
                "concept": concept_name,
                "notes": [],
                "events": [],
                "total_mentions": 0
            }
        
        concept_id = concepts[0]["id"]
        
        # 2. Get all chunk_concepts relationships for this concept
        chunk_concepts = await supabase_client.select(
            table="chunk_concepts",
            columns="chunk_id,score,from_sec,to_sec",
            filters={"concept_id": f"eq.{concept_id}"},
            order="score.desc",
            user_token=user_context.token
        )
        
        if not chunk_concepts:
            return {
                "concept": concept_name,
                "notes": [],
                "events": [],
                "total_mentions": 0
            }
        
        # 3. Get detailed info for each chunk
        chunk_ids = [cc["chunk_id"] for cc in chunk_concepts]
        if not chunk_ids:
            return {
                "concept": concept_name,
                "notes": [],
                "events": [],
                "total_mentions": 0
            }
        chunk_filter = {"id": f"in.({','.join(chunk_ids)})"}
        
        chunks = await supabase_client.select(
            table="audio_chunks",
            columns="id,event_id,transcript,summary,start_time,length",
            filters=chunk_filter,
            user_token=user_context.token
        )
        
        # 4. Get event details
        event_ids = list(set([chunk["event_id"] for chunk in chunks]))
        if not event_ids:
            return {
                "concept": concept_name,
                "notes": [],
                "events": [],
                "total_mentions": 0
            }
        event_filter = {"id": f"in.({','.join(event_ids)})"}
        
        events = await supabase_client.select(
            table="events",
            columns="id,title,started_at,ended_at",
            filters=event_filter,
            user_token=user_context.token
        )
        
        # 5. Build comprehensive response
        notes = []
        for chunk in chunks:
            # Find matching chunk_concept for score
            chunk_concept = next(
                (cc for cc in chunk_concepts if cc["chunk_id"] == chunk["id"]), 
                {}
            )
            
            # Find matching event
            event = next(
                (e for e in events if e["id"] == chunk["event_id"]), 
                {}
            )
            
            notes.append({
                "chunk_id": chunk["id"],
                "event_id": chunk["event_id"],
                "event_title": event.get("title", "Untitled"),
                "transcript": chunk.get("transcript", ""),
                "summary": chunk.get("summary", ""),
                "concept_score": chunk_concept.get("score", 1.0),
                "start_time": chunk.get("start_time", 0),
                "duration": chunk.get("length", 0),
                "event_date": event.get("started_at", ""),
                "from_sec": chunk_concept.get("from_sec"),
                "to_sec": chunk_concept.get("to_sec")
            })
        
        # Sort by concept score (highest first)
        notes.sort(key=lambda x: x["concept_score"], reverse=True)
        
        return {
            "concept": concept_name,
            "notes": notes,
            "events": events,
            "total_mentions": len(notes),
            "total_events": len(events)
        }
        
    except Exception as e:
        logger.error(f"Error retrieving notes for concept '{concept_name}': {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve notes for concept: {str(e)}"
        )

@router.post("/ask", response_model=ChatResponse)
async def chat_with_notes(
    request: ChatRequest,
    user_context = Depends(verify_supabase_token)
) -> ChatResponse:
    """
    RAG-based chatbot that can answer questions about user's notes and concepts.
    """
    try:
        query = request.query
        logger.info(f"Processing chat query: {query}")
        
        # 1. If a specific concept is mentioned, get context for that concept
        context_notes = []
        related_concepts = []
        
        if request.concept:
            concept_data = await get_notes_by_concept(request.concept, user_context)
            context_notes = concept_data["notes"]
        else:
            # 2. Extract concepts from the query to find relevant context
            logger.info("Extracting concepts from query...")
            query_concepts = await extract_concepts_from_transcript(query)
            logger.info(f"Found {len(query_concepts)} concepts in query")
            
            # Get context for top concepts from query
            for concept in query_concepts[:3]:  # Top 3 concepts
                try:
                    concept_data = await get_notes_by_concept(concept["name"], user_context)
                    context_notes.extend(concept_data["notes"])
                    related_concepts.append(concept["name"])
                except Exception as e:
                    logger.warning(f"Failed to get notes for concept '{concept['name']}': {e}")
        
        logger.info(f"Found {len(context_notes)} relevant notes")
        
        # 3. Build context string from relevant notes
        context_parts = []
        sources = []
        
        for note in context_notes[:10]:  # Limit to top 10 most relevant notes
            context_parts.append(f"""
Event: {note['event_title']} (Score: {note['concept_score']})
Transcript: {note['transcript']}
Summary: {note['summary']}
---""")
            
            sources.append({
                "event_title": note["event_title"],
                "concept_score": note["concept_score"],
                "chunk_id": note["chunk_id"],
                "event_date": note["event_date"]
            })
        
        context = "\n".join(context_parts)
        
        # 4. Generate response using Gemini with RAG context
        if not context_parts:
            # No relevant context found
            rag_prompt = f"""
You are a helpful assistant for a note-taking app called Notey. The user asked: "{query}"

However, I couldn't find any relevant notes or concepts in their recordings that relate to this question. 

Please respond helpfully, but let them know that you don't have specific notes about this topic, and suggest they might want to record more audio notes about this subject.
"""
        else:
            rag_prompt = f"""
You are a helpful assistant for Notey, a voice note-taking app. Answer the user's question based on their recorded notes and transcripts.

User Question: "{query}"

Relevant Notes and Transcripts:
{context}

Instructions:
- Answer based primarily on the provided notes and transcripts
- Be conversational and helpful
- If the notes don't fully answer the question, say so
- Reference specific events or recordings when relevant
- Keep responses concise but informative
- Don't make up information not in the provided context

Answer:
"""
        
        # Generate response
        logger.info("Generating response with Gemini...")
        response = model.generate_content(rag_prompt)
        answer = response.text.strip()
        logger.info(f"Generated response of length: {len(answer)}")
        
        return ChatResponse(
            answer=answer,
            sources=sources,
            related_concepts=list(set(related_concepts))
        )
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process chat request: {str(e)}"
        )

@router.get("/concepts/search")
async def search_concepts(
    q: str,
    limit: int = 10,
    user_context = Depends(verify_supabase_token)
) -> List[Dict[str, Any]]:
    """
    Search for concepts by name for chatbot suggestions.
    """
    try:
        concepts = await supabase_client.select(
            table="concepts",
            columns="id,name",
            filters={"name": f"ilike.%{q}%"},
            order="name",
            limit=limit,
            user_token=user_context.token
        )
        
        # Get mention counts for each concept
        result = []
        for concept in concepts:
            mentions = await supabase_client.select(
                table="chunk_concepts", 
                columns="id",
                filters={"concept_id": f"eq.{concept['id']}"},
                user_token=user_context.token
            )
            
            result.append({
                "id": concept["id"],
                "name": concept["name"],
                "mention_count": len(mentions)
            })
        
        # Sort by mention count (most mentioned first)
        result.sort(key=lambda x: x["mention_count"], reverse=True)
        
        return result
        
    except Exception as e:
        logger.error(f"Error searching concepts: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to search concepts: {str(e)}"
        )