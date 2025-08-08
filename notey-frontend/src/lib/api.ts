// API helpers for concept graph functionality
import config from '../config';

const BACKEND_URL = config.BACKEND_URL;

export interface ConceptMention {
  name: string;
  score: number;
  from_sec?: number | null;
  to_sec?: number | null;
}

export interface ConceptUpsertRequest {
  chunk_id: string;
  mentions: ConceptMention[];
}

export interface ConceptUpsertResponse {
  ok: boolean;
  inserted: number;
  message?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'event' | 'chunk' | 'concept';
  metadata?: Record<string, any>;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'HAS_AUDIO' | 'MENTIONS' | 'RELATED';
  score?: number;
}

export interface GraphExportResponse {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphStats {
  events: number;
  chunks: number;
  concepts: number;
  concept_mentions: number;
}

/**
 * Post concepts for an audio chunk
 */
export async function postConcepts(
  payload: ConceptUpsertRequest,
  session?: any
): Promise<ConceptUpsertResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${BACKEND_URL}/concepts/upsert`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upsert concepts: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Export graph data for visualization
 */
export async function exportGraph(
  eventId?: string,
  limit: number = 500,
  session?: any
): Promise<GraphExportResponse> {
  const params = new URLSearchParams();
  if (eventId) {
    params.append('event_id', eventId);
  }
  params.append('limit', limit.toString());

  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${BACKEND_URL}/graph/export?${params}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to export graph: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Get graph statistics
 */
export async function getGraphStats(
  eventId?: string,
  session?: any
): Promise<GraphStats> {
  const params = new URLSearchParams();
  if (eventId) {
    params.append('event_id', eventId);
  }

  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${BACKEND_URL}/graph/stats?${params}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get graph stats: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Get concepts for a specific chunk
 */
export async function getChunkConcepts(
  chunkId: string,
  session?: any
): Promise<any[]> {
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${BACKEND_URL}/concepts/chunk/${chunkId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get chunk concepts: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Pure function to build concept upsert payload from Gemini output
 * 
 * @param chunkId - UUID of the audio chunk
 * @param transcript - Full transcript text (unused in payload but needed for Gemini)
 * @param summary - Summary text (unused in payload but needed for Gemini)
 * @param concepts - Concepts extracted by Gemini
 * @returns ConceptUpsertRequest payload ready for POST /concepts/upsert
 */
export function buildConceptUpsertPayload(
  chunkId: string,
  transcript: string,
  summary: string,
  concepts: ConceptMention[]
): ConceptUpsertRequest {
  return {
    chunk_id: chunkId,
    mentions: concepts.map(concept => ({
      name: concept.name,
      score: concept.score,
      from_sec: concept.from_sec || null,
      to_sec: concept.to_sec || null,
    })),
  };
}

/**
 * Example Gemini integration hook
 * 
 * Usage after getting concepts from Gemini:
 * 
 * ```typescript
 * // 1. Call Gemini with transcript and summary
 * const geminiResponse = await callGemini(transcript, summary);
 * 
 * // 2. Build payload
 * const payload = buildConceptUpsertPayload(chunkId, transcript, summary, geminiResponse.mentions);
 * 
 * // 3. Post to backend
 * const result = await postConcepts(payload, session);
 * ```
 */