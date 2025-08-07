import google.generativeai as genai
import os
from fastapi import HTTPException
from pydantic import BaseModel


class SummaryRequest(BaseModel):
    transcript: str


# Configure Google Gemini client
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = genai.GenerativeModel('gemini-2.0-flash-exp')


async def summarize_transcript(transcript: str) -> str:
    """Summarize a transcript using Google Gemini 2.0-flash"""
    try:
        prompt = f"""You are a helpful assistant that creates concise, clear summaries of transcripts. Focus on the main points and key information.

Please summarize this transcript:

{transcript.strip()}

Provide a clear, concise summary highlighting the key points and main topics discussed."""

        response = model.generate_content(
            prompt,
            generation_config={
                "max_output_tokens": 256,
                "temperature": 0.5,
            }
        )
        
        summary = response.text.strip()
        return summary

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")
