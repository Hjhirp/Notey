from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
import logging
from uuid import UUID
from pydantic import BaseModel

from .supabase_client import supabase_client
from services.auth import verify_supabase_token, UserContext

router = APIRouter(prefix="/chat", tags=["chat_history"])
logger = logging.getLogger(__name__)

class ChatSessionCreate(BaseModel):
    title: str

class ChatMessageCreate(BaseModel):
    session_id: UUID
    type: str  # 'user' or 'bot'
    content: str
    sources: Optional[List[Dict[str, Any]]] = None
    related_concepts: Optional[List[str]] = None

class ChatSessionResponse(BaseModel):
    id: UUID
    title: str
    created_at: str
    updated_at: str
    message_count: int

class ChatMessageResponse(BaseModel):
    id: UUID
    type: str
    content: str
    sources: Optional[List[Dict[str, Any]]] = None
    related_concepts: Optional[List[str]] = None
    created_at: str

@router.get("/sessions")
async def get_chat_sessions(
    user_context = Depends(verify_supabase_token)
) -> List[ChatSessionResponse]:
    """Get all chat sessions for the current user."""
    try:
        # Get sessions with message counts
        sessions = await supabase_client.select(
            table="chat_sessions",
            columns="id,title,created_at,updated_at",
            filters={"user_id": f"eq.{user_context.user_id}"},
            order="updated_at.desc",
            user_token=user_context.token
        )
        
        result = []
        for session in sessions:
            # Get message count for each session
            messages = await supabase_client.select(
                table="chat_messages",
                columns="id",
                filters={
                    "session_id": f"eq.{session['id']}",
                    "user_id": f"eq.{user_context.user_id}"
                },
                user_token=user_context.token
            )
            
            result.append({
                "id": session["id"],
                "title": session["title"],
                "created_at": session["created_at"],
                "updated_at": session["updated_at"],
                "message_count": len(messages)
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting chat sessions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get chat sessions: {str(e)}"
        )

@router.post("/sessions")
async def create_chat_session(
    request: ChatSessionCreate,
    user_context = Depends(verify_supabase_token)
) -> Dict[str, Any]:
    """Create a new chat session."""
    try:
        session_data = {
            "user_id": str(user_context.user_id),
            "title": request.title
        }
        
        result = await supabase_client.insert(
            table="chat_sessions",
            data=session_data,
            user_token=user_context.token
        )
        
        return {"id": result[0]["id"], "title": request.title}
        
    except Exception as e:
        logger.error(f"Error creating chat session: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create chat session: {str(e)}"
        )

@router.get("/sessions/{session_id}/messages")
async def get_chat_messages(
    session_id: UUID,
    user_context = Depends(verify_supabase_token)
) -> List[ChatMessageResponse]:
    """Get all messages for a specific chat session."""
    try:
        # Verify session ownership
        sessions = await supabase_client.select(
            table="chat_sessions",
            columns="id",
            filters={
                "id": f"eq.{session_id}",
                "user_id": f"eq.{user_context.user_id}"
            },
            user_token=user_context.token
        )
        
        if not sessions:
            raise HTTPException(
                status_code=404,
                detail="Chat session not found"
            )
        
        # Get messages for this session
        messages = await supabase_client.select(
            table="chat_messages",
            columns="id,type,content,sources,related_concepts,created_at",
            filters={
                "session_id": f"eq.{session_id}",
                "user_id": f"eq.{user_context.user_id}"
            },
            order="created_at.asc",
            user_token=user_context.token
        )
        
        return messages
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat messages: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get chat messages: {str(e)}"
        )

@router.post("/messages")
async def create_chat_message(
    request: ChatMessageCreate,
    user_context = Depends(verify_supabase_token)
) -> Dict[str, Any]:
    """Create a new chat message."""
    try:
        # Verify session ownership
        sessions = await supabase_client.select(
            table="chat_sessions",
            columns="id",
            filters={
                "id": f"eq.{request.session_id}",
                "user_id": f"eq.{user_context.user_id}"
            },
            user_token=user_context.token
        )
        
        if not sessions:
            raise HTTPException(
                status_code=404,
                detail="Chat session not found"
            )
        
        message_data = {
            "session_id": str(request.session_id),
            "user_id": str(user_context.user_id),
            "type": request.type,
            "content": request.content,
            "sources": request.sources,
            "related_concepts": request.related_concepts
        }
        
        result = await supabase_client.insert(
            table="chat_messages",
            data=message_data,
            user_token=user_context.token
        )
        
        return {"id": result[0]["id"], "message": "Message created successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating chat message: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create chat message: {str(e)}"
        )

@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: UUID,
    user_context = Depends(verify_supabase_token)
) -> Dict[str, Any]:
    """Delete a chat session and all its messages."""
    try:
        # Verify session ownership and delete
        success = await supabase_client.delete(
            table="chat_sessions",
            filters={
                "id": f"eq.{session_id}",
                "user_id": f"eq.{user_context.user_id}"
            },
            user_token=user_context.token
        )
        
        if success:
            return {"message": "Chat session deleted successfully"}
        else:
            raise HTTPException(
                status_code=404,
                detail="Chat session not found"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat session: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete chat session: {str(e)}"
        )