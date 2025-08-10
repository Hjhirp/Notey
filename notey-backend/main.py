from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
from src.routes import router
from src.routes_concepts import router as concepts_router
from src.routes_graph import router as graph_router
from src.routes_chat import router as chat_router
from src.routes_chat_history import router as chat_history_router
from src.routes_labels import router as labels_router
from src.routes_integrations import router as integrations_router

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
    "https://notey-cmvf.vercel.app",  # Your actual Vercel frontend URL
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
app.include_router(concepts_router)
app.include_router(graph_router)
app.include_router(chat_router)
app.include_router(chat_history_router)
app.include_router(labels_router)
app.include_router(integrations_router)
