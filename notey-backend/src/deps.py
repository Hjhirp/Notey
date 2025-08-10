from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel
import jwt
import os
from typing import Optional

class ToolExecutionContext(BaseModel):
    user_token: str
    user_id: str | None = None
    base_url: str | None = None

async def get_user_context(authorization: str = Header(default=None)) -> ToolExecutionContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = authorization.split(" ", 1)[1]
    
    try:
        # Verify the JWT token and extract user_id
        # Note: In production, you should verify against your auth provider
        # For now, we'll extract user_id from the token if it's available
        user_id = None
        
        # Try to decode the token to extract user_id if it's a JWT
        try:
            # You would typically verify against your auth provider's public key
            # For now, we'll just decode without verification for development
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub") or payload.get("user_id")
        except jwt.InvalidTokenError:
            # Token is not a JWT, might be a custom token format
            pass
        
        return ToolExecutionContext(user_token=token, user_id=user_id)
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
