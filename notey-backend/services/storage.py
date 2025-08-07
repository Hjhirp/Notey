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
    return public_url
