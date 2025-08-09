from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
import logging
from uuid import UUID
import sys
import os

# Add the parent directory to Python path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.concept_models import GraphExportResponse, GraphNode, GraphLink
from .supabase_client import supabase_client
from .database import verify_event_ownership
from services.auth import verify_supabase_token, UserContext

router = APIRouter(prefix="/graph", tags=["graph"])
logger = logging.getLogger(__name__)

@router.get("/export", response_model=GraphExportResponse)
async def export_graph(
    event_id: Optional[UUID] = Query(None, description="Filter by specific event ID"),
    limit: int = Query(500, ge=1, le=2000, description="Maximum number of nodes to return"),
    user_context = Depends(verify_supabase_token)
) -> GraphExportResponse:
    """
    Export graph data for 3d-force-graph visualization.
    
    Returns nodes (events, chunks, concepts) and links (relationships) for the user's data.
    If event_id is specified, only returns data for that event.
    """
    try:
        nodes: List[GraphNode] = []
        links: List[GraphLink] = []
        
        # Build base query filters
        base_filters = {"user_id": f"eq.{user_context.user_id}"}
        if event_id:
            # Verify event ownership if filtering by specific event
            if not await verify_event_ownership(str(event_id), user_context.user_id):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to view this event"
                )
            base_filters["id"] = f"eq.{event_id}"
        
        # 1. Get Events
        events = await supabase_client.select(
            table="events",
            columns="id,title,started_at,ended_at",
            filters=base_filters,
            order="started_at.desc",
            limit=limit // 3 if not event_id else None,  # Reserve space for chunks and concepts
            user_token=user_context.token
        )
        
        event_ids = [event["id"] for event in events]
        
        if not event_ids:
            return GraphExportResponse(nodes=[], links=[])
        
        # Add event nodes
        for event in events:
            # Use just the title, or "Untitled" if no title
            event_title = event.get('title', '').strip()
            label = event_title if event_title else "Untitled"
            
            nodes.append(GraphNode(
                id=f"event_{event['id']}",
                label=label,
                type="event",
                metadata={
                    "started_at": event.get("started_at"),
                    "ended_at": event.get("ended_at"),
                    "event_id": event["id"],
                    "title": event_title
                }
            ))
        
        # 2. Get Audio Chunks for these events
        if len(event_ids) > 1:
            chunk_filters = {"event_id": f"in.({','.join(event_ids)})"}
        else:
            chunk_filters = {"event_id": f"eq.{event_ids[0]}"}
            
        chunks = await supabase_client.select(
            table="audio_chunks",
            columns="id,event_id,start_time,length,transcript,summary",
            filters=chunk_filters,
            order="start_time.asc",
            user_token=user_context.token
        )
        
        chunk_ids = [chunk["id"] for chunk in chunks]
        # Skip adding chunk nodes - we want direct event->concept relationships
        
        # 3. Get Concepts mentioned in these chunks
        if chunk_ids:
            if len(chunk_ids) > 1:
                cc_filters = {"chunk_id": f"in.({','.join(chunk_ids)})"}
            else:
                cc_filters = {"chunk_id": f"eq.{chunk_ids[0]}"}
                
            # Add user_id filter to chunk_concepts query
            cc_filters["user_id"] = f"eq.{user_context.user_id}"
            
            chunk_concepts = await supabase_client.select(
                table="chunk_concepts",
                columns="chunk_id,concept_id,score,concepts(id,name)",
                filters=cc_filters,
                order="score.desc",
                limit=limit,
                user_token=user_context.token
            )
            
            # Track unique concepts and their event relationships
            concept_map = {}
            event_concept_links = {}  # Track event->concept relationships with aggregated scores
            
            for cc in chunk_concepts:
                concept = cc.get("concepts", {})
                if not concept:
                    continue
                    
                concept_id = concept["id"]
                concept_name = concept["name"]
                
                # Find the event this chunk belongs to
                chunk_event_id = None
                for chunk in chunks:
                    if chunk["id"] == cc["chunk_id"]:
                        chunk_event_id = chunk["event_id"]
                        break
                
                if not chunk_event_id:
                    continue
                
                # Add concept node (if not already added)
                if concept_id not in concept_map:
                    concept_map[concept_id] = True
                    nodes.append(GraphNode(
                        id=f"concept_{concept_id}",
                        label=concept_name,
                        type="concept",
                        metadata={
                            "concept_id": concept_id,
                            "name": concept_name
                        }
                    ))
                
                # Aggregate event->concept relationships
                event_concept_key = f"{chunk_event_id}_{concept_id}"
                if event_concept_key not in event_concept_links:
                    event_concept_links[event_concept_key] = {
                        "event_id": chunk_event_id,
                        "concept_id": concept_id,
                        "total_score": 0,
                        "mention_count": 0
                    }
                
                event_concept_links[event_concept_key]["total_score"] += cc.get("score", 1.0)
                event_concept_links[event_concept_key]["mention_count"] += 1
            
            # Create event->concept links
            for link_data in event_concept_links.values():
                # Average score across all mentions of this concept in this event
                avg_score = link_data["total_score"] / link_data["mention_count"]
                
                links.append(GraphLink(
                    source=f"event_{link_data['event_id']}",
                    target=f"concept_{link_data['concept_id']}",
                    type="MENTIONS",
                    score=avg_score
                ))
        
        # 4. Get concept-to-concept relations (if any exist)
        if concept_map:
            concept_ids = list(concept_map.keys())
            relations = await supabase_client.select(
                table="concept_relations",
                columns="src,dst,score",
                filters={
                    "src": f"in.({','.join(concept_ids)})" if len(concept_ids) > 1 else f"eq.{concept_ids[0]}"
                },
                order="score.desc",
                limit=100,
                user_token=user_context.token
            )
            
            for relation in relations:
                # Only include relations where both concepts are in our current set
                if relation["dst"] in concept_map:
                    links.append(GraphLink(
                        source=f"concept_{relation['src']}",
                        target=f"concept_{relation['dst']}",
                        type="RELATED",
                        score=relation.get("score", 1.0)
                    ))
        
        logger.info(f"Exported graph: {len(nodes)} nodes, {len(links)} links for user {user_context.user_id}")
        
        return GraphExportResponse(
            nodes=nodes,
            links=links
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting graph: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export graph data: {str(e)}"
        )

