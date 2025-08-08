from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import logging
from uuid import UUID

from models.concept_models import (
    ConceptUpsertRequest, 
    ConceptUpsertResponse,
    ConceptMention
)
from .supabase_client import supabase_client
from .database import verify_event_ownership
from services.auth import verify_supabase_token, UserContext

router = APIRouter(prefix="/concepts", tags=["concepts"])
logger = logging.getLogger(__name__)

async def verify_chunk_ownership(chunk_id: UUID, user_context: UserContext) -> bool:
    """Verify that the user owns the event associated with this chunk"""
    try:
        # Get the event_id for this chunk
        chunks = await supabase_client.select(
            table="audio_chunks",
            columns="event_id",
            filters={"id": f"eq.{chunk_id}"}
        )
        
        if not chunks:
            return False
            
        event_id = chunks[0]["event_id"]
        return await verify_event_ownership(event_id, user_context.user_id)
        
    except Exception as e:
        logger.error(f"Error verifying chunk ownership: {e}")
        return False

@router.post("/upsert", response_model=ConceptUpsertResponse)
async def upsert_concepts(
    request: ConceptUpsertRequest,
    user_context = Depends(verify_supabase_token)
) -> ConceptUpsertResponse:
    """
    Upsert concepts for an audio chunk.
    
    This endpoint:
    1. Verifies the user owns the chunk
    2. Upserts concepts by name (creates if doesn't exist)
    3. Upserts chunk_concepts relationships
    
    Returns the number of concepts inserted/updated.
    """
    try:
        # Verify chunk ownership
        if not await verify_chunk_ownership(request.chunk_id, user_context):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to modify concepts for this chunk"
            )
        
        inserted_count = 0
        
        # Process each concept mention
        for mention in request.mentions:
            # Upsert the concept (create if doesn't exist, get ID if exists)
            concept_data = {
                "name": mention.name,
                "user_id": str(user_context.user_id)
            }
            
            try:
                # Try to insert the concept with user_id
                concept_result = await supabase_client.insert(
                    table="concepts",
                    data=concept_data,
                    user_token=user_context.token
                )
                concept_id = concept_result[0]["id"]
                
            except Exception:
                # Concept already exists for this user, get its ID
                existing_concepts = await supabase_client.select(
                    table="concepts",
                    columns="id",
                    filters={
                        "name": f"eq.{mention.name}",
                        "user_id": f"eq.{user_context.user_id}"
                    },
                    user_token=user_context.token
                )
                
                if not existing_concepts:
                    logger.error(f"Failed to create or find concept for user: {mention.name}")
                    continue
                    
                concept_id = existing_concepts[0]["id"]
            
            # Upsert chunk_concept relationship
            chunk_concept_data = {
                "chunk_id": str(request.chunk_id),
                "concept_id": concept_id,
                "score": mention.score,
                "from_sec": mention.from_sec,
                "to_sec": mention.to_sec,
                "user_id": str(user_context.user_id)
            }
            
            try:
                await supabase_client.upsert(
                    table="chunk_concepts",
                    data=chunk_concept_data,
                    user_token=user_context.token
                )
                inserted_count += 1
                
            except Exception as e:
                logger.error(f"Failed to upsert chunk_concept: {e}")
                continue
        
        return ConceptUpsertResponse(
            ok=True,
            inserted=inserted_count,
            message=f"Successfully processed {inserted_count} concept mentions"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upsert_concepts: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/chunk/{chunk_id}")
async def get_chunk_concepts(
    chunk_id: UUID,
    user_context = Depends(verify_supabase_token)
) -> List[Dict[str, Any]]:
    """Get all concepts for a specific chunk"""
    try:
        # Verify chunk ownership
        if not await verify_chunk_ownership(chunk_id, user_context):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to view concepts for this chunk"
            )
        
        # Get concepts with their relationships to this chunk (user-specific)
        result = await supabase_client.select(
            table="chunk_concepts",
            columns="concepts(id,name),score,from_sec,to_sec,created_at",
            filters={
                "chunk_id": f"eq.{chunk_id}",
                "user_id": f"eq.{user_context.user_id}"
            },
            order="score.desc",
            user_token=user_context.token
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chunk concepts: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve chunk concepts"
        )

@router.delete("/chunk/{chunk_id}")
async def delete_chunk_concepts(
    chunk_id: UUID,
    user_context = Depends(verify_supabase_token)
) -> Dict[str, Any]:
    """Delete all concepts for a specific chunk"""
    try:
        # Verify chunk ownership
        if not await verify_chunk_ownership(chunk_id, user_context):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete concepts for this chunk"
            )
        
        # Delete chunk_concepts relationships (user-specific)
        success = await supabase_client.delete(
            table="chunk_concepts",
            filters={
                "chunk_id": f"eq.{chunk_id}",
                "user_id": f"eq.{user_context.user_id}"
            },
            user_token=user_context.token
        )
        
        if success:
            return {"ok": True, "message": "Chunk concepts deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete chunk concepts")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chunk concepts: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete chunk concepts"
        )