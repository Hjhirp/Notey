# Storage service
import os
from dotenv import load_dotenv
import aiofiles
import httpx

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
}

async def upload_audio_to_supabase(event_id: str, file, bucket="audio") -> str:
    filename = f"{event_id}/{file.filename}"
    file_bytes = await file.read()

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{bucket}/{filename}",
            headers=headers,
            content=file_bytes
        )
        if res.status_code >= 300:
            raise Exception(f"Upload failed: {res.text}")

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{filename}"
    return public_url

async def upload_photo_to_supabase(event_id: str, file, offset: float, bucket="photos") -> str:
    # Generate unique filename with timestamp and original name
    import time
    timestamp_ms = int(time.time() * 1000)
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{event_id}/{timestamp_ms}_{int(offset*1000)}_{file.filename}"
    
    file_bytes = await file.read()
    
    # Validate file is not empty
    if not file_bytes:
        raise Exception("File is empty")

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{bucket}/{filename}",
            headers=headers,
            content=file_bytes
        )
        if res.status_code >= 300:
            error_detail = res.text
            if res.status_code == 409:
                raise Exception(f"File already exists: {filename}")
            elif res.status_code == 413:
                raise Exception("File too large")
            else:
                raise Exception(f"Upload failed with status {res.status_code}: {error_detail}")

        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{filename}"
        print(f"✅ Photo uploaded successfully (fallback): {public_url}")
        return public_url


async def delete_storage_file(file_url: str, user_id: str) -> bool:
    """
    Delete a file from Supabase storage
    
    Args:
        file_url: The full URL of the file to delete
        user_id: The user ID for permission verification
        
    Returns:
        bool: True if deletion was successful
    """
    try:
        # Extract bucket and file path from URL
        # URL format: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
        if "/storage/v1/object/public/" not in file_url:
            print(f"❌ Invalid storage URL format: {file_url}")
            return False
            
        url_parts = file_url.split("/storage/v1/object/public/", 1)
        if len(url_parts) != 2:
            print(f"❌ Could not parse storage URL: {file_url}")
            return False
            
        path_part = url_parts[1]  # bucket/path
        bucket_and_path = path_part.split("/", 1)
        if len(bucket_and_path) != 2:
            print(f"❌ Could not extract bucket and path from: {path_part}")
            return False
            
        bucket, file_path = bucket_and_path
        
        print(f"🗑️ Deleting storage file: bucket={bucket}, path={file_path}")
        
        # Include user_id in headers for RLS compliance
        delete_headers = {
            **headers,
            "x-user-id": user_id,
        }
        
        async with httpx.AsyncClient() as client:
            res = await client.delete(
                f"{SUPABASE_URL}/storage/v1/object/{bucket}/{file_path}",
                headers=delete_headers
            )
            
            if res.status_code in [200, 204]:
                print(f"✅ Storage file deleted successfully: {file_path}")
                return True
            elif res.status_code == 404:
                print(f"⚠️ Storage file not found (already deleted?): {file_path}")
                return True  # Consider this success
            else:
                print(f"❌ Storage deletion failed: {res.status_code} - {res.text}")
                return False
                
    except Exception as e:
        print(f"❌ Error deleting storage file {file_url}: {str(e)}")
        return False


async def delete_event_storage_files(event_id: str, user_id: str) -> bool:
    """
    Delete all storage files associated with an event
    
    Args:
        event_id: The event ID
        user_id: The user ID for permission verification
        
    Returns:
        bool: True if all deletions were successful
    """
    try:
        print(f"🗑️ Deleting storage files for event {event_id}")
        
        # Delete audio files
        audio_success = await delete_storage_folder_supabase("audio", f"{event_id}/", user_id)

        # Delete photo files (using 'photos' bucket per RLS policy)
        photo_success = await delete_storage_folder_supabase("photos", f"{event_id}/", user_id)
        
        return audio_success and photo_success
        
    except Exception as e:
        print(f"❌ Error deleting storage files for event {event_id}: {str(e)}")
        return False


def get_user_supabase_client(user_id: str):
    """
    Get a Supabase client instance for a specific user ID
    
    Args:
        user_id: The user ID for permission verification
        
    Returns:
        Supabase client instance
    """
    from supabase import create_client, Client
    supabase_url = SUPABASE_URL
    supabase_key = SUPABASE_SERVICE_ROLE_KEY  # Use service role key for admin operations
    return create_client(supabase_url, supabase_key)

async def delete_storage_folder_supabase(bucket: str, prefix: str, user_id: str) -> bool:
    """
    Delete all files in a storage folder with given prefix using Supabase client
    
    Args:
        supabase: Supabase client instance
        bucket: The storage bucket name
        prefix: The folder prefix (e.g., "event_id/")
        user_id: The user ID for permission verification
        
    Returns:
        bool: True if deletion was successful
    """
    supabase = get_user_supabase_client(user_id)
    try:
        print(f"🗑️ Listing files in {bucket}/{prefix}")
        
        # List files in the folder
        list_result = supabase.storage.from_(bucket).list(prefix)
        
        if hasattr(list_result, 'error') and list_result.error:
            print(f"❌ Failed to list files in {bucket}/{prefix}: {list_result.error}")
            return False
            
        files = list_result if isinstance(list_result, list) else []
        
        if not files:
            print(f"✅ No files found in {bucket}/{prefix}")
            return True
            
        print(f"🗑️ Found {len(files)} files to delete in {bucket}/{prefix}")
        
        # Delete files in batches
        file_paths = []
        for file_info in files:
            if isinstance(file_info, dict):
                file_name = file_info.get("name")
                if file_name:
                    file_paths.append(f"{prefix}{file_name}")
            else:
                # Handle case where file_info might be a string
                file_paths.append(f"{prefix}{file_info}")
        
        if file_paths:
            # Use remove method to delete multiple files
            delete_result = supabase.storage.from_(bucket).remove(file_paths)
            
            if hasattr(delete_result, 'error') and delete_result.error:
                print(f"❌ Failed to delete files in {bucket}/{prefix}: {delete_result.error}")
                return False
            
            print(f"✅ Successfully deleted {len(file_paths)} files from {bucket}/{prefix}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error deleting folder {bucket}/{prefix}: {str(e)}")
        # Fallback to direct API approach
        return await delete_storage_folder_fallback(bucket, prefix, user_id)


