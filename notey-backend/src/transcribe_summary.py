import os
import requests
import httpx
from fastapi import HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from .summarizer import summarize_transcript

# Load environment variables
load_dotenv()

class AudioURL(BaseModel):
    url: str

class TranscribeSummaryResponse(BaseModel):
    transcript: str
    summary: str

# Get URLs from environment variables
WHISPER_API_URL = os.getenv("WHISPER_URL")
GEMINI_SUMMARY_URL = os.getenv("GEMINI_SUMMARY_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


async def transcribe_and_summarize(audio_url: str) -> TranscribeSummaryResponse:
    """
    Complete pipeline to transcribe audio and generate summary
    
    Args:
        audio_url: URL of the audio file to transcribe
        
    Returns:
        TranscribeSummaryResponse containing transcript and summary
    """
    try:
        # Step 1: Transcribe audio using Whisper API
        whisper_response = requests.post(
            WHISPER_API_URL, 
            json={"url": audio_url},
            timeout=30  # Add timeout for better error handling
        )
        whisper_response.raise_for_status()
        
        transcript = whisper_response.json().get("transcript", "")
        
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

        # Step 3: Persist transcript and summary to database
        await update_audio_chunk_with_results(audio_url, transcript, summary)

        return TranscribeSummaryResponse(
            transcript=transcript,
            summary=summary
        )

    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=503, 
            detail=f"External service error: {str(e)}"
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Pipeline failed: {str(e)}"
        )


async def update_audio_chunk_with_results(audio_url: str, transcript: str, summary: str):
    """
    Update the audio_chunks record with transcript and summary
    
    Args:
        audio_url: The audio URL to match against
        transcript: The transcribed text
        summary: The generated summary
    """
    try:
        async with httpx.AsyncClient() as client:
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
            
    except Exception as e:
        # Failed to update database
        # Log the error but don't fail the entire operation
        # The transcript and summary are still returned to the user
        pass


async def transcribe_audio_only(audio_url: str) -> str:
    """
    Transcribe audio without summarization
    
    Args:
        audio_url: URL of the audio file to transcribe
        
    Returns:
        str: The transcribed text
    """
    try:
        whisper_response = requests.post(
            WHISPER_API_URL,
            json={"url": audio_url},
            timeout=30
        )
        whisper_response.raise_for_status()
        
        transcript = whisper_response.json().get("transcript", "")
        
        if not transcript.strip():
            raise HTTPException(
                status_code=400,
                detail="Transcription failed: Empty transcript received"
            )
            
        return transcript
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=503,
            detail=f"Transcription service error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}"
        )
