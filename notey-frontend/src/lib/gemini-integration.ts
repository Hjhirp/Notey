/**
 * Gemini Integration Hooks for Concept Extraction
 * 
 * This file provides utilities for integrating with Google's Gemini AI
 * to extract concepts from audio chunks and automatically populate
 * the concept graph.
 */

import { ConceptMention, ConceptUpsertRequest, buildConceptUpsertPayload, postConcepts } from './api';

// Types for Gemini API responses
export interface GeminiConceptResponse {
  mentions: ConceptMention[];
}

/**
 * The exact prompt to use with Gemini for concept extraction.
 * This is optimized for the concept graph requirements.
 */
export const GEMINI_CONCEPT_EXTRACTION_PROMPT = `Extract high-signal concepts from transcript and summary
You are an information extraction assistant. Read the inputs and output JSON for concept mentions.

Constraints:

Up to 20 items.

Prefer canonical multi-word terms over uninformative single words.

Include people and orgs if substantively discussed.

name must be lowercase, trimmed, ascii quotes removed.

score in [0.5, 5.0] measures relevance and specificity.

from_sec and to_sec are optional numbers if the time span is clear; otherwise null.

No extra keys. No commentary.

Return only:

{
  "mentions": [
    { "name": "voice biometrics", "score": 4.5, "from_sec": null, "to_sec": null }
  ]
}

Inputs:

chunk_id: {chunk_id}

summary: {summary}

transcript: {transcript}

Guidance: prefer domain terms like "speaker diarization", "whisper.cpp", "pgvector", "semantic search", "contrastive learning", "neo4j", "kùzu". Collapse near-duplicates to one canonical form. Exclude generic words. Lower the score if uncertain.`;

/**
 * Format the Gemini prompt with actual chunk data
 */
export function formatGeminiPrompt(
  chunkId: string,
  summary: string,
  transcript: string
): string {
  return GEMINI_CONCEPT_EXTRACTION_PROMPT
    .replace('{chunk_id}', chunkId)
    .replace('{summary}', summary || 'No summary available')
    .replace('{transcript}', transcript || 'No transcript available');
}

/**
 * Parse Gemini's JSON response into ConceptMention array
 * Includes validation and error handling
 */
export function parseGeminiResponse(responseText: string): ConceptMention[] {
  try {
    const parsed = JSON.parse(responseText);
    
    if (!parsed.mentions || !Array.isArray(parsed.mentions)) {
      throw new Error('Invalid response format: missing mentions array');
    }

    return parsed.mentions
      .filter((mention: any) => {
        // Basic validation
        return (
          mention.name && 
          typeof mention.name === 'string' && 
          mention.score && 
          typeof mention.score === 'number' &&
          mention.score >= 0.5 && 
          mention.score <= 5.0
        );
      })
      .map((mention: any) => ({
        name: mention.name.toLowerCase().trim().replace(/["""'']/g, ''),
        score: mention.score,
        from_sec: mention.from_sec || null,
        to_sec: mention.to_sec || null,
      }))
      .slice(0, 20); // Enforce max 20 items

  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    throw new Error(`Invalid JSON response from Gemini: ${error}`);
  }
}

/**
 * Complete workflow: Extract concepts and post to backend
 * 
 * This is the main integration point that your application should call
 * after getting a response from Gemini.
 * 
 * @param chunkId - UUID of the audio chunk
 * @param transcript - Full transcript text
 * @param summary - Summary text  
 * @param geminiResponse - Raw response text from Gemini API
 * @param session - User session for authentication
 * @returns Promise with the upsert result
 */
export async function extractAndUploadConcepts(
  chunkId: string,
  transcript: string,
  summary: string,
  geminiResponse: string,
  session?: any
) {
  try {
    // 1. Parse Gemini response
    const concepts = parseGeminiResponse(geminiResponse);
    
    if (concepts.length === 0) {
      console.warn(`No valid concepts extracted for chunk ${chunkId}`);
      return { ok: false, inserted: 0, message: 'No concepts extracted' };
    }

    // 2. Build payload
    const payload = buildConceptUpsertPayload(chunkId, transcript, summary, concepts);

    // 3. Post to backend
    const result = await postConcepts(payload, session);

    console.log(`Successfully uploaded ${result.inserted} concepts for chunk ${chunkId}`);
    return result;

  } catch (error) {
    console.error(`Failed to extract and upload concepts for chunk ${chunkId}:`, error);
    throw error;
  }
}

/**
 * Batch process multiple chunks with Gemini
 * Use this when you want to process multiple chunks at once
 */
export async function batchExtractConcepts(
  chunks: Array<{
    id: string;
    transcript: string;
    summary: string;
  }>,
  geminiApiCall: (prompt: string) => Promise<string>,
  session?: any,
  onProgress?: (completed: number, total: number) => void
) {
  const results = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      // 1. Generate prompt
      const prompt = formatGeminiPrompt(chunk.id, chunk.summary, chunk.transcript);
      
      // 2. Call Gemini API (provided by caller)
      const geminiResponse = await geminiApiCall(prompt);
      
      // 3. Extract and upload concepts
      const result = await extractAndUploadConcepts(
        chunk.id,
        chunk.transcript,
        chunk.summary,
        geminiResponse,
        session
      );
      
      results.push({ chunkId: chunk.id, ...result });
      
      if (onProgress) {
        onProgress(i + 1, chunks.length);
      }
      
      // Add small delay to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`Failed to process chunk ${chunk.id}:`, error);
      results.push({ 
        chunkId: chunk.id, 
        ok: false, 
        inserted: 0, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

/**
 * Example usage patterns:
 * 
 * // 1. Single chunk processing:
 * const prompt = formatGeminiPrompt(chunkId, summary, transcript);
 * const geminiResponse = await callYourGeminiAPI(prompt);
 * const result = await extractAndUploadConcepts(chunkId, transcript, summary, geminiResponse, session);
 * 
 * // 2. Batch processing:
 * const chunks = await getChunksNeedingConcepts();
 * const results = await batchExtractConcepts(
 *   chunks,
 *   async (prompt) => await callYourGeminiAPI(prompt),
 *   session,
 *   (completed, total) => console.log(`Progress: ${completed}/${total}`)
 * );
 * 
 * // 3. Manual concept creation (for testing):
 * const manualConcepts = [
 *   { name: "semantic search", score: 4.5, from_sec: null, to_sec: null },
 *   { name: "vector database", score: 3.8, from_sec: 120, to_sec: 180 }
 * ];
 * const payload = buildConceptUpsertPayload(chunkId, transcript, summary, manualConcepts);
 * const result = await postConcepts(payload, session);
 */

/**
 * Utility function to validate chunk data before sending to Gemini
 */
export function validateChunkForConceptExtraction(chunk: {
  id: string;
  transcript?: string;
  summary?: string;
}): { valid: boolean; reason?: string } {
  if (!chunk.id) {
    return { valid: false, reason: 'Missing chunk ID' };
  }

  if (!chunk.transcript && !chunk.summary) {
    return { valid: false, reason: 'Missing both transcript and summary' };
  }

  const totalLength = (chunk.transcript || '').length + (chunk.summary || '').length;
  if (totalLength < 10) {
    return { valid: false, reason: 'Content too short for meaningful concept extraction' };
  }

  if (totalLength > 50000) {
    return { valid: false, reason: 'Content too long - may exceed Gemini context limits' };
  }

  return { valid: true };
}