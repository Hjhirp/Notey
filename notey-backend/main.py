from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
from src.routes import router

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Notey Backend API",
    description="Backend API for the Notey voice recording and transcription app",
    version="1.0.0"
)

# Configure CORS for production
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://notey-frontend.vercel.app",  # Add your Vercel frontend URL
    "https://*.vercel.app",  # Allow all Vercel preview deployments
]

# Allow all origins in development, specific origins in production
if os.getenv("ENVIRONMENT") == "production":
    allow_origins = origins
else:
    allow_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/")
async def health_check():
    return {"status": "healthy", "message": "Notey Backend API is running"}

@app.get("/health")
async def health():
    return {"status": "ok"}

# Include all routes
app.include_router(router)
