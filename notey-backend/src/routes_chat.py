from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
import logging
from uuid import UUID
from pydantic import BaseModel
import httpx
import os

from .supabase_client import supabase_client
from services.auth import verify_supabase_token, UserContext
from .concept_extractor import extract_concepts_from_transcript
from .vector_search import get_vector_search_service
import google.generativeai as genai

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
        # 1. Find the concept by name (user-specific)
        concepts = await supabase_client.select(
            table="concepts",
            columns="id,name",
            filters={
                "name": f"ilike.%{concept_name}%",
                "user_id": f"eq.{user_context.user_id}"
            },
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
        
        # 2. Get all chunk_concepts relationships for this concept (user-specific)
        chunk_concepts = await supabase_client.select(
            table="chunk_concepts",
            columns="chunk_id,score,from_sec,to_sec",
            filters={
                "concept_id": f"eq.{concept_id}",
                "user_id": f"eq.{user_context.user_id}"
            },
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
        # Fix Supabase in filter syntax
        chunk_ids_formatted = ','.join([f'"{chunk_id}"' for chunk_id in chunk_ids])
        chunk_filter = {"id": f"in.({chunk_ids_formatted})"}
        
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
        # Fix Supabase in filter syntax
        event_ids_formatted = ','.join([f'"{event_id}"' for event_id in event_ids])
        event_filter = {"id": f"in.({event_ids_formatted})"}
        
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
            # 2. Use semantic search to find relevant concepts and notes
            logger.info("Finding semantically related concepts...")
            
            # Get all user's concepts for semantic search
            all_concepts = await supabase_client.select(
                table="concepts",
                columns="id,name",
                filters={"user_id": f"eq.{user_context.user_id}"},
                user_token=user_context.token
            )
            
            if all_concepts:
                # Use vector search to find related concepts
                vector_service = get_vector_search_service()
                related_concept_results = await vector_service.search_concepts(
                    query=query,
                    concepts=all_concepts,
                    limit=5,
                    threshold=0.5  # Much higher threshold for strict relevance
                )
                
                logger.info(f"Found {len(related_concept_results)} semantically related concepts")
                
                # Get context for top related concepts
                for concept in related_concept_results:
                    try:
                        concept_data = await get_notes_by_concept(concept["name"], user_context)
                        context_notes.extend(concept_data["notes"])
                        related_concepts.append(concept["name"])
                    except Exception as e:
                        logger.warning(f"Failed to get notes for concept '{concept['name']}': {e}")
            
            # 3. Also do semantic search directly on transcripts/notes
            if not context_notes and all_concepts:
                logger.info("Searching transcripts directly with semantic similarity...")
                
                # Get all chunks for semantic search
                all_chunks = await supabase_client.select(
                    table="audio_chunks",
                    columns="id,event_id,transcript,summary,start_time,length",
                    limit=200,  # Limit to avoid memory issues
                    user_token=user_context.token
                )
                
                if all_chunks:
                    # Get event details
                    event_ids = list(set([chunk["event_id"] for chunk in all_chunks]))
                    # Fix Supabase in filter syntax
                    event_ids_formatted = ','.join([f'"{event_id}"' for event_id in event_ids])
                    event_filter = {"id": f"in.({event_ids_formatted})"}
                    events = await supabase_client.select(
                        table="events",
                        columns="id,title,started_at,ended_at",
                        filters=event_filter,
                        user_token=user_context.token
                    )
                    
                    # Create enhanced transcript objects for search
                    transcript_objects = []
                    for chunk in all_chunks:
                        event = next((e for e in events if e["id"] == chunk["event_id"]), {})
                        transcript_objects.append({
                            "chunk_id": chunk["id"],
                            "event_id": chunk["event_id"],
                            "event_title": event.get("title", "Untitled"),
                            "transcript": chunk.get("transcript", ""),
                            "summary": chunk.get("summary", ""),
                            "start_time": chunk.get("start_time", 0),
                            "duration": chunk.get("length", 0),
                            "event_date": event.get("started_at", ""),
                            "concept_score": 0.5  # Default score for direct transcript matches
                        })
                    
                    # Use vector search on transcripts
                    similar_transcripts = await vector_service.search_transcripts(
                        query=query,
                        transcripts=transcript_objects,
                        limit=10,
                        threshold=0.6  # Much higher threshold for direct transcript search
                    )
                    
                    logger.info(f"Found {len(similar_transcripts)} semantically similar transcripts")
                    context_notes.extend(similar_transcripts)
        
        logger.info(f"Found {len(context_notes)} relevant notes")
        
        # 4. Build context from relevant events
        context_parts = []
        sources = []
        
        # Simplified approach: First identify relevant events, then include ALL content from those events
        relevant_events = set()  # Track which events are deemed relevant
        
        # First pass: identify relevant events based on thresholds
        for note in context_notes[:20]:  # Check more candidates
            concept_score = note.get('concept_score', 0)
            similarity_score = note.get('similarity_score', 0)
            event_title = note.get('event_title', 'Unknown')
            event_id = note["event_id"]
            
            # Debug logging
            logger.info(f"DEBUG: {event_title} - concept:{concept_score:.3f}, similarity:{similarity_score:.3f}")
            
            # Simple relevance check
            min_concept_score = 0.4
            min_similarity_score = 0.3
            
            # Special handling for Meet1
            if 'Meet1' in event_title and similarity_score < 0.2:
                logger.info(f"Filtering out Meet1 specifically due to very low similarity")
                continue
            
            # If this note passes the relevance threshold, mark the entire event as relevant
            if concept_score >= min_concept_score or similarity_score >= min_similarity_score:
                relevant_events.add(event_id)
                logger.info(f"Event '{event_title}' marked as relevant")
        
        # Second pass: collect ALL content from relevant events (no more chunk-level filtering)
        event_content = {}  # Store combined content per event
        for note in context_notes:
            event_id = note["event_id"]
            if event_id in relevant_events:
                if event_id not in event_content:
                    event_content[event_id] = {
                        "event_title": note["event_title"],
                        "event_id": event_id,
                        "event_date": note["event_date"],
                        "transcripts": [],
                        "summaries": []
                    }
                
                # Collect all transcripts and summaries for this event
                if note.get("transcript"):
                    event_content[event_id]["transcripts"].append(note["transcript"])
                if note.get("summary"):
                    event_content[event_id]["summaries"].append(note["summary"])
        
        # Build context and sources from relevant events (no scores)
        for event_id, content in event_content.items():
            # Combine all transcripts and summaries for this event
            combined_transcript = " ".join(content["transcripts"])
            combined_summary = " ".join(set(content["summaries"]))  # Remove duplicate summaries
            
            context_parts.append(f"""
Event: {content['event_title']}
Transcript: {combined_transcript}
Summary: {combined_summary}
---""")
            
            sources.append({
                "event_title": content["event_title"],
                "event_id": event_id,
                "event_date": content["event_date"]
            })
        
        # Limit sources if needed
        sources = sources[:5]
        
        context = "\n".join(context_parts)
        
        logger.info(f"DEBUG: Final context has {len(context_parts)} relevant notes after filtering")
        logger.info(f"DEBUG: Final sources: {[s['event_title'] for s in sources]}")
        
        # 4. Generate response using Gemini with RAG context
        if not context_parts:
            # No relevant context found after strict filtering
            rag_prompt = f"""
You are a helpful assistant for a note-taking app called Notey. The user asked: "{query}"

However, I couldn't find any relevant notes or concepts in their recordings that relate to this question. The user has recorded notes, but none of them seem closely related to this topic.

Please respond helpfully, but let them know that you don't have specific notes about this topic, and suggest they might want to record more audio notes about this subject.
"""
        else:
            rag_prompt = f"""
You are a helpful assistant for Notey, a voice note-taking app. Answer the user's question based on their recorded notes and transcripts.

User Question: "{query}"

Relevant Notes and Transcripts:
{context}

IMPORTANT: Structure your response with proper markdown formatting as follows:

**📋 Overall Summary**

*Provide a comprehensive 2-3 sentence summary of what the user's notes reveal about "{query}". Synthesize the key insights across all relevant recordings.*

**📝 Your Notes**

For each relevant recording, use this EXACT format with line breaks:

• **Event:** [Event Title] \n
  **Summary:** [Summary of this recording's content specifically related to the user's question]

**💡 Additional Insights**

*Any patterns, connections, or additional observations you can make from analyzing all the notes together.*

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
    Search for concepts using semantic similarity instead of word matching.
    Returns concepts ranked by combined similarity and popularity scores.
    """
    try:
        logger.info(f"Searching concepts for query: {q}")
        
        # Get all user's concepts from the database for semantic search
        all_concepts = await supabase_client.select(
            table="concepts",
            columns="id,name",
            filters={"user_id": f"eq.{user_context.user_id}"},
            user_token=user_context.token
        )
        
        if not all_concepts:
            logger.info("No concepts found for user")
            return []
        
        logger.info(f"Found {len(all_concepts)} concepts for user")
        
        # Use vector search for semantic similarity
        try:
            vector_service = get_vector_search_service()
            similar_concepts = await vector_service.search_concepts(
                query=q,
                concepts=all_concepts,
                limit=limit * 2,  # Get more candidates for mention count filtering
                threshold=0.2  # Lower threshold for broader matches
            )
            logger.info(f"Vector search returned {len(similar_concepts)} similar concepts")
        except Exception as vector_error:
            logger.error(f"Vector search failed: {vector_error}")
            # Fallback to simple text matching
            similar_concepts = []
            for concept in all_concepts:
                if q.lower() in concept["name"].lower():
                    similar_concepts.append({
                        "id": concept["id"],
                        "name": concept["name"],
                        "similarity_score": 0.8  # High score for exact matches
                    })
            logger.info(f"Fallback text search returned {len(similar_concepts)} concepts")
        
        # Get mention counts for similar concepts
        result = []
        for concept in similar_concepts:
            try:
                # Use direct HTTP client like in database.py to avoid supabase_client issues
                SUPABASE_URL = os.getenv("SUPABASE_URL")
                SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
                
                headers = {
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json"
                }
                
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{SUPABASE_URL}/rest/v1/chunk_concepts?select=id&concept_id=eq.{concept['id']}&user_id=eq.{user_context.user_id}",
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        mentions = response.json()
                    else:
                        logger.warning(f"Failed to get mentions for concept {concept['name']}: {response.status_code}")
                        mentions = []
                
                result.append({
                    "id": concept["id"],
                    "name": concept["name"],
                    "mention_count": len(mentions),
                    "similarity_score": concept["similarity_score"]
                })
            except Exception as mention_error:
                logger.warning(f"Failed to get mentions for concept {concept['name']}: {mention_error}")
                # Include concept with 0 mentions rather than failing completely
                result.append({
                    "id": concept["id"],
                    "name": concept["name"],
                    "mention_count": 0,
                    "similarity_score": concept["similarity_score"]
                })
        
        # Sort by combined score: similarity + mention count
        # Normalize similarity (0-1) and mention count, then combine
        if result:
            max_mentions = max(r["mention_count"] for r in result) or 1
            for r in result:
                mention_score = r["mention_count"] / max_mentions
                # Weighted combination: 70% similarity, 30% popularity
                r["combined_score"] = 0.7 * r["similarity_score"] + 0.3 * mention_score
        
        result.sort(key=lambda x: x["combined_score"], reverse=True)
        
        return result[:limit]
        
    except Exception as e:
        logger.error(f"Error in semantic concept search: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to search concepts: {str(e)}"
        )

@router.get("/concepts")
async def get_all_concepts(
    user_context = Depends(verify_supabase_token)
) -> List[Dict[str, Any]]:
    """
    Get all concepts for the current user with their mention counts.
    Used for showing available concepts for reports.
    """
    try:
        logger.info(f"Getting all concepts for user: {user_context.user_id}")
        
        # Get all user's concepts
        all_concepts = await supabase_client.select(
            table="concepts",
            columns="id,name",
            filters={"user_id": f"eq.{user_context.user_id}"},
            order="name.asc",
            user_token=user_context.token
        )
        
        if not all_concepts:
            return []
        
        # Get mention counts for each concept
        result = []
        for concept in all_concepts:
            try:
                # Use direct HTTP client like in database.py to avoid supabase_client issues
                SUPABASE_URL = os.getenv("SUPABASE_URL")
                SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
                
                headers = {
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json"
                }
                
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{SUPABASE_URL}/rest/v1/chunk_concepts?select=id&concept_id=eq.{concept['id']}&user_id=eq.{user_context.user_id}",
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        mentions = response.json()
                    else:
                        logger.warning(f"Failed to get mentions for concept {concept['name']}: {response.status_code}")
                        mentions = []
                
                result.append({
                    "id": concept["id"],
                    "name": concept["name"],
                    "mention_count": len(mentions)
                })
            except Exception as mention_error:
                logger.warning(f"Failed to get mentions for concept {concept['name']}: {mention_error}")
                result.append({
                    "id": concept["id"],
                    "name": concept["name"],
                    "mention_count": 0
                })
        
        # Sort by mention count (most popular first)
        result.sort(key=lambda x: x["mention_count"], reverse=True)
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting all concepts: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get concepts: {str(e)}"
        )

@router.get("/concept/{concept_name}/report-data")
async def get_concept_report_data(
    concept_name: str,
    user_context = Depends(verify_supabase_token)
) -> Dict[str, Any]:
    """
    Get comprehensive data for generating a PDF report about a specific concept.
    Includes events, transcripts, summaries, and photos.
    """
    try:
        logger.info(f"Generating report data for concept: {concept_name}")
        
        # 1. Get basic concept data using existing endpoint
        concept_data = await get_notes_by_concept(concept_name, user_context)
        
        if not concept_data["events"]:
            return {
                "concept": concept_name,
                "summary": f"No events found related to the concept '{concept_name}'.",
                "events": []
            }
        
        # 2. Get photos for each event using direct HTTP calls like database.py
        event_ids = [event["id"] for event in concept_data["events"]]
        photos_by_event = {}
        
        if event_ids:
            # Use direct HTTP calls like database.py for photos
            import httpx
            from .config import SUPABASE_URL, get_supabase_headers_read
            
            async with httpx.AsyncClient() as client:
                headers = get_supabase_headers_read()
                
                for event_id in event_ids:
                    try:
                        # Use the same approach as database.py get_event_details
                        photo_res = await client.get(
                            f"{SUPABASE_URL}/rest/v1/photos?event_id=eq.{event_id}&order=offset_seconds.asc",
                            headers=headers
                        )
                        photo_res.raise_for_status()
                        event_photos = photo_res.json()
                        
                        if event_photos:
                            photos_by_event[event_id] = event_photos
                            logger.info(f"Found {len(event_photos)} photos for event {event_id}")
                        
                    except Exception as photo_error:
                        logger.warning(f"Failed to fetch photos for event {event_id}: {photo_error}")
                        continue
                
                logger.info(f"Total photos found: {sum(len(photos) for photos in photos_by_event.values())}")
                logger.info(f"Photos grouped by event: {[(k, len(v)) for k, v in photos_by_event.items()]}")
        
        # 3. Build comprehensive report events
        report_events = []
        all_transcripts = []
        
        for event in concept_data["events"]:
            event_id = event["id"]
            
            # Get all transcripts for this event from the concept notes
            event_notes = [note for note in concept_data["notes"] if note["event_id"] == event_id]
            event_transcripts = [note["transcript"] for note in event_notes if note.get("transcript")]
            combined_transcript = " ".join(event_transcripts).strip()
            
            # Collect for overall summary
            if combined_transcript:
                all_transcripts.append(combined_transcript)
            
            report_event = {
                "id": event_id,
                "title": event["title"],
                "started_at": event["started_at"],
                "transcript": combined_transcript or "No transcript available for this event.",
                "photos": photos_by_event.get(event_id, [])
            }
            
            report_events.append(report_event)
        
        # 4. Generate overall summary using AI
        overall_summary = f"This report covers {len(report_events)} event(s) related to the concept '{concept_name}'."
        
        if all_transcripts:
            try:
                # Use Gemini to generate a comprehensive summary
                summary_prompt = f"""
Based on the following transcripts from multiple voice recordings, provide a comprehensive 2-3 paragraph summary of the concept "{concept_name}":

Transcripts:
{' '.join(all_transcripts[:5000])}  # Limit to avoid token limits

Please provide a concise but informative summary that captures the key points, themes, and insights related to "{concept_name}" across all these recordings.
"""
                response = model.generate_content(summary_prompt)
                overall_summary = response.text.strip()
            except Exception as e:
                logger.warning(f"Failed to generate AI summary: {e}")
                # Fallback to basic summary
        
        return {
            "concept": concept_name,
            "summary": overall_summary,
            "events": report_events
        }
        
    except Exception as e:
        logger.error(f"Error generating report data for concept '{concept_name}': {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate report data: {str(e)}"
        )

@router.get("/concepts")
async def get_user_concepts(
    user_context = Depends(verify_supabase_token)
) -> Dict[str, Any]:
    """
    Get all concepts available for the user, ordered by frequency of use.
    This is used for populating concept suggestions in the frontend.
    """
    try:
        logger.info(f"Getting concepts for user: {user_context.user_id}")
        
        # Get all concepts for the user with their mention counts
        concepts = await supabase_client.select(
            table="concepts",
            columns="name,description",
            filters={"user_id": f"eq.{user_context.user_id}"},
            user_token=user_context.token
        )
        
        if not concepts:
            return {"concepts": []}
        
        # Get mention counts for each concept
        concept_names = [c["name"] for c in concepts]
        concept_mentions = {}
        
        # Query chunk_concepts to get mention counts
        for concept_name in concept_names:
            # Find concept by name
            concept_data = await supabase_client.select(
                table="concepts", 
                columns="id",
                filters={
                    "name": f"eq.{concept_name}",
                    "user_id": f"eq.{user_context.user_id}"
                },
                user_token=user_context.token
            )
            
            if concept_data:
                concept_id = concept_data[0]["id"]
                
                # Count mentions in chunk_concepts
                mentions = await supabase_client.select(
                    table="chunk_concepts",
                    columns="id",
                    filters={"concept_id": f"eq.{concept_id}"},
                    user_token=user_context.token
                )
                
                concept_mentions[concept_name] = len(mentions)
        
        # Combine concept data with mention counts and sort by frequency
        result_concepts = []
        for concept in concepts:
            name = concept["name"]
            result_concepts.append({
                "name": name,
                "description": concept.get("description", ""),
                "mention_count": concept_mentions.get(name, 0)
            })
        
        # Sort by mention count (most used first), then alphabetically
        result_concepts.sort(key=lambda x: (-x["mention_count"], x["name"]))
        
        return {
            "concepts": result_concepts,
            "total_count": len(result_concepts)
        }
        
    except Exception as e:
        logger.error(f"Error getting user concepts: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get concepts: {str(e)}"
        )

class EventReportRequest(BaseModel):
    event_ids: List[str]
    title: str

@router.post("/events/report-data")
async def get_events_report_data(
    request: EventReportRequest,
    user_context = Depends(verify_supabase_token)
) -> Dict[str, Any]:
    """
    Get comprehensive data for generating a PDF report based on specific event IDs.
    This is used when generating reports from chat context sources.
    """
    try:
        logger.info(f"Generating report data for events: {request.event_ids}")
        
        if not request.event_ids:
            return {
                "concept": request.title,
                "summary": "No events provided for report generation.",
                "events": []
            }
        
        # 1. Get event details
        event_ids_formatted = ','.join([f'"{event_id}"' for event_id in request.event_ids])
        event_filter = {"id": f"in.({event_ids_formatted})"}
        
        events = await supabase_client.select(
            table="events",
            columns="id,title,started_at,ended_at",
            filters=event_filter,
            user_token=user_context.token
        )
        
        if not events:
            return {
                "concept": request.title,
                "summary": "No events found with the provided IDs.",
                "events": []
            }
        
        # 2. Get all chunks for these events
        chunk_filter = {"event_id": f"in.({event_ids_formatted})"}
        chunks = await supabase_client.select(
            table="audio_chunks",
            columns="id,event_id,transcript,summary,start_time,length",
            filters=chunk_filter,
            order="start_time.asc",
            user_token=user_context.token
        )
        
        # 3. Get photos for each event
        photos_by_event = {}
        if request.event_ids:
            import httpx
            from .config import SUPABASE_URL, get_supabase_headers_read
            
            async with httpx.AsyncClient() as client:
                headers = get_supabase_headers_read()
                
                for event_id in request.event_ids:
                    try:
                        photo_res = await client.get(
                            f"{SUPABASE_URL}/rest/v1/photos?event_id=eq.{event_id}&order=offset_seconds.asc",
                            headers=headers
                        )
                        photo_res.raise_for_status()
                        event_photos = photo_res.json()
                        
                        if event_photos:
                            photos_by_event[event_id] = event_photos
                            logger.info(f"Found {len(event_photos)} photos for event {event_id}")
                        
                    except Exception as photo_error:
                        logger.warning(f"Failed to fetch photos for event {event_id}: {photo_error}")
                        continue
        
        # 4. Build comprehensive report events
        report_events = []
        all_transcripts = []
        
        for event in events:
            event_id = event["id"]
            
            # Get all transcripts for this event
            event_chunks = [chunk for chunk in chunks if chunk["event_id"] == event_id]
            event_transcripts = [chunk["transcript"] for chunk in event_chunks if chunk.get("transcript")]
            combined_transcript = " ".join(event_transcripts).strip()
            
            # Collect for overall summary
            if combined_transcript:
                all_transcripts.append(combined_transcript)
            
            report_event = {
                "id": event_id,
                "title": event["title"],
                "started_at": event["started_at"],
                "transcript": combined_transcript or "No transcript available for this event.",
                "photos": photos_by_event.get(event_id, [])
            }
            
            report_events.append(report_event)
        
        # 5. Generate overall summary using AI
        overall_summary = f"This report covers {len(report_events)} event(s) from your chat conversation context."
        
        if all_transcripts:
            try:
                # Use Gemini to generate a comprehensive summary
                summary_prompt = f"""
Based on the following transcripts from multiple voice recordings that were referenced in a chat conversation, provide a comprehensive 2-3 paragraph summary:

Transcripts:
{' '.join(all_transcripts[:5000])}  # Limit to avoid token limits

Please provide a concise but informative summary that captures the key points, themes, and insights across all these recordings that were relevant to the user's conversation.
"""
                response = model.generate_content(summary_prompt)
                overall_summary = response.text.strip()
            except Exception as e:
                logger.warning(f"Failed to generate AI summary: {e}")
                # Fallback to basic summary
        
        return {
            "concept": request.title,
            "summary": overall_summary,
            "events": report_events
        }
        
    except Exception as e:
        logger.error(f"Error generating report data for events {request.event_ids}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate report data: {str(e)}"
        )