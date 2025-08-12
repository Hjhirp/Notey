import { ReportGenerator, ReportEvent, ReportData } from './reportGenerator';
import config from '../config';

const BACKEND_URL = config.BACKEND_URL;

export interface EventExportData {
  id: string;
  title?: string;
  started_at: string;
  transcript?: string;
  summary?: string;
  photos?: {
    id: string;
    photo_url: string;
    offset_seconds: number;
  }[];
  labels?: {
    id: string;
    name: string;
    color: string;
  }[];
}

export class EventExporter {
  /**
   * Export a single event to PDF using the existing report generator
   */
  static async exportEventToPDF(eventData: EventExportData): Promise<void> {
    try {
      // Transform event data to match ReportEvent interface
      const eventTitle = eventData.title || 'Untitled Event';
      const reportEvent: ReportEvent = {
        id: eventData.id,
        title: eventTitle,
        started_at: eventData.started_at,
        transcript: eventData.transcript || 'No transcript available.',
        photos: (eventData.photos || []).map(photo => ({
          id: photo.id,
          url: photo.photo_url,
          offset_seconds: photo.offset_seconds
        }))
      };

      // Create report data structure for PDF export
      const reportData: ReportData = {
        concept: `Notey Export: ${eventTitle}`, // Use actual event title
        summary: eventData.summary || 'Individual event export from Notey',
        events: [reportEvent]
      };

      // Generate and download PDF using existing report generator
      const generator = new ReportGenerator();
      // Use event title for filename, fallback to event ID if no title
      const titleForFilename = (eventData.title || 'Untitled Event')
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .toLowerCase();
      const filename = `notey-${titleForFilename}-${new Date().toISOString().split('T')[0]}.pdf`;
      await generator.downloadReport(reportData, filename);
      
    } catch (error) {
      console.error('Error exporting event to PDF:', error);
      throw new Error('Failed to export event to PDF');
    }
  }

  /**
   * Export event to Google Docs
   */
  static async exportEventToGoogleDocs(eventId: string, accessToken: string): Promise<string> {
    try {
      const response = await fetch(`${BACKEND_URL}/events/${eventId}/export/google-docs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to export to Google Docs');
      }

      const result = await response.json();
      return result.document_url;
      
    } catch (error) {
      console.error('Error exporting event to Google Docs:', error);
      throw error;
    }
  }

  /**
   * Fetch event details for export
   */
  static async fetchEventDetails(eventId: string, accessToken: string): Promise<EventExportData> {
    try {
      // Fetch event details
      const eventResponse = await fetch(`${BACKEND_URL}/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!eventResponse.ok) {
        throw new Error('Failed to fetch event details');
      }

      const eventDetails = await eventResponse.json();

      // Fetch event labels
      const labelsResponse = await fetch(`${BACKEND_URL}/events/${eventId}/labels`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      let labels = [];
      if (labelsResponse.ok) {
        labels = await labelsResponse.json();
      }

      // Combine data
      return {
        id: eventId,
        title: eventDetails.title || `Event ${eventId}`,
        started_at: eventDetails.started_at || new Date().toISOString(),
        transcript: eventDetails.transcript,
        summary: eventDetails.summary,
        photos: eventDetails.photos || [],
        labels: labels || []
      };

    } catch (error) {
      console.error('Error fetching event details:', error);
      throw new Error('Failed to fetch event details for export');
    }
  }
}
