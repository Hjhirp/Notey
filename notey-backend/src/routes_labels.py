from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from services.auth import verify_supabase_token
from . import database
import re

router = APIRouter(prefix="", tags=["labels"])


class LabelCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Label name")
    color: Optional[str] = Field(default="#8E8E93", description="Hex color code")
    icon: Optional[str] = Field(default="tag", description="Icon identifier")


class LabelUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Label name")
    color: Optional[str] = Field(None, description="Hex color code")
    icon: Optional[str] = Field(None, description="Icon identifier")


class LabelAttachRequest(BaseModel):
    entity_type: str = Field(..., description="Type of entity (e.g., 'event')")
    entity_id: str = Field(..., description="ID of the entity to attach label to")


class LabelDetachRequest(BaseModel):
    entity_type: str = Field(..., description="Type of entity (e.g., 'event')")
    entity_id: str = Field(..., description="ID of the entity to detach label from")


class BulkLabelAttachRequest(BaseModel):
    label_ids: List[str] = Field(..., description="List of label IDs to attach")
    entity_type: str = Field(..., description="Type of entities (e.g., 'event')")
    entity_ids: List[str] = Field(..., description="List of entity IDs to attach labels to")


class BulkLabelDetachRequest(BaseModel):
    label_ids: List[str] = Field(..., description="List of label IDs to detach")
    entity_type: str = Field(..., description="Type of entities (e.g., 'event')")
    entity_ids: List[str] = Field(..., description="List of entity IDs to detach labels from")


def validate_hex_color(color: str) -> bool:
    """Validate hex color format"""
    if not color:
        return False
    return bool(re.match(r'^#[0-9A-Fa-f]{6}$', color))


def validate_label_name(name: str) -> bool:
    """Validate label name format"""
    if not name or not name.strip():
        return False
    # Check for reasonable length and no special characters that could cause issues
    return len(name.strip()) <= 100 and not any(char in name for char in ['<', '>', '"', "'"])


def validate_entity_type(entity_type: str) -> bool:
    """Validate entity type"""
    allowed_types = ['event']  # Add more types as needed
    return entity_type in allowed_types


def validate_uuid(uuid_str: str) -> bool:
    """Validate UUID format"""
    try:
        uuid.UUID(uuid_str)
        return True
    except ValueError:
        return False


@router.post("/labels")
async def create_label(request: LabelCreateRequest, user_context = Depends(verify_supabase_token)):
    """Create a new label for the authenticated user"""
    
    # Validate input
    if not validate_label_name(request.name):
        raise HTTPException(
            status_code=400,
            detail="Invalid label name. Name must be 1-100 characters and not contain special characters."
        )
    
    if request.color and not validate_hex_color(request.color):
        raise HTTPException(
            status_code=400,
            detail="Invalid color format. Must be a valid hex color code (e.g., #FF0000)."
        )
    
    # Prepare label data
    label_data = {
        "user_id": user_context.user_id,
        "name": request.name.strip(),
        "color": request.color or "#8E8E93",
        "icon": request.icon or "tag"
    }
    
    try:
        result = await database.create_label(label_data)
        return result
    except Exception as e:
        error_msg = str(e).lower()
        if "unique" in error_msg or "duplicate" in error_msg:
            raise HTTPException(
                status_code=409,
                detail=f"A label with the name '{request.name}' already exists."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to create label. Please try again."
            )


@router.get("/labels")
async def get_labels(user_context = Depends(verify_supabase_token)):
    """Get all labels for the authenticated user"""
    
    try:
        labels = await database.get_user_labels(user_context.user_id)
        return labels
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve labels. Please try again."
        )