async def delete_storage_folder_fallback(bucket: str, prefix: str, user_id: str) -> bool:
    """
    Delete all files in a storage folder with given prefix
    
    Args:
        bucket: The storage bucket name
        prefix: The folder prefix (e.g., "event_id/")
        user_id: The user ID for permission verification
        
    Returns:
        bool: True if deletion was successful
    """
    try:
        delete_headers = {
            **headers,
            "x-user-id": user_id,
        }
        
        async with httpx.AsyncClient() as client:
            # List files in the folder first
            list_res = await client.get(
                f"{SUPABASE_URL}/storage/v1/object/list/{bucket}",
                headers=delete_headers,
                params={"prefix": prefix}
            )
            
            if list_res.status_code != 200:
                print(f"❌ Failed to list files in {bucket}/{prefix}: {list_res.status_code}")
                return False
                
            files = list_res.json()
            if not files:
                print(f"✅ No files found in {bucket}/{prefix}")
                return True
                
            print(f"🗑️ Found {len(files)} files to delete in {bucket}/{prefix}")
            
            # Delete each file
            success_count = 0
            for file_info in files:
                file_path = file_info.get("name")
                if not file_path:
                    continue
                    
                delete_res = await client.delete(
                    f"{SUPABASE_URL}/storage/v1/object/{bucket}/{file_path}",
                    headers=delete_headers
                )
                
                if delete_res.status_code in [200, 204, 404]:
                    success_count += 1
                    print(f"✅ Deleted {bucket}/{file_path}")
                else:
                    print(f"❌ Failed to delete {bucket}/{file_path}: {delete_res.status_code}")
            
            print(f"✅ Successfully deleted {success_count}/{len(files)} files from {bucket}/{prefix}")
            return success_count == len(files)
            
    except Exception as e:
        print(f"❌ Error deleting folder {bucket}/{prefix}: {str(e)}")
        return False


async def delete_event_storage_files_with_user_token(event_id: str, user_context) -> bool:
    """
    Delete all storage files associated with an event using user's JWT token for RLS compliance
    
    Args:
        event_id: The event ID
        user_context: UserContext object containing user_id and JWT token
        
    Returns:
        bool: True if all deletions were successful
    """
    try:
        print(f"🗑️ Deleting storage files for event {event_id} with user token")
        
        # Create headers with user's JWT token
        user_headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {user_context.token}",
        }
        
        # Delete audio files
        audio_success = await delete_storage_folder_with_user_token("audio", f"{event_id}/", user_headers)

        # Delete photo files
        photo_success = await delete_storage_folder_with_user_token("photos", f"{event_id}/", user_headers)
        
        return audio_success and photo_success
        
    except Exception as e:
        print(f"❌ Error deleting storage files for event {event_id}: {str(e)}")
        return False


async def delete_storage_folder_with_user_token(bucket: str, prefix: str, user_headers: dict) -> bool:
    """
    Delete all files in a storage folder using user's JWT token
    
    Args:
        bucket: The storage bucket name
        prefix: The folder prefix (e.g., "event_id/")
        user_headers: Headers containing user's JWT token
        
    Returns:
        bool: True if deletion was successful
    """
    try:
        print(f"🗑️ Deleting files in {bucket}/{prefix} with user token")
        
        async with httpx.AsyncClient() as client:
            # List files in the folder first
            list_res = await client.get(
                f"{SUPABASE_URL}/storage/v1/object/list/{bucket}",
                headers=user_headers,
                params={"prefix": prefix}
            )
            
            if list_res.status_code != 200:
                print(f"❌ Failed to list files in {bucket}/{prefix}: {list_res.status_code} - {list_res.text}")
                return False
                
            files = list_res.json()
            if not files:
                print(f"✅ No files found in {bucket}/{prefix}")
                return True
                
            print(f"🗑️ Found {len(files)} files to delete in {bucket}/{prefix}")
            
            # Delete each file
            success_count = 0
            for file_info in files:
                file_name = file_info.get("name")
                if not file_name:
                    continue
                
                # Construct full file path
                file_path = f"{prefix}{file_name}" if not file_name.startswith(prefix) else file_name
                    
                delete_res = await client.delete(
                    f"{SUPABASE_URL}/storage/v1/object/{bucket}/{file_path}",
                    headers=user_headers
                )
                
                if delete_res.status_code in [200, 204, 404]:
                    success_count += 1
                    print(f"✅ Deleted {bucket}/{file_path}")
                else:
                    print(f"❌ Failed to delete {bucket}/{file_path}: {delete_res.status_code} - {delete_res.text}")
            
            print(f"✅ Successfully deleted {success_count}/{len(files)} files from {bucket}/{prefix}")
            return success_count == len(files)
            
    except Exception as e:
        print(f"❌ Error deleting folder {bucket}/{prefix}: {str(e)}")
        return False
