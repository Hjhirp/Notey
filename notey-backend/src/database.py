import httpx
from .config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, get_supabase_headers, get_supabase_headers_read


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
        "event_id": events[0]["id"],
        "title": events[0].get("title", "Untitled Event"),
        "started_at": events[0].get("started_at"),
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
        return False
    
    async with httpx.AsyncClient() as client:
        headers = get_supabase_headers()
        
        try:
            
            # Get photos first to check what needs to be deleted
            photos_check = await client.get(
                f"{SUPABASE_URL}/rest/v1/photos?event_id=eq.{event_id}&select=id,photo_url",
                headers=get_supabase_headers_read()
            )
            photos_check.raise_for_status()
            photos_to_delete = photos_check.json()
            
            # Delete audio chunks first (due to foreign key constraints)
            audio_res = await client.delete(
                f"{SUPABASE_URL}/rest/v1/audio_chunks?event_id=eq.{event_id}",
                headers=headers
            )
            if audio_res.status_code not in [200, 204]:
                audio_res.raise_for_status()
            
            # Delete photos
            if photos_to_delete:
                photos_res = await client.delete(
                    f"{SUPABASE_URL}/rest/v1/photos?event_id=eq.{event_id}",
                    headers=headers
                )
                if photos_res.status_code not in [200, 204]:
                    photos_res.raise_for_status()
            
            # Delete storage files (audio and photos)
            storage_success = await delete_event_storage_files(event_id, user_id)
            # Finally delete the event itself
            event_res = await client.delete(
                f"{SUPABASE_URL}/rest/v1/events?id=eq.{event_id}&user_id=eq.{user_id}",
                headers=headers
            )
            if event_res.status_code not in [200, 204]:
                event_res.raise_for_status()
            
            return True
            
        except Exception as e:
            # Log more details about the error
            raise e


async def delete_event_storage_files(event_id: str, user_id: str) -> bool:
    """
    Delete storage files (audio and photos) for an event
    
    Args:
        event_id: The ID of the event
        user_id: The ID of the user (for validation)
        
    Returns:
        bool: True if deletion was successful, False otherwise
    """
    try:
        # Import here to avoid circular imports
        from services.storage import delete_event_storage_files as delete_storage_files
        
        # Delete files from Supabase Storage
        success = await delete_storage_files(event_id, user_id)
        
        
        return success
        
    except Exception as e:
        return False


async def delete_event_with_user_token(event_id: str, user_context) -> bool:
    """
    Delete an event and all associated data using the user's JWT token for RLS compliance
    
    Args:
        event_id: The ID of the event to delete
        user_context: UserContext object containing user_id and JWT token
        
    Returns:
        bool: True if deletion was successful, False if event not found or not owned by user
    """
    
    # Create headers with user's JWT token for RLS compliance
    def get_user_headers():
        return {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {user_context.token}",
            "Content-Type": "application/json"
        }
    
    def get_user_headers_read():
        return {
            "apikey": SUPABASE_SERVICE_ROLE_KEY, 
            "Authorization": f"Bearer {user_context.token}"
        }
    
    # First verify ownership
    if not await verify_event_ownership(event_id, user_context.user_id):
        return False
    
    async with httpx.AsyncClient() as client:
        headers = get_user_headers()
        
        try:
            
            # Get photos first to check what needs to be deleted
            photos_check = await client.get(
                f"{SUPABASE_URL}/rest/v1/photos?event_id=eq.{event_id}&select=id,photo_url",
                headers=get_user_headers_read()
            )
            photos_check.raise_for_status()
            photos_to_delete = photos_check.json()
            
            # Delete audio chunks first (due to foreign key constraints)
            audio_res = await client.delete(
                f"{SUPABASE_URL}/rest/v1/audio_chunks?event_id=eq.{event_id}",
                headers=headers
            )
            if audio_res.status_code not in [200, 204]:
                audio_res.raise_for_status()
            
            # Delete photos
            if photos_to_delete:
                photos_res = await client.delete(
                    f"{SUPABASE_URL}/rest/v1/photos?event_id=eq.{event_id}",
                    headers=headers
                )
                if photos_res.status_code not in [200, 204]:
                    photos_res.raise_for_status()
            
            # Delete storage files (audio and photos) using user's token
            storage_success = await delete_event_storage_files_with_user_token(event_id, user_context)
            # Finally delete the event itself
            event_res = await client.delete(
                f"{SUPABASE_URL}/rest/v1/events?id=eq.{event_id}&user_id=eq.{user_context.user_id}",
                headers=headers
            )
            if event_res.status_code not in [200, 204]:
                event_res.raise_for_status()
            
            return True
            
        except Exception as e:
            # Log more details about the error
            raise e


