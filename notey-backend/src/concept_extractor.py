import os
import google.generativeai as genai
from typing import List, Dict, Any
from dotenv import load_dotenv
import json
import logging

load_dotenv()

logger = logging.getLogger(__name__)

# Configure Google Gemini client
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = genai.GenerativeModel('gemini-2.0-flash-exp')

async def extract_concepts_from_transcript(transcript: str) -> List[Dict[str, Any]]:
    """
    Extract key concepts from a transcript using Gemini AI.
    
    Args:
        transcript: The transcribed text to analyze
        
    Returns:
        List of concept dictionaries with name and score
    """
    try:
        if not transcript or not transcript.strip():
            logger.warning("Empty transcript provided for concept extraction")
            return []
        
        # Craft a prompt that focuses on extracting meaningful concepts
        prompt = f"""
Analyze the following transcript and extract the key concepts, topics, and important entities mentioned. 
Focus on:
- Technical terms and jargon
- Product names and brands
- Skills and competencies
- Business concepts and methodologies
- Important people, places, or organizations
- Main topics discussed

Return ONLY a JSON array of concepts with this exact format:
[
  {{"name": "concept name", "score": 4.5}},
  {{"name": "another concept", "score": 3.2}}
]

Rules:
- Use lowercase for concept names
- Score from 1.0 to 5.0 based on importance/prominence in transcript
- Maximum 5 concepts
- No explanation, just the JSON array
- Skip common words like "the", "and", "is", "of", etc.

Transcript:
{transcript}
"""
        
        # Generate concepts using Gemini
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        # Clean up response to extract JSON
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith("```"):
            response_text = response_text[3:-3].strip()
        
        try:
            concepts = json.loads(response_text)
            
            # Validate and clean up concepts
            valid_concepts = []
            for concept in concepts[:10]:  # Limit to 10 concepts
                if isinstance(concept, dict) and "name" in concept and "score" in concept:
                    name = str(concept["name"]).lower().strip()
                    score = float(concept["score"])
                    
                    # Validate concept name and score
                    if name and len(name) >= 2 and 1.0 <= score <= 5.0:
                        valid_concepts.append({
                            "name": name,
                            "score": score,
                            "from_sec": None,
                            "to_sec": None
                        })
            
            logger.info(f"Extracted {len(valid_concepts)} concepts from transcript")
            return valid_concepts
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
            logger.debug(f"Raw response: {response_text}")
            return []
    
    except Exception as e:
        logger.error(f"Error extracting concepts from transcript: {e}")
        return []

async def extract_concepts_with_timestamps(transcript: str, audio_duration: float = None) -> List[Dict[str, Any]]:
    """
    Extract concepts with approximate timestamps (future enhancement).
    For now, returns concepts without timestamps.
    
    Args:
        transcript: The transcribed text to analyze
        audio_duration: Duration of audio in seconds (optional)
        
    Returns:
        List of concept dictionaries with name, score, and optional timestamps
    """
    # For now, just call the basic extraction
    # In the future, this could analyze transcript segments and estimate timestamps
    return await extract_concepts_from_transcript(transcript)