@router.get("/stats")
async def get_graph_stats(
    event_id: Optional[UUID] = Query(None, description="Filter by specific event ID"),
    user_context = Depends(verify_supabase_token)
) -> Dict[str, Any]:
    """Get statistics about the user's concept graph"""
    try:
        # Base filters
        base_filters = {"user_id": f"eq.{user_context.user_id}"}
        if event_id:
            if not await verify_event_ownership(str(event_id), user_context.user_id):
                raise HTTPException(status_code=403, detail="You don't have permission to view this event")
            base_filters["id"] = f"eq.{event_id}"
        
        # Count events
        events = await supabase_client.select(
            table="events",
            columns="id",
            filters=base_filters,
            user_token=user_context.token
        )
        event_count = len(events)
        event_ids = [e["id"] for e in events]
        
        if not event_ids:
            return {
                "events": 0,
                "chunks": 0,
                "concepts": 0,
                "concept_mentions": 0
            }
        
        # Count chunks
        chunk_filter = {"event_id": f"in.({','.join(event_ids)})"} if len(event_ids) > 1 else {"event_id": f"eq.{event_ids[0]}"}
        chunks = await supabase_client.select(
            table="audio_chunks",
            columns="id",
            filters=chunk_filter,
            user_token=user_context.token
        )
        chunk_count = len(chunks)
        chunk_ids = [c["id"] for c in chunks]
        
        # Count unique concepts and total mentions
        concept_count = 0
        mention_count = 0
        
        if chunk_ids:
            cc_filter = {"chunk_id": f"in.({','.join(chunk_ids)})"} if len(chunk_ids) > 1 else {"chunk_id": f"eq.{chunk_ids[0]}"}
            cc_filter["user_id"] = f"eq.{user_context.user_id}"
            
            chunk_concepts = await supabase_client.select(
                table="chunk_concepts",
                columns="concept_id",
                filters=cc_filter,
                user_token=user_context.token
            )
            
            mention_count = len(chunk_concepts)
            unique_concepts = set(cc["concept_id"] for cc in chunk_concepts)
            concept_count = len(unique_concepts)
        
        return {
            "events": event_count,
            "chunks": chunk_count,
            "concepts": concept_count,
            "concept_mentions": mention_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting graph stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get graph statistics")