async def delete_event_storage_files_with_user_token(event_id: str, user_context) -> bool:
    """
    Delete storage files using user's JWT token for RLS compliance
    
    Args:
        event_id: The ID of the event
        user_context: UserContext object containing user_id and JWT token
        
    Returns:
        bool: True if deletion was successful, False otherwise
    """
    try:
        # Import here to avoid circular imports
        from services.storage import delete_event_storage_files_with_user_token as delete_storage_files
        
        # Delete files from Supabase Storage using user token
        success = await delete_storage_files(event_id, user_context)
        
        
        return success
        
    except Exception as e:
        return False

# Labels functionality
async def create_label(label_data: dict) -> dict:
    """Create a new label in the database"""
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/labels",
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json=label_data
        )
        res.raise_for_status()
        return res.json()


async def get_user_labels(user_id: str) -> list:
    """Get all labels for a user"""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/labels?user_id=eq.{user_id}&order=name.asc",
            headers=get_supabase_headers_read()
        )
        res.raise_for_status()
        return res.json()


async def update_label(label_id: str, user_id: str, update_data: dict) -> dict:
    """Update an existing label"""
    async with httpx.AsyncClient() as client:
        res = await client.patch(
            f"{SUPABASE_URL}/rest/v1/labels?id=eq.{label_id}&user_id=eq.{user_id}",
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json=update_data
        )
        res.raise_for_status()
        result = res.json()
        return result[0] if result else None


async def delete_label(label_id: str, user_id: str) -> bool:
    """Delete a label and all its associations"""
    async with httpx.AsyncClient() as client:
        # First delete all label links
        await client.delete(
            f"{SUPABASE_URL}/rest/v1/label_links?label_id=eq.{label_id}&user_id=eq.{user_id}",
            headers=get_supabase_headers()
        )
        
        # Then delete the label
        res = await client.delete(
            f"{SUPABASE_URL}/rest/v1/labels?id=eq.{label_id}&user_id=eq.{user_id}",
            headers=get_supabase_headers()
        )
        return res.status_code == 204


async def verify_label_ownership(label_id: str, user_id: str) -> bool:
    """Verify that a label belongs to the user"""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/labels?id=eq.{label_id}&user_id=eq.{user_id}",
            headers=get_supabase_headers_read()
        )
        res.raise_for_status()
        return len(res.json()) > 0


async def attach_label_to_entity(label_id: str, entity_type: str, entity_id: str, user_id: str) -> dict:
    """Attach a label to an entity"""
    async with httpx.AsyncClient() as client:
        label_link_data = {
            "user_id": user_id,
            "label_id": label_id,
            "entity_type": entity_type,
            "entity_id": entity_id
        }
        res = await client.post(
            f"{SUPABASE_URL}/rest/v1/label_links",
            headers={**get_supabase_headers(), "Prefer": "return=representation"},
            json=label_link_data
        )
        res.raise_for_status()
        return res.json()


async def detach_label_from_entity(label_id: str, entity_type: str, entity_id: str, user_id: str) -> bool:
    """Detach a label from an entity"""
    async with httpx.AsyncClient() as client:
        res = await client.delete(
            f"{SUPABASE_URL}/rest/v1/label_links?label_id=eq.{label_id}&entity_type=eq.{entity_type}&entity_id=eq.{entity_id}&user_id=eq.{user_id}",
            headers=get_supabase_headers()
        )
        return res.status_code == 204


