import { Label, LabelCreateRequest, LabelUpdateRequest, LabelLink, LabelWithCount, BulkAttachRequest } from '../types/labels';
import { apiConfig } from './apiConfig';

const BASE_URL = `${apiConfig.backendUrl}/labels`;

export const labelsApi = {
  // Create a new label
  async createLabel(request: LabelCreateRequest, session?: any): Promise<Label> {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: apiConfig.headers(session),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to create label: ${response.statusText}`);
    }

    return response.json();
  },

  // Get all labels for the current user
  async getLabels(session?: any): Promise<Label[]> {
    const response = await fetch(BASE_URL, {
      headers: apiConfig.headers(session),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch labels: ${response.statusText}`);
    }

    return response.json();
  },

  // Get labels with usage counts
  async getLabelsWithCounts(session?: any): Promise<LabelWithCount[]> {
    const response = await fetch(`${BASE_URL}/with-counts`, {
      headers: apiConfig.headers(session),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch labels with counts: ${response.statusText}`);
    }

    return response.json();
  },

  // Update a label
  async updateLabel(labelId: string, request: LabelUpdateRequest, session?: any): Promise<Label> {
    const response = await fetch(`${BASE_URL}/${labelId}`, {
      method: 'PUT',
      headers: apiConfig.headers(session),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to update label: ${response.statusText}`);
    }

    return response.json();
  },

  // Delete a label
  async deleteLabel(labelId: string, session?: any): Promise<void> {
    const response = await fetch(`${BASE_URL}/${labelId}`, {
      method: 'DELETE',
      headers: apiConfig.headers(session),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete label: ${response.statusText}`);
    }
  },

  // Get labels for a specific entity
  async getEntityLabels(entityType: string, entityId: string, session?: any): Promise<Label[]> {
    if (entityType === 'event') {
      const response = await fetch(`${apiConfig.backendUrl}/events/${entityId}/labels`, {
        headers: apiConfig.headers(session),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch entity labels: ${response.statusText}`);
      }

      return response.json();
    }
    
    throw new Error(`Entity type '${entityType}' is not supported for label retrieval`);
  },

  // Attach a label to an entity
  async attachLabel(labelId: string, entityType: string, entityId: string, session?: any): Promise<LabelLink> {
    const response = await fetch(`${BASE_URL}/${labelId}/attach`, {
      method: 'POST',
      headers: apiConfig.headers(session),
      body: JSON.stringify({
        entity_type: entityType,
        entity_id: entityId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to attach label: ${response.statusText}`);
    }

    return response.json();
  },

  // Bulk attach labels to an entity
  async bulkAttachLabels(request: BulkAttachRequest, session?: any): Promise<LabelLink[]> {
    const response = await fetch(`${BASE_URL}/bulk-attach`, {
      method: 'POST',
      headers: apiConfig.headers(session),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to bulk attach labels: ${response.statusText}`);
    }

    return response.json();
  },

  // Detach a label from an entity
  async detachLabel(labelId: string, entityType: string, entityId: string, session?: any): Promise<void> {
    const response = await fetch(`${BASE_URL}/${labelId}/detach`, {
      method: 'DELETE',
      headers: apiConfig.headers(session),
      body: JSON.stringify({
        entity_type: entityType,
        entity_id: entityId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to detach label: ${response.statusText}`);
    }
  },
};
