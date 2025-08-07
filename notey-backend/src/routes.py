from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from fastapi import UploadFile, File, Form
from pydantic import BaseModel
from services.auth import verify_supabase_token
from services.storage import upload_audio_to_supabase, upload_photo_to_supabase
from services.tasks import transcribe_and_summarize
from utils.hash import generate_event_hash
from . import database
from .summarizer import SummaryRequest, summarize_transcript
from .transcribe_summary import transcribe_and_summarize as transcribe_and_summarize_pipeline, AudioURL
import uuid

router = APIRouter()


class StartEventRequest(BaseModel):
    title: str = "Untitled Event"


@router.post("/events/start")
async def start_event(request: StartEventRequest, user_id: str = Depends(verify_supabase_token)):
    event_id = str(uuid.uuid4())
    # Count prior events for the user and create hash
    count = 1  # Replace with real count from DB
    hash_id = generate_event_hash(user_id, count)

    payload = {
        "id": event_id,
        "user_id": user_id,
        "title": request.title,
        "unique_hash": hash_id
    }

    await database.create_event(payload)
    return {"event_id": event_id, "unique_hash": hash_id}


@router.post("/events/{event_id}/audio")
async def upload_audio(
    event_id: str, 
    file: UploadFile = File(...), 
    duration: float = Form(...), 
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    print(f"🎤 Received audio upload for event_id={event_id}, duration={duration}")
    audio_url = await upload_audio_to_supabase(event_id, file)
    print("📦 Audio uploaded to:", audio_url)

    payload = {
        "event_id": event_id,
        "start_time": 0,
        "length": duration,
        "audio_url": audio_url
    }
    print("📝 Inserting payload into audio_chunks:", payload)

    await database.create_audio_chunk(payload)
    background_tasks.add_task(transcribe_and_summarize, event_id, audio_url)
    return {"status": "audio uploaded", "audio_url": audio_url}


@router.post("/events/{event_id}/photo")
async def upload_photo(event_id: str, offset: float = Form(...), file: UploadFile = File(...), user_id: str = Depends(verify_supabase_token)):
    import time
    import logging
    
    # Enhanced input validation
    if not event_id or not event_id.strip():
        raise HTTPException(status_code=400, detail="Event ID is required")
    
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Photo file is required")
    
    # Validate offset
    if offset is None or offset < 0:
        raise HTTPException(status_code=400, detail="Offset must be a non-negative number")
    
    # File validation with detailed error messages
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=415, detail="File must be an image (JPEG, PNG, or WebP)")
    
    # Check file size (10MB limit) with more specific error
    max_size = 10 * 1024 * 1024  # 10MB
    if file.size and file.size > max_size:
        size_mb = file.size / (1024 * 1024)
        raise HTTPException(
            status_code=413, 
            detail=f"File size ({size_mb:.1f}MB) exceeds maximum allowed size (10MB)"
        )
    
    # Validate supported formats
    supported_formats = ['image/jpeg', 'image/png', 'image/webp']
    if file.content_type not in supported_formats:
        raise HTTPException(
            status_code=415, 
            detail=f"Unsupported file format '{file.content_type}'. Supported formats: JPEG, PNG, WebP"
        )
    
    # Validate filename
    if not file.filename or len(file.filename) > 255:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    start_time = time.time()
    
    try:
        # Verify event exists and user has permission with timeout
        try:
            has_permission = await database.verify_event_ownership(event_id, user_id)
            if not has_permission:
                raise HTTPException(status_code=404, detail="Event not found or access denied")
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Database error during permission check: {e}")
            raise HTTPException(status_code=500, detail="Unable to verify event permissions")
        
        # Upload to storage with error handling
        try:
            photo_url = await upload_photo_to_supabase(event_id, file, offset)
            if not photo_url:
                raise HTTPException(status_code=500, detail="Photo upload to storage failed")
        except Exception as e:
            logging.error(f"Storage upload error: {e}")
            if "timeout" in str(e).lower():
                raise HTTPException(status_code=504, detail="Upload timeout. Please try again.")
            elif "network" in str(e).lower() or "connection" in str(e).lower():
                raise HTTPException(status_code=503, detail="Network error during upload. Please try again.")
            else:
                raise HTTPException(status_code=500, detail="Storage upload failed. Please try again.")

        # Create database record with error handling
        photo_data = {
            "event_id": event_id,
            "offset_seconds": offset,
            "photo_url": photo_url
        }

        try:
            db_result = await database.create_photo_record(photo_data)
        except Exception as e:
            logging.error(f"Database record creation error: {e}")
            # If database fails but storage succeeded, we should ideally clean up storage
            # For now, log the issue
            if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                raise HTTPException(status_code=409, detail="Photo already exists at this timestamp")
            elif "foreign key" in str(e).lower():
                raise HTTPException(status_code=404, detail="Event not found")
            else:
                raise HTTPException(status_code=500, detail="Failed to save photo metadata")
        
        upload_time = time.time() - start_time
        logging.info(f"Photo upload completed in {upload_time:.2f}s for event {event_id}")
        
        return {
            "status": "photo uploaded", 
            "photo_url": photo_url,
            "event_id": event_id,
            "offset_seconds": offset,
            "upload_time": round(upload_time, 2)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        upload_time = time.time() - start_time
        logging.error(f"Unexpected error in photo upload after {upload_time:.2f}s: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred during photo upload")


@router.get("/events/{event_id}")
async def get_event_details(event_id: str):
    return await database.get_event_details(event_id)


@router.get("/events")
async def get_all_events(user_id: str = Depends(verify_supabase_token)):
    return await database.get_user_events(user_id)


@router.get("/audio-chunks")
async def get_audio_chunks(event_id: str):
    """Get all audio chunks for a specific event"""
    return await database.get_audio_chunks(event_id)


@router.post("/summarize")
async def summarize(request: SummaryRequest):
    """Summarize a transcript using AWS Bedrock"""
    summary = await summarize_transcript(request.transcript)
    return {"summary": summary}


@router.post("/transcribe-summary")
async def transcribe_summary_endpoint(payload: AudioURL):
    """
    Endpoint to transcribe audio and generate summary
    """
    result = await transcribe_and_summarize_pipeline(payload.url)
    return {
        "transcript": result.transcript,
        "summary": result.summary
    }
