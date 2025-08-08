import { useState } from 'react';
import type { Session } from "@supabase/supabase-js";
import { ReportGenerator as PDFGenerator, ReportData, ReportEvent } from '../utils/reportGenerator';
import config from '../config';

const BACKEND_URL = config.BACKEND_URL;

interface ReportGeneratorProps {
  session: Session | null;
  concept?: string;
  onClose?: () => void;
}

export default function ReportGenerator({ session, concept, onClose }: ReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState(concept || '');
  const [availableConcepts, setAvailableConcepts] = useState<string[]>([]);
  const [searchingConcepts, setSearchingConcepts] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const searchConcepts = async (query: string) => {
    if (!session?.access_token || query.length < 2) {
      setAvailableConcepts([]);
      return;
    }

    setSearchingConcepts(true);
    try {
      const response = await fetch(`${BACKEND_URL}/chat/concepts/search?q=${encodeURIComponent(query)}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const concepts = await response.json();
        setAvailableConcepts(concepts.map((c: any) => c.name));
      }
    } catch (error) {
      console.error('Error searching concepts:', error);
    } finally {
      setSearchingConcepts(false);
    }
  };

  const generateReport = async () => {
    if (!session?.access_token || !selectedConcept.trim()) {
      setError('Please select a concept to generate a report');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // 1. Fetch report data from backend
      const response = await fetch(
        `${BACKEND_URL}/chat/concept/${encodeURIComponent(selectedConcept)}/report-data`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch report data: ${response.status} ${response.statusText}`);
      }

      const data: ReportData = await response.json();

      if (!data.events || data.events.length === 0) {
        setError(`No events found for the concept "${selectedConcept}". Try a different concept.`);
        return;
      }

      // 2. Set report data and show preview
      setReportData(data);
      setShowPreview(true);

    } catch (error) {
      console.error('Error generating report:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadReport = async () => {
    if (!reportData) return;

    setIsDownloading(true);
    try {
      const pdfGenerator = new PDFGenerator();
      await pdfGenerator.downloadReport(reportData);
      
      // Close the modal after successful download
      if (onClose) {
        setTimeout(onClose, 1000);
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      setError('Failed to download report');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConceptChange = (value: string) => {
    setSelectedConcept(value);
    if (value.length >= 2) {
      searchConcepts(value);
    } else {
      setAvailableConcepts([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-notey-orange to-notey-orange/80 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center">
              📊 Generate Report
            </h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors p-1"
                disabled={isGenerating}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            {/* Description */}
            <div className="text-sm text-slate-600">
              Generate a comprehensive PDF report for a specific concept, including all related events, transcripts, and photos.
            </div>

            {/* Concept Input */}
            <div>
              <label htmlFor="concept" className="block text-sm font-medium text-slate-700 mb-2">
                Select Concept
              </label>
              <div className="relative">
                <input
                  id="concept"
                  type="text"
                  value={selectedConcept}
                  onChange={(e) => handleConceptChange(e.target.value)}
                  placeholder="Type to search for concepts..."
                  disabled={isGenerating}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-notey-orange focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {searchingConcepts && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin w-4 h-4 border-2 border-notey-orange border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>

              {/* Concept suggestions */}
              {availableConcepts.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto border border-slate-200 rounded-lg">
                  {availableConcepts.map((conceptName, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedConcept(conceptName);
                        setAvailableConcepts([]);
                      }}
                      disabled={isGenerating}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm text-slate-700 disabled:opacity-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {conceptName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Report preview info */}
            {selectedConcept && !error && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <div className="font-medium mb-1">Report will include:</div>
                <ul className="text-xs space-y-1">
                  <li>• Summary of "{selectedConcept}" across all events</li>
                  <li>• Complete transcripts from related recordings</li>
                  <li>• Photo references with timestamps</li>
                  <li>• Beautifully formatted PDF document</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 rounded-b-2xl flex justify-end space-x-3">
          {onClose && (
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          )}
          
          <button
            onClick={generateReport}
            disabled={isGenerating || !selectedConcept.trim()}
            className="px-6 py-2 bg-notey-orange text-white font-semibold rounded-lg hover:bg-notey-orange/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Generate PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}