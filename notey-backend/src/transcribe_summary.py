import os
import requests
import httpx
import time
import logging
from fastapi import HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from .summarizer import summarize_transcript
from .concept_extractor import extract_concepts_from_transcript

# Configure logger
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class AudioURL(BaseModel):
    url: str

class TranscribeSummaryResponse(BaseModel):
    transcript: str
    summary: str

# Get URLs from environment variables
# Whisper API (commented out - using AssemblyAI instead)
# WHISPER_API_URL = os.getenv("WHISPER_URL")

# AssemblyAI API (active)
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com"

GEMINI_SUMMARY_URL = os.getenv("GEMINI_SUMMARY_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


async def transcribe_audio_with_assemblyai(audio_url: str) -> str:
    """
    Transcribe audio using AssemblyAI
    
    Args:
        audio_url: URL of the audio file to transcribe
        
    Returns:
        str: The transcribed text
    """
    if not ASSEMBLYAI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="AssemblyAI API key not configured"
        )
    
    headers = {
        "authorization": ASSEMBLYAI_API_KEY,
        "content-type": "application/json"
    }
    
    # Submit transcription job
    data = {
        "audio_url": audio_url,
        "speech_model": "universal"
    }
    
    response = requests.post(
        f"{ASSEMBLYAI_BASE_URL}/v2/transcript",
        json=data,
        headers=headers,
        timeout=60
    )
    response.raise_for_status()
    
    transcript_id = response.json()['id']
    polling_endpoint = f"{ASSEMBLYAI_BASE_URL}/v2/transcript/{transcript_id}"
    
    # Poll for completion
    max_wait_time = 300  # 5 minutes
    start_time = time.time()
    
    while True:
        if time.time() - start_time > max_wait_time:
            raise HTTPException(
                status_code=504,
                detail="Transcription timeout: Processing took longer than 5 minutes"
            )
            
        transcription_result = requests.get(polling_endpoint, headers=headers, timeout=30).json()
        
        if transcription_result['status'] == 'completed':
            transcript_text = transcription_result.get('text', '')
            if not transcript_text.strip():
                raise HTTPException(
                    status_code=400,
                    detail="Transcription failed: Empty transcript received"
                )
            return transcript_text
            
        elif transcription_result['status'] == 'error':
            error_msg = transcription_result.get('error', 'Unknown error')
            raise HTTPException(
                status_code=500,
                detail=f"AssemblyAI transcription failed: {error_msg}"
            )
        else:
            time.sleep(3)


# Commented out Whisper-based transcription function
# async def transcribe_with_whisper(audio_url: str) -> str:
#     """Transcribe audio using Whisper API (Fly.dev)"""
#     whisper_response = requests.post(
#         WHISPER_API_URL, 
#         json={"url": audio_url},
#         timeout=300  # 5 minutes timeout for longer audio files
#     )
#     whisper_response.raise_for_status()
#     
#     transcript = whisper_response.json().get("transcript", "")
#     
#     if not transcript.strip():
#         raise HTTPException(
#             status_code=400, 
#             detail="Transcription failed: Empty transcript received"
#         )
#     return transcript

async def transcribe_and_summarize(audio_url: str) -> TranscribeSummaryResponse:
    """
    Complete pipeline to transcribe audio and generate summary
    
    Args:
        audio_url: URL of the audio file to transcribe
        
    Returns:
        TranscribeSummaryResponse containing transcript and summary
    """
    try:
        # Step 1: Transcribe audio using AssemblyAI (active)
        transcript = await transcribe_audio_with_assemblyai(audio_url)
        
        # Step 1 (commented): Transcribe audio using Whisper API
        # transcript = await transcribe_with_whisper(audio_url)
        
        if not transcript.strip():
            raise HTTPException(
                status_code=400, 
                detail="Transcription failed: Empty transcript received"
            )

        # Step 2: Generate summary using our internal summarizer
        summary = await summarize_transcript(transcript)
        
        if not summary.strip():
            raise HTTPException(
                status_code=500,
                detail="Summarization failed: Empty summary generated"
            )

        # Step 3: Extract concepts from transcript
        concepts = await extract_concepts_from_transcript(transcript)
        
        # Step 4: Persist transcript and summary to database
        chunk_id = await update_audio_chunk_with_results(audio_url, transcript, summary)
        
        # Step 5: If we got a chunk_id and concepts, upsert them automatically
        if chunk_id and concepts:
            await upsert_concepts_for_chunk(chunk_id, concepts)
            print(f"✅ Stored {len(concepts)} concepts for chunk {chunk_id}")
        else:
            print(f"⚠️ No chunk_id found for audio URL or no concepts extracted. chunk_id={chunk_id}, concepts={len(concepts) if concepts else 0}")

        return TranscribeSummaryResponse(
            transcript=transcript,
            summary=summary
        )

    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=503, 
            detail=f"AssemblyAI service error: {str(e)}"
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Pipeline failed: {str(e)}"
        )