@router.patch("/labels/{label_id}")
async def update_label(label_id: str, request: LabelUpdateRequest, user_context = Depends(verify_supabase_token)):
    """Update an existing label"""
    
    # Validate label_id format
    try:
        uuid.UUID(label_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid label ID format."
        )
    
    # Validate input fields if provided
    if request.name is not None and not validate_label_name(request.name):
        raise HTTPException(
            status_code=400,
            detail="Invalid label name. Name must be 1-100 characters and not contain special characters."
        )
    
    if request.color is not None and not validate_hex_color(request.color):
        raise HTTPException(
            status_code=400,
            detail="Invalid color format. Must be a valid hex color code (e.g., #FF0000)."
        )
    
    # Build update data (only include fields that are provided)
    update_data = {}
    if request.name is not None:
        update_data["name"] = request.name.strip()
    if request.color is not None:
        update_data["color"] = request.color
    if request.icon is not None:
        update_data["icon"] = request.icon
    
    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="At least one field (name, color, or icon) must be provided for update."
        )
    
    try:
        result = await database.update_label(label_id, user_context.user_id, update_data)
        if not result:
            raise HTTPException(
                status_code=404,
                detail="Label not found or you don't have permission to update it."
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e).lower()
        if "unique" in error_msg or "duplicate" in error_msg:
            raise HTTPException(
                status_code=409,
                detail=f"A label with the name '{request.name}' already exists."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to update label. Please try again."
            )


@router.delete("/labels/{label_id}")
async def delete_label(label_id: str, user_context = Depends(verify_supabase_token)):
    """Delete a label and all its associations"""
    
    # Validate label_id format
    try:
        uuid.UUID(label_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid label ID format."
        )
    
    try:
        success = await database.delete_label(label_id, user_context.user_id)
        if not success:
            raise HTTPException(
                status_code=404,
                detail="Label not found or you don't have permission to delete it."
            )
        return {"message": "Label deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Failed to delete label. Please try again."
        )


@router.post("/labels/{label_id}/attach")
async def attach_label(label_id: str, request: LabelAttachRequest, user_context = Depends(verify_supabase_token)):
    """Attach a label to an entity"""
    
    # Validate label_id format
    if not validate_uuid(label_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid label ID format."
        )
    
    # Validate entity_type
    if not validate_entity_type(request.entity_type):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity type. Allowed types: event"
        )
    
    # Validate entity_id format
    if not validate_uuid(request.entity_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid entity ID format."
        )
    
    try:
        # Verify label ownership
        if not await database.verify_label_ownership(label_id, user_context.user_id):
            raise HTTPException(
                status_code=404,
                detail="Label not found or you don't have permission to use it."
            )
        
        # Verify entity exists and user owns it
        if not await database.verify_entity_exists_and_ownership(request.entity_type, request.entity_id, user_context.user_id):
            raise HTTPException(
                status_code=404,
                detail="Entity not found or you don't have permission to modify it."
            )
        
        # Attach the label
        result = await database.attach_label_to_entity(
            label_id, request.entity_type, request.entity_id, user_context.user_id
        )
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e).lower()
        if "already attached" in error_msg or "unique" in error_msg:
            raise HTTPException(
                status_code=409,
                detail="Label is already attached to this entity."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to attach label. Please try again."
            )


@router.delete("/labels/{label_id}/detach")
async def detach_label(label_id: str, request: LabelDetachRequest, user_context = Depends(verify_supabase_token)):
    """Detach a label from an entity"""
    
    # Validate label_id format
    if not validate_uuid(label_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid label ID format."
        )
    
    # Validate entity_type
    if not validate_entity_type(request.entity_type):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity type. Allowed types: event"
        )
    
    # Validate entity_id format
    if not validate_uuid(request.entity_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid entity ID format."
        )
    
    try:
        # Verify label ownership
        if not await database.verify_label_ownership(label_id, user_context.user_id):
            raise HTTPException(
                status_code=404,
                detail="Label not found or you don't have permission to use it."
            )
        
        # Verify entity exists and user owns it
        if not await database.verify_entity_exists_and_ownership(request.entity_type, request.entity_id, user_context.user_id):
            raise HTTPException(
                status_code=404,
                detail="Entity not found or you don't have permission to use it."
            )
        
        # Detach the label
        success = await database.detach_label_from_entity(
            label_id, request.entity_type, request.entity_id, user_context.user_id
        )
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail="Label is not attached to this entity."
            )
        
        return {"message": "Label detached successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Failed to detach label. Please try again."
        )


