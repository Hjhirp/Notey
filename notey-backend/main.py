from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from src.routes import router

# Load environment variables
load_dotenv()

app = FastAPI()

# Allow local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or replace * with ["http://localhost:5173"] for tighter security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routes
app.include_router(router)
