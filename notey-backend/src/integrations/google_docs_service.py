"""
Google Docs integration service for exporting Notey reports.
Handles OAuth authentication and document creation via Google Docs API.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import httpx
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

class GoogleDocsService:
    """Service for integrating with Google Docs API"""
    
    def __init__(self):
        self.client_config = {
            "web": {
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/integrations/callback/google")]
            }
        }
        self.scopes = [
            'https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/drive.file'
        ]
    
    def get_auth_url(self, user_id: str) -> str:
        """Generate OAuth authorization URL for Google Docs access"""
        try:
            flow = Flow.from_client_config(
                self.client_config,
                scopes=self.scopes,
                redirect_uri=self.client_config["web"]["redirect_uris"][0]
            )
            
            # Include user_id in state for tracking
            auth_url, _ = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true',
                state=user_id
            )
            
            return auth_url
            
        except Exception as e:
            logger.error(f"Error generating Google auth URL: {e}")
            raise
    
    def exchange_code_for_tokens(self, code: str, user_id: str) -> Dict[str, Any]:
        """Exchange authorization code for access tokens"""
        try:
            flow = Flow.from_client_config(
                self.client_config,
                scopes=self.scopes,
                redirect_uri=self.client_config["web"]["redirect_uris"][0]
            )
            
            flow.fetch_token(code=code)
            credentials = flow.credentials
            
            return {
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_uri": credentials.token_uri,
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "scopes": credentials.scopes,
                "expiry": credentials.expiry.isoformat() if credentials.expiry else None
            }
            
        except Exception as e:
            logger.error(f"Error exchanging code for tokens: {e}")
            raise
    
    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh expired access token"""
        try:
            credentials = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri=self.client_config["web"]["token_uri"],
                client_id=self.client_config["web"]["client_id"],
                client_secret=self.client_config["web"]["client_secret"]
            )
            
            credentials.refresh(Request())
            
            return {
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "expiry": credentials.expiry.isoformat() if credentials.expiry else None
            }
            
        except Exception as e:
            logger.error(f"Error refreshing access token: {e}")
            raise
    
    def create_document_from_report(self, credentials_data: Dict[str, Any], report_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a Google Doc from Notey report data"""
        try:
            # Reconstruct credentials
            credentials = Credentials(
                token=credentials_data["access_token"],
                refresh_token=credentials_data.get("refresh_token"),
                token_uri=credentials_data["token_uri"],
                client_id=credentials_data["client_id"],
                client_secret=credentials_data["client_secret"],
                scopes=credentials_data["scopes"]
            )
            
            # Build Google Docs service
            docs_service = build('docs', 'v1', credentials=credentials)
            drive_service = build('drive', 'v3', credentials=credentials)
            
            # Create document title
            concept_name = report_data.get("concept", "Notey Report")
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            doc_title = f"Notey Report: {concept_name} - {timestamp}"
            
            # Create new document
            doc = docs_service.documents().create(body={'title': doc_title}).execute()
            doc_id = doc['documentId']
            
            # Prepare content for the document
            requests = self._build_document_content(report_data)
            
            # Update document with content
            if requests:
                docs_service.documents().batchUpdate(
                    documentId=doc_id,
                    body={'requests': requests}
                ).execute()
            
            # Get document URL
            doc_url = f"https://docs.google.com/document/d/{doc_id}/edit"
            
            logger.info(f"Successfully created Google Doc: {doc_title}")
            
            return {
                "document_id": doc_id,
                "document_url": doc_url,
                "title": doc_title,
                "created_at": datetime.now().isoformat()
            }
            
        except HttpError as e:
            logger.error(f"Google API error creating document: {e}")
            raise
        except Exception as e:
            logger.error(f"Error creating Google Doc: {e}")
            raise
    
    def _build_document_content(self, report_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Build Google Docs API requests for report content"""
        requests = []
        
        # Title
        concept_name = report_data.get("concept", "Report")
        requests.append({
            'insertText': {
                'location': {'index': 1},
                'text': f"Notey Report: {concept_name}\n\n"
            }
        })
        
        # Format title
        requests.append({
            'updateTextStyle': {
                'range': {'startIndex': 1, 'endIndex': len(f"Notey Report: {concept_name}") + 1},
                'textStyle': {
                    'bold': True,
                    'fontSize': {'magnitude': 18, 'unit': 'PT'}
                },
                'fields': 'bold,fontSize'
            }
        })
        
        current_index = len(f"Notey Report: {concept_name}\n\n") + 1
        
        # Summary section
        summary = report_data.get("summary", "No summary available.")
        summary_text = f"Summary\n{summary}\n\n"
        requests.append({
            'insertText': {
                'location': {'index': current_index},
                'text': summary_text
            }
        })
        
        # Format summary header
        requests.append({
            'updateTextStyle': {
                'range': {'startIndex': current_index, 'endIndex': current_index + 7},
                'textStyle': {
                    'bold': True,
                    'fontSize': {'magnitude': 14, 'unit': 'PT'}
                },
                'fields': 'bold,fontSize'
            }
        })
        
        current_index += len(summary_text)
        
        # Events section
        events = report_data.get("events", [])
        if events:
            events_header = "Events\n\n"
            requests.append({
                'insertText': {
                    'location': {'index': current_index},
                    'text': events_header
                }
            })
            
            # Format events header
            requests.append({
                'updateTextStyle': {
                    'range': {'startIndex': current_index, 'endIndex': current_index + 6},
                    'textStyle': {
                        'bold': True,
                        'fontSize': {'magnitude': 14, 'unit': 'PT'}
                    },
                    'fields': 'bold,fontSize'
                }
            })
            
            current_index += len(events_header)
            
            # Add each event
            for i, event in enumerate(events, 1):
                event_title = event.get("title", f"Event {i}")
                event_date = event.get("started_at", "Unknown date")
                event_transcript = event.get("transcript", "No transcript available.")
                photos_count = len(event.get("photos", []))
                
                event_text = f"{i}. {event_title}\n"
                event_text += f"Date: {event_date}\n"
                if photos_count > 0:
                    event_text += f"Photos: {photos_count} attached\n"
                event_text += f"Transcript:\n{event_transcript}\n\n"
                
                requests.append({
                    'insertText': {
                        'location': {'index': current_index},
                        'text': event_text
                    }
                })
                
                # Format event title
                requests.append({
                    'updateTextStyle': {
                        'range': {'startIndex': current_index, 'endIndex': current_index + len(f"{i}. {event_title}")},
                        'textStyle': {'bold': True},
                        'fields': 'bold'
                    }
                })
                
                current_index += len(event_text)
        
        # Footer
        footer_text = f"\n---\nGenerated by Notey on {datetime.now().strftime('%Y-%m-%d at %H:%M')}"
        requests.append({
            'insertText': {
                'location': {'index': current_index},
                'text': footer_text
            }
        })
        
        return requests

# Global instance
google_docs_service = GoogleDocsService()