async def update_audio_chunk_with_results(audio_url: str, transcript: str, summary: str) -> str:
    """
    Update the audio_chunks record with transcript and summary
    
    Args:
        audio_url: The audio URL to match against
        transcript: The transcribed text
        summary: The generated summary
        
    Returns:
        chunk_id: The UUID of the updated chunk, or None if update failed
    """
    try:
        async with httpx.AsyncClient() as client:
            # First get the chunk_id for this audio_url
            get_res = await client.get(
                f"{SUPABASE_URL}/rest/v1/audio_chunks?audio_url=eq.{audio_url}&select=id",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json"
                }
            )
            get_res.raise_for_status()
            
            chunks = get_res.json()
            if not chunks:
                return None
                
            chunk_id = chunks[0]["id"]
            
            # Update with transcript and summary
            res = await client.patch(
                f"{SUPABASE_URL}/rest/v1/audio_chunks?audio_url=eq.{audio_url}",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                json={
                    "transcript": transcript,
                    "summary": summary
                }
            )
            res.raise_for_status()
            
            return chunk_id
            
    except Exception as e:
        # Failed to update database
        # Log the error but don't fail the entire operation
        # The transcript and summary are still returned to the user
        return None


async def transcribe_audio_only(audio_url: str) -> str:
    """
    Transcribe audio without summarization using AssemblyAI
    
    Args:
        audio_url: URL of the audio file to transcribe
        
    Returns:
        str: The transcribed text
    """
    # Use AssemblyAI (active)
    return await transcribe_audio_with_assemblyai(audio_url)
    
    # Original Whisper implementation (commented out)
    # try:
    #     whisper_response = requests.post(
    #         WHISPER_API_URL,
    #         json={"url": audio_url},
    #         timeout=30
    #     )
    #     whisper_response.raise_for_status()
    #     
    #     transcript = whisper_response.json().get("transcript", "")
    #     
    #     if not transcript.strip():
    #         raise HTTPException(
    #             status_code=400,
    #             detail="Transcription failed: Empty transcript received"
    #         )
    #         
    #     return transcript
    #     
    # except requests.exceptions.RequestException as e:
    #     raise HTTPException(
    #         status_code=503,
    #         detail=f"Transcription service error: {str(e)}"
    #     )
    # except Exception as e:
    #     raise HTTPException(
    #         status_code=500,
    #         detail=f"Transcription failed: {str(e)}"
    #     )


async def upsert_concepts_for_chunk(chunk_id: str, concepts: list):
    """
    Automatically upsert concepts for a chunk using direct database operations.
    This bypasses the API endpoint and uses service role permissions.
    
    Args:
        chunk_id: UUID of the audio chunk
        concepts: List of concept dictionaries from concept extraction
    """
    try:
        if not concepts:
            return
            
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json"
            }
            
            # First, get the user_id from the chunk's associated event
            chunk_response = await client.get(
                f"{SUPABASE_URL}/rest/v1/audio_chunks?id=eq.{chunk_id}&select=event_id",
                headers=headers
            )
            
            if chunk_response.status_code != 200:
                print(f"⚠️ Failed to get chunk info for {chunk_id}")
                return
                
            chunks = chunk_response.json()
            if not chunks:
                print(f"⚠️ No chunk found with id {chunk_id}")
                return
                
            event_id = chunks[0]["event_id"]
            
            # Get user_id from the event
            event_response = await client.get(
                f"{SUPABASE_URL}/rest/v1/events?id=eq.{event_id}&select=user_id",
                headers=headers
            )
            
            if event_response.status_code != 200:
                print(f"⚠️ Failed to get event info for {event_id}")
                return
                
            events = event_response.json()
            if not events:
                print(f"⚠️ No event found with id {event_id}")
                return
                
            user_id = events[0]["user_id"]
            print(f"📋 Processing concepts for user {user_id}, chunk {chunk_id}")
            
            for concept in concepts:
                # 1. Upsert the concept (create if doesn't exist)
                concept_data = {
                    "name": concept["name"],
                    "user_id": user_id
                }
                
                try:
                    # Try to insert the concept
                    response = await client.post(
                        f"{SUPABASE_URL}/rest/v1/concepts",
                        headers={**headers, "Prefer": "return=representation"},
                        json=concept_data
                    )
                    
                    if response.status_code == 201:
                        concept_result = response.json()
                        concept_id = concept_result[0]["id"]
                    else:
                        # Concept already exists, get its ID (filter by user_id too)
                        response = await client.get(
                            f"{SUPABASE_URL}/rest/v1/concepts?name=eq.{concept['name']}&user_id=eq.{user_id}&select=id",
                            headers=headers
                        )
                        
                        if response.status_code == 200:
                            existing_concepts = response.json()
                            if existing_concepts:
                                concept_id = existing_concepts[0]["id"]
                            else:
                                continue  # Skip this concept
                        else:
                            continue  # Skip this concept
                
                except Exception:
                    continue  # Skip this concept on error
                
                # 2. Upsert chunk_concept relationship
                chunk_concept_data = {
                    "chunk_id": chunk_id,
                    "concept_id": concept_id,
                    "user_id": user_id,
                    "score": concept["score"],
                    "from_sec": concept.get("from_sec"),
                    "to_sec": concept.get("to_sec")
                }
                
                try:
                    await client.post(
                        f"{SUPABASE_URL}/rest/v1/chunk_concepts",
                        headers={**headers, "Prefer": "return=representation,resolution=merge-duplicates"},
                        json=chunk_concept_data
                    )
                except Exception:
                    continue  # Skip this relationship on error
                    
    except Exception as e:
        # Don't fail the entire pipeline if concept upsert fails
        # Just log and continue
        print(f"⚠️ Error upserting concepts for chunk {chunk_id}: {e}")
        logger.error(f"Error upserting concepts for chunk {chunk_id}: {e}")
