import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface IntegrationStatus {
  provider: string;
  connected: boolean;
  connected_at?: string;
  last_updated?: string;
}

interface GoogleDriveIntegrationProps {
  session: any;
  onExportSuccess?: (result: any) => void;
}

const GoogleDriveIntegration: React.FC<GoogleDriveIntegrationProps> = ({ 
  session, 
  onExportSuccess 
}) => {
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check integration status on component mount
  useEffect(() => {
    checkIntegrationStatus();
  }, [session]);

  const checkIntegrationStatus = async () => {
    if (!session?.access_token) return;

    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/integrations/status`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIntegrationStatus(data.google_docs || { provider: 'google_docs', connected: false });
      } else {
        throw new Error('Failed to check integration status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status');
    } finally {
      setLoading(false);
    }
  };

  const connectGoogleDrive = async () => {
    if (!session?.access_token) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/integrations/auth/google`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to Google OAuth
        window.location.href = data.auth_url;
      } else {
        throw new Error('Failed to initiate Google authentication');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setLoading(false);
    }
  };

  const disconnectGoogleDrive = async () => {
    if (!session?.access_token) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/integrations/disconnect/google_docs`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setSuccess('Successfully disconnected from Google Drive');
        setIntegrationStatus({ provider: 'google_docs', connected: false });
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const exportToGoogleDocs = async (exportData: { concept_name?: string; event_ids?: string[]; title?: string }) => {
    if (!session?.access_token || !integrationStatus?.connected) return;

    try {
      setLoading(true);
      setError(null);
      
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
        setSuccess(`Successfully exported to Google Docs: ${result.title}`);
        onExportSuccess?.(result);
        return result;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Export failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth callback (check URL parameters)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success === 'google_connected') {
      setSuccess('Successfully connected to Google Drive!');
      checkIntegrationStatus();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      setError(`Authentication failed: ${error}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  if (loading && !integrationStatus) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Checking connection status...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <div className="flex items-center mb-4">
        <svg className="w-8 h-8 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6.5 2L3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6l-3.5-4h-11zm0 2h11L20 6v14H4V6l2.5-2z"/>
          <path d="M9.5 8.5L12 11l2.5-2.5L16 10l-4 4-4-4 1.5-1.5z"/>
        </svg>
        <h2 className="text-xl font-semibold text-gray-800">Google Drive Integration</h2>
      </div>

      {/* Status Display */}
      <div className="mb-4">
        {integrationStatus?.connected ? (
          <div className="flex items-center text-green-600 bg-green-50 p-3 rounded-lg">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">Connected to Google Drive</p>
              {integrationStatus.connected_at && (
                <p className="text-sm text-green-500">
                  Connected: {new Date(integrationStatus.connected_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center text-gray-600 bg-gray-50 p-3 rounded-lg">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="font-medium">Not connected to Google Drive</p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center text-red-600">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Success Display */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center text-green-600">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">{success}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {integrationStatus?.connected ? (
          <>
            <button
              onClick={disconnectGoogleDrive}
              disabled={loading}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Disconnecting...' : 'Disconnect Google Drive'}
            </button>
            <button
              onClick={checkIntegrationStatus}
              disabled={loading}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Refresh Status
            </button>
          </>
        ) : (
          <button
            onClick={connectGoogleDrive}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.5 2L3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6l-3.5-4h-11z"/>
                </svg>
                Connect Google Drive
              </>
            )}
          </button>
        )}
      </div>

      {/* Info Section */}
      <div className="mt-6 p-3 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-2">What you can do:</h3>
        <ul className="text-sm text-blue-600 space-y-1">
          <li>• Export chat reports to Google Docs</li>
          <li>• Save concept summaries as documents</li>
          <li>• Organize notes in your Google Drive</li>
          <li>• Access documents from anywhere</li>
        </ul>
      </div>
    </div>
  );
};

export default GoogleDriveIntegration;
