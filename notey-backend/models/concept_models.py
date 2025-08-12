from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from uuid import UUID


class ConceptMention(BaseModel):
    """Model for a concept mention within an audio chunk"""
    name: str = Field(..., min_length=1, max_length=200)
    score: float = Field(..., ge=0.1, le=5.0)
    from_sec: Optional[float] = Field(None, ge=0)
    to_sec: Optional[float] = Field(None, ge=0)
    
    @field_validator('name')
    def validate_name(cls, v):
        # Normalize concept name: lowercase, strip whitespace, remove quotes
        normalized = v.lower().strip().replace('"', '').replace("'", "")
        if len(normalized) < 1:
            raise ValueError("Concept name cannot be empty after normalization")
        return normalized
    
    @field_validator('to_sec')
    def validate_time_range(cls, v, values):
        if v is not None and 'from_sec' in values and values['from_sec'] is not None:
            if v <= values['from_sec']:
                raise ValueError("to_sec must be greater than from_sec")
        return v


class ConceptUpsertRequest(BaseModel):
    """Request model for upserting concepts for a chunk"""
    chunk_id: UUID
    mentions: List[ConceptMention] = Field(..., max_items=20)
    
    @field_validator('mentions')
    def validate_mentions(cls, v):
        if not v:
            raise ValueError("At least one mention is required")
        
        # Check for duplicate concept names
        names = [mention.name for mention in v]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate concept names are not allowed")
        
        return v


class ConceptUpsertResponse(BaseModel):
    """Response model for concept upsert operation"""
    ok: bool
    inserted: int
    message: Optional[str] = None


class GraphNode(BaseModel):
    """Model for a node in the concept graph"""
    id: str
    label: str
    type: str = Field(..., pattern="^(event|chunk|concept)$")
    metadata: Optional[dict] = None


class GraphLink(BaseModel):
    """Model for a link in the concept graph"""
    source: str
    target: str
    type: str = Field(..., pattern="^(HAS_AUDIO|MENTIONS|RELATED)$")
    score: Optional[float] = Field(1.0, ge=0.0, le=5.0)


class GraphExportResponse(BaseModel):
    """Response model for graph export"""
    nodes: List[GraphNode]
    links: List[GraphLink]


class ConceptRelation(BaseModel):
    """Model for concept-to-concept relationships"""
    src: UUID
    dst: UUID
    score: float = Field(1.0, ge=0.1, le=5.0)