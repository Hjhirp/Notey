# Tasks service
import os
import httpx
from dotenv import load_dotenv
from src.transcribe_summary import transcribe_and_summarize as transcribe_and_summarize_pipeline

load_dotenv()

async def transcribe_and_summarize(event_id: str, audio_url: str):
    """
    Background task to transcribe and summarize audio
    Uses the new transcribe_summary pipeline that stores data in audio_chunks
    """
    try:
        # Use our new pipeline that handles transcription, summarization, and DB storage
        result = await transcribe_and_summarize_pipeline(audio_url)
        
    except Exception as e:
        # Don't re-raise - this is a background task, we don't want to crash the request
        pass
