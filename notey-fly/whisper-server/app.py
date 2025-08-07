from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import subprocess
import uuid
import os
import requests
import glob
import time
import logging
import asyncio
from pathlib import Path
import psutil

app = FastAPI()
WORK_DIR = "downloads"
os.makedirs(WORK_DIR, exist_ok=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def wait_for_file_complete(file_path: str, timeout: int = 60, check_interval: float = 0.5) -> bool:
    """
    Wait for a file to be completely written and stable.
    Returns True if file is ready, False if timeout.
    """
    end_time = time.time() + timeout
    last_size = -1
    stable_count = 0
    
    while time.time() < end_time:
        if os.path.exists(file_path):
            try:
                current_size = os.path.getsize(file_path)
                if current_size == last_size and current_size > 0:
                    stable_count += 1
                    if stable_count >= 3:  # File size stable for 3 checks
                        # Additional check: try to read the file
                        try:
                            with open(file_path, 'r') as f:
                                content = f.read()
                                if content.strip():  # Has actual content
                                    logger.info(f"File {file_path} is ready with {current_size} bytes")
                                    return True
                        except Exception as e:
                            logger.warning(f"File {file_path} exists but can't read: {e}")
                else:
                    stable_count = 0
                    last_size = current_size
                    logger.debug(f"File {file_path} size: {current_size} bytes")
            except OSError:
                pass  # File might be locked or partially written
        
        time.sleep(check_interval)
    
    logger.error(f"Timeout waiting for file {file_path}")
    return False

def sync_filesystem():
    """Force filesystem sync to ensure all writes are flushed."""
    try:
        os.sync()
    except Exception:
        pass  # sync() might not be available on all systems

@app.get("/")
async def root():
    return {"message": "Whisper transcription server is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "whisper-transcription"}

@app.get("/system")
async def system_info():
    """Get system resource information for debugging."""
    try:
        info = {
            "cpu_percent": psutil.cpu_percent(interval=1),
            "memory": {
                "total": psutil.virtual_memory().total,
                "available": psutil.virtual_memory().available,
                "percent": psutil.virtual_memory().percent
            },
            "disk": {
                "total": psutil.disk_usage('/').total,
                "free": psutil.disk_usage('/').free,
                "percent": psutil.disk_usage('/').percent
            },
            "downloads_dir": {
                "exists": os.path.exists(WORK_DIR),
                "files": len(os.listdir(WORK_DIR)) if os.path.exists(WORK_DIR) else 0
            }
        }
        return info
    except ImportError:
        return {"error": "psutil not available", "basic_info": {"work_dir_exists": os.path.exists(WORK_DIR)}}

@app.get("/system")
async def system_info():
    """Get system resource information for debugging."""
    try:
        import psutil
        info = {
            "cpu_percent": psutil.cpu_percent(interval=1),
            "memory": {
                "total": psutil.virtual_memory().total,
                "available": psutil.virtual_memory().available,
                "percent": psutil.virtual_memory().percent
            },
            "disk": {
                "total": psutil.disk_usage('/').total,
                "free": psutil.disk_usage('/').free,
                "percent": psutil.disk_usage('/').percent
            },
            "downloads_dir": {
                "exists": os.path.exists(WORK_DIR),
                "files": len(os.listdir(WORK_DIR)) if os.path.exists(WORK_DIR) else 0
            }
        }
        return info
    except ImportError:
        return {"error": "psutil not available", "basic_info": {"work_dir_exists": os.path.exists(WORK_DIR)}}

@app.get("/debug")
async def debug_files():
    info = {
        "whisper_cpp_contents": [],
        "whisper_binaries": [],
        "models": []
    }
    try:
        if os.path.exists("/app/whisper.cpp"):
            info["whisper_cpp_contents"] = os.listdir("/app/whisper.cpp")
        if os.path.exists("/app/whisper.cpp/build"):
            info["build_contents"] = os.listdir("/app/whisper.cpp/build")
        binary_patterns = [
            "/app/whisper.cpp/*main*",
            "/app/whisper.cpp/build/*main*",
            "/app/whisper.cpp/build/bin/*main*",
            "/app/whisper.cpp/examples/*main*"
        ]
        for pattern in binary_patterns:
            info["whisper_binaries"].extend(glob.glob(pattern))
        model_patterns = [
            "/app/whisper.cpp/models/*.bin",
            "/app/whisper.cpp/*.bin"
        ]
        for pattern in model_patterns:
            info["models"].extend(glob.glob(pattern))
    except Exception as e:
        info["error"] = str(e)
    return info

@app.post("/transcribe")
async def transcribe_from_url(request: Request):
    data = await request.json()
    audio_url = data.get("url")
    if not audio_url:
        raise HTTPException(status_code=400, detail="Missing 'url' field")

    audio_id = str(uuid.uuid4())
    webm_path = f"{WORK_DIR}/{audio_id}.webm"
    wav_path = f"{WORK_DIR}/{audio_id}.wav"
    txt_path = f"{WORK_DIR}/{audio_id}.txt"

    try:
        r = requests.get(audio_url)
        r.raise_for_status()
        with open(webm_path, "wb") as f:
            f.write(r.content)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Download failed: {str(e)}"})

    # 🔄 Convert to .wav using ffmpeg
    try:
        subprocess.run([
            "ffmpeg", "-i", webm_path, "-ar", "16000", "-ac", "1", wav_path
        ], check=True)
    except subprocess.CalledProcessError as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"FFmpeg conversion failed:\n{e.stderr}"}
        )

    # 🧠 Transcribe using whisper.cpp
    try:
        whisper_binary = "/app/whisper.cpp/build/bin/whisper-cli"
        model_path = "/app/whisper.cpp/models/ggml-base.en.bin"
        
        # Use absolute paths and ensure directory exists
        abs_work_dir = os.path.abspath(WORK_DIR)
        abs_wav_path = os.path.abspath(wav_path)
        output_prefix = os.path.join(abs_work_dir, audio_id)
        
        command = [
            whisper_binary,
            "-m", model_path,
            "-f", abs_wav_path,
            "-otxt",
            "-of", output_prefix,
            "--print-progress",  # Show progress for debugging
            "--no-timestamps"    # Cleaner output
        ]
        
        logger.info(f"Running whisper command: {' '.join(command)}")
        logger.info(f"Expected output file: {txt_path}")
        
        # Run with explicit timeout for longer files
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True,
            cwd="/app",
            timeout=300  # 5 minute timeout for long files
        )
        
        logger.info("✅ Whisper STDOUT:\n" + result.stdout)
        if result.stderr:
            logger.warning("⚠️ Whisper STDERR:\n" + result.stderr)
        
        # Force filesystem sync
        sync_filesystem()
        
        # Wait for the output file to be completely written
        if not wait_for_file_complete(txt_path, timeout=30):
            # Fallback: check if whisper output the text to stdout
            if result.stdout and result.stdout.strip():
                logger.info("Using stdout as fallback transcript")
                # Extract transcript from stdout (whisper often outputs it there)
                lines = result.stdout.split('\n')
                transcript_lines = []
                for line in lines:
                    line = line.strip()
                    # Skip progress indicators and metadata
                    if line and not line.startswith('[') and 'whisper_' not in line.lower():
                        transcript_lines.append(line)
                
                if transcript_lines:
                    transcript = ' '.join(transcript_lines)
                    # Save the transcript manually
                    try:
                        with open(txt_path, 'w') as f:
                            f.write(transcript)
                        sync_filesystem()
                        logger.info(f"Manually saved transcript to {txt_path}")
                    except Exception as e:
                        logger.error(f"Failed to manually save transcript: {e}")
                        return {"transcript": transcript.strip()}
                else:
                    return JSONResponse(
                        status_code=500, 
                        content={"error": "Transcript file not generated and no valid output in stdout"}
                    )
            else:
                return JSONResponse(
                    status_code=500, 
                    content={"error": "Transcript file not generated within timeout"}
                )
                
    except subprocess.TimeoutExpired:
        return JSONResponse(
            status_code=500,
            content={"error": "Whisper transcription timed out (5 minutes)"}
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"Whisper process failed: {e}")
        logger.error(f"Stderr: {e.stderr}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Whisper.cpp failed:\n{e.stderr}"}
        )

    # 📄 Read transcript with retry logic
    max_retries = 3
    for attempt in range(max_retries):
        if os.path.exists(txt_path):
            try:
                with open(txt_path, "r", encoding='utf-8') as f:
                    transcript = f.read().strip()
                
                if transcript:  # Non-empty transcript
                    logger.info(f"Successfully read transcript ({len(transcript)} chars)")
                    
                    # Cleanup temporary files
                    try:
                        os.remove(webm_path)
                        os.remove(wav_path)
                        # Keep txt file for debugging, or remove it:
                        # os.remove(txt_path)
                    except Exception:
                        pass  # Ignore cleanup errors
                    
                    return {"transcript": transcript}
                else:
                    logger.warning(f"Transcript file is empty, attempt {attempt + 1}")
                    
            except Exception as e:
                logger.error(f"Failed to read transcript (attempt {attempt + 1}): {e}")
        
        if attempt < max_retries - 1:
            time.sleep(1)  # Wait before retry
    
    return JSONResponse(
        status_code=500, 
        content={"error": f"Failed to read transcript after {max_retries} attempts"}
    )
