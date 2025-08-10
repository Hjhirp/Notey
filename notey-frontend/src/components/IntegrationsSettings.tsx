import React, { useState } from 'react';
import GoogleDriveIntegration from './GoogleDriveIntegration';

interface IntegrationsSettingsProps {
  session: any;
  onClose: () => void;
}

const IntegrationsSettings: React.FC<IntegrationsSettingsProps> = ({ session, onClose }) => {
  const [exportResult, setExportResult] = useState<any>(null);

  const handleExportSuccess = (result: any) => {
    setExportResult(result);
    // Auto-clear success message after 5 seconds
    setTimeout(() => setExportResult(null), 5000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">Integrations & Settings</h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Export Success Message */}
          {exportResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center text-green-600 mb-2">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Export Successful!</span>
              </div>
              <p className="text-green-700 text-sm mb-2">
                Document: {exportResult.title}
              </p>
              <a
                href={exportResult.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in Google Docs
              </a>
            </div>
          )}

          {/* Google Drive Integration Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Cloud Storage</h2>
            <GoogleDriveIntegration 
              session={session} 
              onExportSuccess={handleExportSuccess}
            />
          </div>

          {/* Coming Soon Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Coming Soon</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Notion Integration */}
              <div className="bg-gray-50 rounded-lg p-4 opacity-60">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 bg-black rounded mr-3 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">N</span>
                  </div>
                  <h3 className="font-medium text-gray-700">Notion</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Export your notes and reports directly to Notion pages and databases.
                </p>
                <button
                  disabled
                  className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                >
                  Coming Soon
                </button>
              </div>

              {/* Slack Integration */}
              <div className="bg-gray-50 rounded-lg p-4 opacity-60">
                <div className="flex items-center mb-2">
                  <div className="w-8 h-8 bg-purple-500 rounded mr-3 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">#</span>
                  </div>
                  <h3 className="font-medium text-gray-700">Slack</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Share meeting summaries and insights directly to Slack channels.
                </p>
                <button
                  disabled
                  className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                >
                  Coming Soon
                </button>
              </div>
            </div>
          </div>

          {/* Help Section */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 mb-2">Need Help?</h3>
            <p className="text-sm text-blue-600 mb-3">
              Having trouble with integrations? Here are some common solutions:
            </p>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>• Make sure you're logged in to your Google account</li>
              <li>• Check that pop-ups are enabled for this site</li>
              <li>• Try refreshing the page if connection fails</li>
              <li>• Contact support if issues persist</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsSettings;