@router.post("/labels/bulk-attach")
async def bulk_attach_labels(request: BulkLabelAttachRequest, user_context = Depends(verify_supabase_token)):
    """Bulk attach multiple labels to multiple entities"""
    
    # Validate entity_type
    if not validate_entity_type(request.entity_type):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity type. Allowed types: event"
        )
    
    # Validate all label IDs
    for label_id in request.label_ids:
        if not validate_uuid(label_id):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid label ID format: {label_id}"
            )
    
    # Validate all entity IDs
    for entity_id in request.entity_ids:
        if not validate_uuid(entity_id):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid entity ID format: {entity_id}"
            )
    
    # Check for reasonable limits to prevent abuse
    if len(request.label_ids) > 50:
        raise HTTPException(
            status_code=400,
            detail="Too many labels. Maximum 50 labels per bulk operation."
        )
    
    if len(request.entity_ids) > 100:
        raise HTTPException(
            status_code=400,
            detail="Too many entities. Maximum 100 entities per bulk operation."
        )
    
    try:
        # Verify all labels are owned by the user
        for label_id in request.label_ids:
            if not await database.verify_label_ownership(label_id, user_context.user_id):
                raise HTTPException(
                    status_code=404,
                    detail=f"Label {label_id} not found or you don't have permission to use it."
                )
        
        # Verify all entities exist and are owned by the user
        for entity_id in request.entity_ids:
            if not await database.verify_entity_exists_and_ownership(request.entity_type, entity_id, user_context.user_id):
                raise HTTPException(
                    status_code=404,
                    detail=f"Entity {entity_id} not found or you don't have permission to modify it."
                )
        
        # Perform bulk attach
        result = await database.bulk_attach_labels_to_entities(
            request.label_ids, request.entity_type, request.entity_ids, user_context.user_id
        )
        
        return {
            "message": "Bulk attach completed",
            "created": result["created"],
            "requested": result["requested"],
            "errors": result["errors"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Failed to perform bulk attach. Please try again."
        )


@router.post("/labels/bulk-detach")
async def bulk_detach_labels(request: BulkLabelDetachRequest, user_context = Depends(verify_supabase_token)):
    """Bulk detach multiple labels from multiple entities"""
    
    # Validate entity_type
    if not validate_entity_type(request.entity_type):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity type. Allowed types: event"
        )
    
    # Validate all label IDs
    for label_id in request.label_ids:
        if not validate_uuid(label_id):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid label ID format: {label_id}"
            )
    
    # Validate all entity IDs
    for entity_id in request.entity_ids:
        if not validate_uuid(entity_id):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid entity ID format: {entity_id}"
            )
    
    # Check for reasonable limits to prevent abuse
    if len(request.label_ids) > 50:
        raise HTTPException(
            status_code=400,
            detail="Too many labels. Maximum 50 labels per bulk operation."
        )
    
    if len(request.entity_ids) > 100:
        raise HTTPException(
            status_code=400,
            detail="Too many entities. Maximum 100 entities per bulk operation."
        )
    
    try:
        # Verify all labels are owned by the user
        for label_id in request.label_ids:
            if not await database.verify_label_ownership(label_id, user_context.user_id):
                raise HTTPException(
                    status_code=404,
                    detail=f"Label {label_id} not found or you don't have permission to use it."
                )
        
        # Verify all entities exist and are owned by the user
        for entity_id in request.entity_ids:
            if not await database.verify_entity_exists_and_ownership(request.entity_type, entity_id, user_context.user_id):
                raise HTTPException(
                    status_code=404,
                    detail=f"Entity {entity_id} not found or you don't have permission to modify it."
                )
        
        # Perform bulk detach
        result = await database.bulk_detach_labels_from_entities(
            request.label_ids, request.entity_type, request.entity_ids, user_context.user_id
        )
        
        return {
            "message": "Bulk detach completed",
            "removed": result["removed"],
            "errors": result["errors"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Failed to perform bulk detach. Please try again."
        )