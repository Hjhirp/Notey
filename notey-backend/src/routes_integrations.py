"""
API routes for external integrations (Google Docs, Notion, etc.)
Handles OAuth flows and export functionality.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from typing import Dict, Any, Optional
import logging
from uuid import UUID
from pydantic import BaseModel
import os

from .integrations.google_docs_service import google_docs_service
from .integrations.oauth_handler import oauth_handler
from services.auth import verify_supabase_token, UserContext

router = APIRouter(prefix="/integrations", tags=["integrations"])
logger = logging.getLogger(__name__)

class ExportRequest(BaseModel):
    report_data: Dict[str, Any]
    title: Optional[str] = None

class IntegrationStatus(BaseModel):
    provider: str
    connected: bool
    connected_at: Optional[str] = None
    last_updated: Optional[str] = None

@router.get("/status")
async def get_integration_status(
    user_context = Depends(verify_supabase_token)
) -> Dict[str, IntegrationStatus]:
    """Get status of all integrations for the current user"""
    try:
        user_id = str(user_context.user_id)
        integrations = await oauth_handler.get_user_integrations(user_id)
        
        # Add status for supported providers
        supported_providers = ["google_docs", "notion"]
        status = {}
        
        for provider in supported_providers:
            if provider in integrations:
                status[provider] = IntegrationStatus(
                    provider=provider,
                    connected=integrations[provider]["connected"],
                    connected_at=integrations[provider]["connected_at"],
                    last_updated=integrations[provider]["last_updated"]
                )
            else:
                status[provider] = IntegrationStatus(
                    provider=provider,
                    connected=False
                )
        
        return status
        
    except Exception as e:
        logger.error(f"Error getting integration status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get integration status: {str(e)}"
        )

@router.get("/auth/google")
async def initiate_google_auth(
    user_context = Depends(verify_supabase_token)
) -> Dict[str, str]:
    """Initiate Google OAuth flow"""
    try:
        user_id = str(user_context.user_id)
        auth_url = google_docs_service.get_auth_url(user_id)
        
        return {
            "auth_url": auth_url,
            "provider": "google_docs"
        }
        
    except Exception as e:
        logger.error(f"Error initiating Google auth: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initiate Google authentication: {str(e)}"
        )

@router.get("/callback/google")
async def google_oauth_callback(
    code: str,
    state: str,
    error: Optional[str] = None
):
    """Handle Google OAuth callback"""
    try:
        if error:
            logger.error(f"Google OAuth error: {error}")
            # Redirect to frontend with error
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            return RedirectResponse(url=f"{frontend_url}/settings/integrations?error={error}")
        
        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing authorization code or state")
        
        user_id = state  # state contains user_id
        
        # Exchange code for tokens
        tokens = google_docs_service.exchange_code_for_tokens(code, user_id)
        
        # Store tokens securely
        success = await oauth_handler.store_user_tokens(user_id, "google_docs", tokens)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to store authentication tokens")
        
        # Redirect to frontend with success
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/settings/integrations?success=google_connected")
        
    except Exception as e:
        logger.error(f"Error in Google OAuth callback: {e}")
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/settings/integrations?error=auth_failed")

@router.post("/export/google-docs")
async def export_to_google_docs(
    request: ExportRequest,
    user_context = Depends(verify_supabase_token)
) -> Dict[str, Any]:
    """Export report data to Google Docs"""
    try:
        user_id = str(user_context.user_id)
        
        # Get user's Google tokens
        tokens = await oauth_handler.get_user_tokens(user_id, "google_docs")
        
        if not tokens:
            raise HTTPException(
                status_code=401,
                detail="Google Docs integration not connected. Please connect your Google account first."
            )
        
        # Check if token is expired and refresh if needed
        if await oauth_handler.is_token_expired(tokens):
            if tokens.get("refresh_token"):
                try:
                    refreshed_tokens = google_docs_service.refresh_access_token(tokens["refresh_token"])
                    # Update stored tokens
                    updated_tokens = {**tokens, **refreshed_tokens}
                    await oauth_handler.store_user_tokens(user_id, "google_docs", updated_tokens)
                    tokens = updated_tokens
                except Exception as refresh_error:
                    logger.error(f"Failed to refresh Google tokens: {refresh_error}")
                    raise HTTPException(
                        status_code=401,
                        detail="Google authentication expired. Please reconnect your Google account."
                    )
            else:
                raise HTTPException(
                    status_code=401,
                    detail="Google authentication expired. Please reconnect your Google account."
                )
        
        # Create Google Doc
        result = google_docs_service.create_document_from_report(tokens, request.report_data)
        
        logger.info(f"Successfully exported report to Google Docs for user {user_id}")
        
        return {
            "success": True,
            "document_id": result["document_id"],
            "document_url": result["document_url"],
            "title": result["title"],
            "created_at": result["created_at"],
            "provider": "google_docs"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting to Google Docs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export to Google Docs: {str(e)}"
        )

@router.delete("/disconnect/{provider}")
async def disconnect_integration(
    provider: str,
    user_context = Depends(verify_supabase_token)
) -> Dict[str, Any]:
    """Disconnect an integration by deleting stored tokens"""
    try:
        user_id = str(user_context.user_id)
        
        if provider not in ["google_docs", "notion"]:
            raise HTTPException(status_code=400, detail="Unsupported provider")
        
        success = await oauth_handler.delete_user_tokens(user_id, provider)
        
        if success:
            return {
                "success": True,
                "message": f"Successfully disconnected {provider} integration",
                "provider": provider
            }
        else:
            return {
                "success": False,
                "message": f"No {provider} integration found to disconnect",
                "provider": provider
            }
        
    except Exception as e:
        logger.error(f"Error disconnecting integration: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to disconnect integration: {str(e)}"
        )
