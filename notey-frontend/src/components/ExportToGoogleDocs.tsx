import React, { useState } from 'react';

interface ExportToGoogleDocsProps {
  session: any;
  conceptName?: string;
  eventIds?: string[];
  title?: string;
  buttonText?: string;
  className?: string;
  onExportStart?: () => void;
  onExportSuccess?: (result: any) => void;
  onExportError?: (error: string) => void;
}

const ExportToGoogleDocs: React.FC<ExportToGoogleDocsProps> = ({
  session,
  conceptName,
  eventIds,
  title,
  buttonText = "Export to Google Docs",
  className = "",
  onExportStart,
  onExportSuccess,
  onExportError
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!session?.access_token) {
      const errorMsg = "Please log in to export to Google Docs";
      setError(errorMsg);
      onExportError?.(errorMsg);
      return;
    }

    if (!conceptName && (!eventIds || eventIds.length === 0)) {
      const errorMsg = "No data to export";
      setError(errorMsg);
      onExportError?.(errorMsg);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      onExportStart?.();

      const exportData: any = {};
      if (conceptName) {
        exportData.concept_name = conceptName;
      }
      if (eventIds && eventIds.length > 0) {
        exportData.event_ids = eventIds;
      }
      if (title) {
        exportData.title = title;
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat/export/google-docs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(exportData),
      });

      if (response.ok) {
        const result = await response.json();
        onExportSuccess?.(result);
      } else {
        const errorData = await response.json();
        if (response.status === 401) {
          throw new Error("Google Docs not connected. Please connect your Google account first.");
        }
        throw new Error(errorData.detail || 'Export failed');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Export failed';
      setError(errorMsg);
      onExportError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-block">
      <button
        onClick={handleExport}
        disabled={loading}
        className={`inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Exporting...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            </svg>
            {buttonText}
          </>
        )}
      </button>
      
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default ExportToGoogleDocs;
