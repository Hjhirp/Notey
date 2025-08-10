/**
 * Centralized API configuration to eliminate redundant BACKEND_URL declarations.
 * Replaces 7+ instances of "const BACKEND_URL = config.BACKEND_URL" across components.
 */

import config from '../config';

/**
 * Centralized API configuration class
 */
class ApiConfig {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.BACKEND_URL;
    
    // Validate URL at initialization
    if (!this.baseUrl) {
      console.error('VITE_BACKEND_URL environment variable is not set');
      throw new Error('Backend URL is required');
    }
  }

  /**
   * Get the base backend URL
   */
  get backendUrl(): string {
    return this.baseUrl;
  }

  /**
   * Build full URL for an endpoint
   */
  url(endpoint: string): string {
    // Handle both absolute and relative endpoints
    if (endpoint.startsWith('http')) {
      return endpoint;
    }
    
    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${normalizedEndpoint}`;
  }

  /**
   * Build URL with path parameters
   * Example: buildUrl('/events/{id}', { id: '123' }) => '/events/123'
   */
  buildUrl(template: string, params: Record<string, string | number> = {}): string {
    let url = template;
    
    // Replace path parameters
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, String(value));
    });
    
    return this.url(url);
  }

  /**
   * Pre-built endpoint URLs for common operations
   */
  readonly endpoints = {
    // Events
    events: () => this.url('/events'),
    startEvent: () => this.url('/events/start'),
    eventDetails: (eventId: string) => this.url(`/events/${eventId}`),
    eventTimeline: (eventId: string) => this.url(`/events/${eventId}/timeline`),
    uploadAudio: (eventId: string) => this.url(`/events/${eventId}/audio`),
    uploadPhoto: (eventId: string) => this.url(`/events/${eventId}/photo`),
    deleteEvent: (eventId: string) => this.url(`/events/${eventId}`),
    
    // Labels
    labels: () => this.url('/labels'),
    eventLabels: (eventId: string) => this.url(`/events/${eventId}/labels`),
    labelAttach: (labelId: string) => this.url(`/labels/${labelId}/attach`),
    labelDetach: (labelId: string) => this.url(`/labels/${labelId}/detach`),
    bulkLabelAttach: () => this.url('/labels/bulk-attach'),
    bulkLabelDetach: () => this.url('/labels/bulk-detach'),
    
    // Chat
    chatAsk: () => this.url('/chat/ask'),
    chatSessions: () => this.url('/chat/sessions'),
    chatSession: (sessionId: string) => this.url(`/chat/sessions/${sessionId}`),
    chatMessages: () => this.url('/chat/messages'),
    sessionMessages: (sessionId: string) => this.url(`/chat/sessions/${sessionId}/messages`),
    conceptNotes: (conceptName: string) => this.url(`/chat/concept/${encodeURIComponent(conceptName)}/notes`),
    conceptsSearch: () => this.url('/chat/concepts/search'),
    concepts: () => this.url('/chat/concepts'),
    conceptReportData: (conceptName: string) => this.url(`/chat/concept/${encodeURIComponent(conceptName)}/report-data`),
    
    // Assistant
    organize: () => this.url('/assistant/organize'),
    podcast: () => this.url('/assistant/podcast'),
    summarize: () => this.url('/assistant/summarize'),
    extractConcept: () => this.url('/assistant/extract-concept'),
    searchByConcept: () => this.url('/assistant/search-by-concept'),
    
    // Graph
    graphExport: () => this.url('/graph/export'),
    graphStats: () => this.url('/graph/stats'),
    chunkConcepts: (chunkId: string) => this.url(`/graph/chunk/${chunkId}/concepts`),
    
    // Audio
    audioChunks: () => this.url('/audio-chunks'),
    chunkDetails: (chunkId: string) => this.url(`/audio-chunks/${chunkId}`),
    chunkTranscript: (chunkId: string) => this.url(`/audio-chunks/${chunkId}/transcript`),
    chunkSummary: (chunkId: string) => this.url(`/audio-chunks/${chunkId}/summary`),
    
    // Photos
    photos: () => this.url('/photos'),
    photoDetails: (photoId: string) => this.url(`/photos/${photoId}`),
    photoLabels: (photoId: string) => this.url(`/photos/${photoId}/labels`),
  };

  /**
   * Create headers for API requests
   */
  headers(session?: any): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  /**
   * Create headers for file uploads
   */
  fileHeaders(session?: any): HeadersInit {
    const headers: HeadersInit = {};

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  /**
   * Get auth token from session
   */
  getAuthToken(session?: any): string | undefined {
    return session?.access_token;
  }
}

// Create singleton instance
export const apiConfig = new ApiConfig();

// Export convenience functions
export const buildApiUrl = (endpoint: string) => apiConfig.url(endpoint);
export const createApiHeaders = (session?: any) => apiConfig.headers(session);
export const createFileHeaders = (session?: any) => apiConfig.fileHeaders(session);
