"""
OAuth handler for managing user authentication with external services.
Stores and retrieves user tokens securely.
"""

import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import httpx
from ..supabase_client import supabase_client

logger = logging.getLogger(__name__)

class OAuthHandler:
    """Handle OAuth flows and token management for integrations"""
    
    def __init__(self):
        self.supabase = supabase_client
    
    async def store_user_tokens(self, user_id: str, provider: str, tokens: Dict[str, Any]) -> bool:
        """Store user OAuth tokens securely in database"""
        try:
            # Encrypt sensitive data (in production, use proper encryption)
            token_data = {
                "user_id": user_id,
                "provider": provider,
                "access_token": tokens.get("access_token"),
                "refresh_token": tokens.get("refresh_token"),
                "token_uri": tokens.get("token_uri"),
                "client_id": tokens.get("client_id"),
                "client_secret": tokens.get("client_secret"),
                "scopes": json.dumps(tokens.get("scopes", [])),
                "expires_at": tokens.get("expiry"),
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            # Check if tokens already exist for this user and provider
            existing = await self.get_user_tokens(user_id, provider)
            
            if existing:
                # Update existing tokens
                filters = {"user_id": f"eq.{user_id}", "provider": f"eq.{provider}"}
                response = await self.supabase.update("user_integrations", token_data, filters)
            else:
                # Insert new tokens
                response = await self.supabase.insert("user_integrations", token_data)
            
            if response:
                logger.info(f"Successfully stored tokens for user {user_id} and provider {provider}")
                return True
            else:
                logger.error(f"Failed to store tokens: {response}")
                return False
                
        except Exception as e:
            logger.error(f"Error storing user tokens: {e}")
            return False
    
    async def get_user_tokens(self, user_id: str, provider: str) -> Optional[Dict[str, Any]]:
        """Retrieve user OAuth tokens from database"""
        try:
            filters = {"user_id": f"eq.{user_id}", "provider": f"eq.{provider}"}
            response = await self.supabase.select("user_integrations", "*", filters)
            
            if response and len(response) > 0:
                token_data = response[0]
                
                # Parse scopes back to list
                if token_data.get("scopes"):
                    token_data["scopes"] = json.loads(token_data["scopes"])
                
                return token_data
            
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving user tokens: {e}")
            return None
    
    async def delete_user_tokens(self, user_id: str, provider: str) -> bool:
        """Delete user OAuth tokens (for disconnecting integrations)"""
        try:
            filters = {"user_id": f"eq.{user_id}", "provider": f"eq.{provider}"}
            response = await self.supabase.delete("user_integrations", filters)
            
            if response:
                logger.info(f"Successfully deleted {provider} tokens for user {user_id}")
                return True
            else:
                logger.warning(f"No {provider} tokens found for user {user_id} to delete")
                return False
                
        except Exception as e:
            logger.error(f"Error deleting user tokens: {e}")
            return False
    
    async def is_token_expired(self, token_data: Dict[str, Any]) -> bool:
        """Check if access token is expired"""
        try:
            expires_at = token_data.get("expires_at")
            if not expires_at:
                return False
            
            expiry_time = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            current_time = datetime.now(expiry_time.tzinfo)
            
            # Consider token expired if it expires within 5 minutes
            return current_time >= (expiry_time - timedelta(minutes=5))
            
        except Exception as e:
            logger.error(f"Error checking token expiry: {e}")
            return True  # Assume expired on error
    
    async def get_user_integrations(self, user_id: str) -> Dict[str, Any]:
        """Get all integrations for a user"""
        try:
            filters = {"user_id": f"eq.{user_id}"}
            response = await self.supabase.select("user_integrations", "provider, created_at, updated_at", filters)
            
            integrations = {}
            if response:
                for integration in response:
                    integrations[integration["provider"]] = {
                        "connected": True,
                        "connected_at": integration["created_at"],
                        "last_updated": integration["updated_at"]
                    }
            
            return integrations
            
        except Exception as e:
            logger.error(f"Error getting user integrations: {e}")
            return {}

# Global instance
oauth_handler = OAuthHandler()
