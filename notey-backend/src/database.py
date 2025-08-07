import httpx
from .config import SUPABASE_URL, get_supabase_headers, get_supabase_headers_read


async def create_event(event_data: dict) -> dict:
    """Create a new event in the database"""
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/events",
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json=event_data
        )
        res.raise_for_status()
        return res.json()


async def get_user_events(user_id: str) -> list:
    """Get all events for a user"""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/events?user_id=eq.{user_id}&select=id,title,started_at",
            headers=get_supabase_headers_read()
        )
        res.raise_for_status()
        return res.json()


async def create_audio_chunk(audio_data: dict) -> dict:
    """Create an audio chunk record"""
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/audio_chunks",
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json=audio_data
        )
        res.raise_for_status()
        return res.json()


async def create_photo_record(photo_data: dict) -> dict:
    """Create a photo record"""
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/photos",
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json=photo_data
        )
        if res.status_code >= 300:
            error_detail = res.text
            if res.status_code == 409:
                raise Exception("Photo record already exists")
            elif res.status_code == 422:
                raise Exception(f"Invalid photo data: {error_detail}")
            else:
                raise Exception(f"Database error: {error_detail}")
        return res.json()


async def get_event_details(event_id: str) -> dict:
    """Get complete event details including audio, transcript, and photos"""
    async with httpx.AsyncClient() as client:
        headers = get_supabase_headers_read()

        # First verify the event exists
        event_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/events?id=eq.{event_id}",
            headers=headers
        )
        event_res.raise_for_status()
        events = event_res.json()
        if not events:
            return None  # Event not found

        # Get audio chunks (which contain transcript and summary data)
        audio_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/audio_chunks?event_id=eq.{event_id}",
            headers=headers
        )
        audio_res.raise_for_status()
        audio_data = audio_res.json()
        audio_chunk = audio_data[0] if audio_data and len(audio_data) > 0 else None

        # Get photos sorted by offset_seconds
        photo_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/photos?event_id=eq.{event_id}&order=offset_seconds.asc",
            headers=headers
        )
        photo_res.raise_for_status()
        photos_data = photo_res.json()

    return {
        "audio_url": audio_chunk["audio_url"] if audio_chunk else None,
        "transcript": audio_chunk["transcript"] if audio_chunk else "",
        "summary": audio_chunk["summary"] if audio_chunk else "",
        "photos": photos_data
    }


async def get_audio_chunks(event_id: str) -> list:
    """Get all audio chunks for a specific event"""
    async with httpx.AsyncClient() as client:
        headers = get_supabase_headers_read()
        
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/audio_chunks?event_id=eq.{event_id}&select=*",
            headers=headers
        )
        res.raise_for_status()
        return res.json()


async def verify_event_ownership(event_id: str, user_id: str) -> bool:
    """Verify that the user owns the specified event"""
    async with httpx.AsyncClient() as client:
        headers = get_supabase_headers_read()
        
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/events?id=eq.{event_id}&user_id=eq.{user_id}",
            headers=headers
        )
        res.raise_for_status()
        events = res.json()
        return len(events) > 0
    



async def delete_event(event_id: str, user_id: str) -> bool:
    """
    Delete an event and all associated data (audio chunks, photos)
    Only allows deletion if the user owns the event
    
    Args:
        event_id: The ID of the event to delete
        user_id: The ID of the user making the request
        
    Returns:
        bool: True if deletion was successful, False if event not found or not owned by user
    """
    # First verify ownership
    if not await verify_event_ownership(event_id, user_id):
        print(f"❌ Event {event_id} not found or user {user_id} doesn't own it")
        return False
    
    async with httpx.AsyncClient() as client:
        headers = get_supabase_headers()
        
        try:
            print(f"🗑️ Starting deletion of event {event_id}")
            
            # Get photos first to check what needs to be deleted
            photos_check = await client.get(
                f"{SUPABASE_URL}/rest/v1/photos?event_id=eq.{event_id}&select=id,photo_url",
                headers=get_supabase_headers_read()
            )
            photos_check.raise_for_status()
            photos_to_delete = photos_check.json()
            print(f"📸 Found {len(photos_to_delete)} photos to delete")
            
            # Delete audio chunks first (due to foreign key constraints)
            print(f"🎵 Deleting audio chunks for event {event_id}")
            audio_res = await client.delete(
                f"{SUPABASE_URL}/rest/v1/audio_chunks?event_id=eq.{event_id}",
                headers=headers
            )
            if audio_res.status_code not in [200, 204]:
                print(f"❌ Audio deletion failed: {audio_res.status_code} - {audio_res.text}")
                audio_res.raise_for_status()
            print(f"✅ Audio chunks deleted successfully")
            
            # Delete photos
            if photos_to_delete:
                print(f"📸 Deleting {len(photos_to_delete)} photos for event {event_id}")
                photos_res = await client.delete(
                    f"{SUPABASE_URL}/rest/v1/photos?event_id=eq.{event_id}",
                    headers=headers
                )
                if photos_res.status_code not in [200, 204]:
                    print(f"❌ Photos deletion failed: {photos_res.status_code} - {photos_res.text}")
                    photos_res.raise_for_status()
                print(f"✅ Photos deleted successfully")
            
            # Delete storage files (audio and photos)
            print(f"🗂️ Deleting storage files for event {event_id}")
            storage_success = await delete_event_storage_files(event_id, user_id)
            if not storage_success:
                print(f"⚠️ Some storage files may not have been deleted for event {event_id}")
                # Don't fail the entire deletion for storage issues
            
            # Finally delete the event itself
            print(f"📝 Deleting event {event_id}")
            event_res = await client.delete(
                f"{SUPABASE_URL}/rest/v1/events?id=eq.{event_id}&user_id=eq.{user_id}",
                headers=headers
            )
            if event_res.status_code not in [200, 204]:
                print(f"❌ Event deletion failed: {event_res.status_code} - {event_res.text}")
                event_res.raise_for_status()
            
            print(f"✅ Event {event_id} deleted successfully")
            return True
            
        except Exception as e:
            print(f"❌ Error deleting event {event_id}: {str(e)}")
            # Log more details about the error
            if hasattr(e, 'response'):
                print(f"❌ HTTP Response: {e.response.status_code} - {e.response.text}")
            raise e
