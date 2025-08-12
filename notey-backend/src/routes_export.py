"""
Export routes for Notey - handles Google Docs export functionality
"""

import logging
from typing import Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException

from services.auth import verify_supabase_token
from .database import get_event_details, get_entity_labels
from .integrations.google_docs_service import google_docs_service
from .integrations.oauth_handler import oauth_handler

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/events/{event_id}/export/google-docs")
async def export_event_to_google_docs(
    event_id: str,
    user_context = Depends(verify_supabase_token)
):
    """Export event data to Google Docs"""
    try:
        # Check if user has Google integration
        user_tokens = await oauth_handler.get_user_tokens(user_context.user_id, "google_docs")
        if not user_tokens:
            raise HTTPException(
                status_code=400, 
                detail="Google Docs integration not connected. Please connect your Google account first."
            )
        
        # Get event details
        event_details = await get_event_details(event_id)
        if not event_details:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Get event labels
        labels = await get_entity_labels("event", event_id, user_context.user_id)
        
        # Prepare report data in the format expected by create_document_from_report
        doc_title = "Notey Event Export"
        
        # Build labels summary
        labels_text = ""
        if labels:
            labels_text = "Labels: " + ", ".join([label['name'] for label in labels]) + "\n\n"
        
        # Build summary text
        summary_text = event_details.get('summary', 'No summary available for this event.')
        if labels_text:
            summary_text = labels_text + summary_text
        
        # Format event data for the report (use actual event title)
        event_title = event_details.get('title', 'Untitled Event')
        event_data = {
            "id": event_id,
            "title": event_title,  # Use actual event title from database
            "started_at": event_details.get('started_at', datetime.now().isoformat()),
            "transcript": event_details.get('transcript', 'No transcript available.'),
            "photos": event_details.get('photos', []),
            "audio_url": event_details.get('audio_url')  # Include audio URL for export
        }
        
        # Create report data structure
        report_data = {
            "concept": f"Notey Export: {event_title}",  # Use actual event title
            "summary": summary_text,
            "events": [event_data]
        }
        
        # Get user credentials for Google Docs API
        credentials_data = {
            "access_token": user_tokens.get("access_token"),
            "refresh_token": user_tokens.get("refresh_token"),
            "token_uri": user_tokens.get("token_uri"),
            "client_id": user_tokens.get("client_id"),
            "client_secret": user_tokens.get("client_secret"),
            "scopes": user_tokens.get("scopes", [])
        }
        
        # Create Google Doc using existing service instance
        result = await google_docs_service.create_document_from_report(credentials_data, report_data)
        
        # Extract the document URL from the result
        doc_url = result.get("document_url", "")
        
        return {
            "success": True,
            "document_url": doc_url,
            "message": "Event successfully exported to Google Docs"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting event {event_id} to Google Docs: {e}")
        raise HTTPException(status_code=500, detail="Failed to export event to Google Docs")
