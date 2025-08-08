import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { downloadFile, getFileExtension, createZipFilename, fetchWithProgress, sanitizeFilename } from '../utils/downloadUtils';

export interface DownloadPhoto {
  id: string;
  url: string;
  filename?: string;
}

export interface DownloadMenuProps {
  eventId: string;
  audioUrl: string;
  photos: DownloadPhoto[];
  eventTitle?: string;
  className?: string;
}

interface DownloadProgress {
  current: number;
  total: number;
  filename: string;
}

export default function DownloadMenu({
  eventId,
  audioUrl,
  photos,
  eventTitle,
  className = ''
}: DownloadMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(
    new Set(photos.map(p => p.id))
  );
  const [showPhotoSelection, setShowPhotoSelection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Toggle photo selection
  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  }, []);
  
  // Select all photos
  const selectAllPhotos = useCallback(() => {
    setSelectedPhotoIds(new Set(photos.map(p => p.id)));
  }, [photos]);
  
  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedPhotoIds(new Set());
  }, []);
  
  // Download audio file
  const handleDownloadAudio = useCallback(async () => {
    if (!audioUrl) return;
    
    setIsDownloading(true);
    setError(null);
    
    try {
      const extension = getFileExtension(audioUrl);
      const filename = `notey-${sanitizeFilename(eventTitle || 'audio')}-${eventId.split('-')[0]}.${extension}`;
      
      setProgress({
        current: 0,
        total: 1,
        filename
      });
      
      await downloadFile(audioUrl, filename);
      
      setProgress(null);
    } catch (err) {
      console.error('Audio download failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to download audio');
    } finally {
      setIsDownloading(false);
    }
  }, [audioUrl, eventTitle, eventId]);
  
  // Download photos as ZIP
  const handleDownloadPhotos = useCallback(async () => {
    const selectedPhotos = photos.filter(p => selectedPhotoIds.has(p.id));
    
    if (selectedPhotos.length === 0) {
      setError('Please select at least one photo to download.');
      return;
    }
    
    setIsDownloading(true);
    setError(null);
    setShowPhotoSelection(false);
    
    try {
      const zip = new JSZip();
      const zipFilename = createZipFilename(eventId, eventTitle);
      
      // Download and add photos to ZIP
      for (let i = 0; i < selectedPhotos.length; i++) {
        const photo = selectedPhotos[i];
        
        setProgress({
          current: i + 1,
          total: selectedPhotos.length,
          filename: photo.filename || `photo-${i + 1}`
        });
        
        try {
          // Fetch photo with progress
          const blob = await fetchWithProgress(photo.url, (loaded, total) => {
            setProgress(prev => prev ? {
              ...prev,
              filename: `${photo.filename || `photo-${i + 1}`} (${Math.round(loaded/1024)}KB)`
            } : null);
          });
          
          // Get file extension and create filename
          const extension = getFileExtension(photo.url, blob.type);
          const filename = photo.filename || 
            `photo-${String(i + 1).padStart(4, '0')}.${extension}`;
          
          zip.file(filename, blob);
        } catch (err) {
          console.warn(`Failed to download photo ${photo.id}:`, err);
          // Continue with other photos instead of failing completely
        }
      }
      
      setProgress({
        current: selectedPhotos.length,
        total: selectedPhotos.length,
        filename: 'Creating ZIP file...'
      });
      
      // Generate ZIP file
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6
        }
      });
      
      // Download ZIP
      saveAs(zipBlob, zipFilename);
      
      setProgress(null);
    } catch (err) {
      console.error('Photo ZIP download failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to create photo ZIP');
    } finally {
      setIsDownloading(false);
    }
  }, [photos, selectedPhotoIds, eventId, eventTitle]);
  
  // Close menu and reset state
  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setShowPhotoSelection(false);
    setError(null);
    setProgress(null);
  }, []);
  
  // Handle click outside to close
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeMenu();
    }
  }, [closeMenu]);
  
  return (
    <div className={`relative ${className}`}>
      {/* Download Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        disabled={isDownloading}
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {isDownloading ? 'Downloading...' : 'Download'}
      </button>
      
      {/* Download Menu Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleBackdropClick}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Download Content
                </h2>
                <button
                  onClick={closeMenu}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  disabled={isDownloading}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Progress Display */}
              {progress && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">
                      Downloading...
                    </span>
                    <span className="text-sm text-blue-700">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  
                  <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(progress.current / progress.total) * 100}%`
                      }}
                    />
                  </div>
                  
                  <div className="text-sm text-blue-700 truncate">
                    {progress.filename}
                  </div>
                </div>
              )}
              
              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.982 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-800">Download Failed</p>
                      <p className="text-sm text-red-600 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Photo Selection Modal */}
              {showPhotoSelection ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">Select Photos</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={selectAllPhotos}
                        className="text-sm text-blue-600 hover:text-blue-700"
                        disabled={isDownloading}
                      >
                        Select All
                      </button>
                      <button
                        onClick={clearSelection}
                        className="text-sm text-slate-500 hover:text-slate-700"
                        disabled={isDownloading}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                    {photos.map((photo, index) => (
                      <label
                        key={photo.id}
                        className={`flex items-center p-3 hover:bg-slate-50 cursor-pointer ${
                          index > 0 ? 'border-t border-slate-100' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          checked={selectedPhotoIds.has(photo.id)}
                          onChange={() => togglePhotoSelection(photo.id)}
                          disabled={isDownloading}
                        />
                        
                        <div className="ml-3 flex items-center flex-1 min-w-0">
                          <img
                            src={photo.url}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                            loading="lazy"
                          />
                          
                          <div className="ml-3 flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {photo.filename || `Photo ${index + 1}`}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  
                  <div className="flex space-x-3 pt-2">
                    <button
                      onClick={() => setShowPhotoSelection(false)}
                      className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                      disabled={isDownloading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDownloadPhotos}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      disabled={isDownloading || selectedPhotoIds.size === 0}
                    >
                      Create ZIP ({selectedPhotoIds.size})
                    </button>
                  </div>
                </div>
              ) : (
                /* Main Menu */
                <div className="space-y-4">
                  {/* Audio Download */}
                  {audioUrl && (
                    <button
                      onClick={handleDownloadAudio}
                      className="w-full flex items-center p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-left disabled:opacity-50"
                      disabled={isDownloading}
                    >
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      
                      <div className="ml-3 flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-slate-900">
                          Download Audio
                        </h3>
                        <p className="text-sm text-slate-500">
                          Download original audio file
                        </p>
                      </div>
                      
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Photos Download */}
                  {photos.length > 0 && (
                    <button
                      onClick={() => setShowPhotoSelection(true)}
                      className="w-full flex items-center p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-left disabled:opacity-50"
                      disabled={isDownloading}
                    >
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      
                      <div className="ml-3 flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-slate-900">
                          Download Photos (ZIP)
                        </h3>
                        <p className="text-sm text-slate-500">
                          {photos.length} photo{photos.length !== 1 ? 's' : ''} available
                        </p>
                      </div>
                      
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                  
                  {/* No content message */}
                  {!audioUrl && photos.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">No content available for download</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}