async def verify_entity_exists_and_ownership(entity_type: str, entity_id: str, user_id: str) -> bool:
    """Verify that an entity exists and belongs to the user"""
    async with httpx.AsyncClient() as client:
        if entity_type == "event":
            res = await client.get(
                f"{SUPABASE_URL}/rest/v1/events?id=eq.{entity_id}&user_id=eq.{user_id}",
                headers=get_supabase_headers_read()
            )
        elif entity_type == "audio_chunk":
            res = await client.get(
                f"{SUPABASE_URL}/rest/v1/audio_chunks?id=eq.{entity_id}",
                headers=get_supabase_headers_read()
            )
            if res.status_code == 200 and res.json():
                # Check if the audio chunk belongs to an event owned by the user
                audio_chunk = res.json()[0]
                event_res = await client.get(
                    f"{SUPABASE_URL}/rest/v1/events?id=eq.{audio_chunk['event_id']}&user_id=eq.{user_id}",
                    headers=get_supabase_headers_read()
                )
                return event_res.status_code == 200 and len(event_res.json()) > 0
            return False
        elif entity_type == "photo":
            res = await client.get(
                f"{SUPABASE_URL}/rest/v1/photos?id=eq.{entity_id}",
                headers=get_supabase_headers_read()
            )
            if res.status_code == 200 and res.json():
                # Check if the photo belongs to an event owned by the user
                photo = res.json()[0]
                event_res = await client.get(
                    f"{SUPABASE_URL}/rest/v1/events?id=eq.{photo['event_id']}&user_id=eq.{user_id}",
                    headers=get_supabase_headers_read()
                )
                return event_res.status_code == 200 and len(event_res.json()) > 0
            return False
        else:
            return False
        
        res.raise_for_status()
        return len(res.json()) > 0


async def bulk_attach_labels_to_entities(label_ids: list, entity_type: str, entity_ids: list, user_id: str) -> dict:
    """Bulk attach multiple labels to multiple entities"""
    created = 0
    errors = []
    
    for label_id in label_ids:
        for entity_id in entity_ids:
            try:
                await attach_label_to_entity(label_id, entity_type, entity_id, user_id)
                created += 1
            except Exception as e:
                errors.append(f"Failed to attach label {label_id} to {entity_type} {entity_id}: {str(e)}")
    
    return {
        "created": created,
        "requested": len(label_ids) * len(entity_ids),
        "errors": errors
    }


async def bulk_detach_labels_from_entities(label_ids: list, entity_type: str, entity_ids: list, user_id: str) -> dict:
    """Bulk detach multiple labels from multiple entities"""
    removed = 0
    errors = []
    
    for label_id in label_ids:
        for entity_id in entity_ids:
            try:
                success = await detach_label_from_entity(label_id, entity_type, entity_id, user_id)
                if success:
                    removed += 1
            except Exception as e:
                errors.append(f"Failed to detach label {label_id} from {entity_type} {entity_id}: {str(e)}")
    
    return {
        "removed": removed,
        "errors": errors
    }


async def verify_event_exists_and_ownership(event_id: str, user_id: str) -> bool:
    """Verify that an event exists and belongs to the user"""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/events?id=eq.{event_id}&user_id=eq.{user_id}",
            headers=get_supabase_headers_read()
        )
        res.raise_for_status()
        return len(res.json()) > 0


async def get_entity_labels(entity_type: str, entity_id: str, user_id: str) -> list:
    """Get all labels attached to a specific entity"""
    async with httpx.AsyncClient() as client:
        # Get label links for the entity
        res = await client.get(
            f"{SUPABASE_URL}/rest/v1/label_links?entity_type=eq.{entity_type}&entity_id=eq.{entity_id}&user_id=eq.{user_id}",
            headers=get_supabase_headers_read()
        )
        res.raise_for_status()
        label_links = res.json()
        
        if not label_links:
            return []
        
        # Get the actual label details for each label link (remove duplicates)
        unique_label_ids = list(set([link['label_id'] for link in label_links]))
        label_ids_str = ','.join([f'"{lid}"' for lid in unique_label_ids])
        
        labels_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/labels?id=in.({label_ids_str})&user_id=eq.{user_id}",
            headers=get_supabase_headers_read()
        )
        labels_res.raise_for_status()
        labels_data = labels_res.json()
        
        # Ensure uniqueness based on label ID (extra safety)
        unique_labels = {}
        for label in labels_data:
            unique_labels[label['id']] = label
        
        return list(unique_labels.values())
