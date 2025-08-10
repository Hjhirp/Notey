# Tasks service
import os
import logging
import httpx
from dotenv import load_dotenv
from src.transcribe_summary import transcribe_and_summarize as transcribe_and_summarize_pipeline

# Configure logger
logger = logging.getLogger(__name__)

load_dotenv()

async def transcribe_and_summarize(event_id: str, audio_url: str):
    """
    Background task to transcribe and summarize audio
    Uses the new transcribe_summary pipeline that stores data in audio_chunks
    """
    try:
        logger.info(f"Starting transcription and summarization for event {event_id}")
        # Use our new pipeline that handles transcription, summarization, and DB storage
        result = await transcribe_and_summarize_pipeline(audio_url)
        logger.info(f"Successfully completed transcription and summarization for event {event_id}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to transcribe and summarize audio for event {event_id}: {e}")
        # Don't re-raise - this is a background task, we don't want to crash the request
        return None
