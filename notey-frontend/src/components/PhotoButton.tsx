import { useState, useCallback } from 'react';
import config from '../config';

const BACKEND_URL = config.BACKEND_URL;

interface PhotoButtonProps {
  startTime: number;
  addPhotoOffset: (offset: number) => void;
  eventId: string | null;
  accessToken: string | undefined;
  onPhotoUploaded?: (photoData: { photo_url: string; offset_seconds: number }) => void;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
}

// Performance constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

// PhotoButton component: Capture photo with camera and upload with timestamp
export default function PhotoButton({ 
  startTime, 
  addPhotoOffset, 
  eventId, 
  accessToken,
  onPhotoUploaded 
}: PhotoButtonProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    success: false
  });

  // Optimized file validation with memoization
  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'Photo is too large. Please try a smaller image.';
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      return 'Please select a valid image file.';
    }

    return null;
  }, []);

  // Enhanced upload function with improved performance and error handling
  const uploadPhoto = useCallback(async (file: File, retryCount = 0) => {
    if (!eventId || !accessToken) {
      setUploadState(prev => ({ 
        ...prev, 
        error: 'Missing event ID or authentication token',
        isUploading: false 
      }));
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setUploadState(prev => ({ 
        ...prev, 
        error: validationError,
        isUploading: false 
      }));
      return;
    }

    // Ensure startTime is valid (not 0) - recording must have started
    if (startTime === 0) {
      setUploadState(prev => ({
        ...prev,
        error: "Please start recording before taking photos",
        isUploading: false
      }));
      return;
    }

    const offset = (Date.now() - startTime) / 1000;
    addPhotoOffset(offset);

    setUploadState({
      isUploading: true,
      progress: 0,
      error: null,
      success: false
    });

    try {
      // Create optimized FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('offset', offset.toString());

      // Smooth progress animation with reduced intervals
      const progressInterval = setInterval(() => {
        setUploadState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 8, 85)
        }));
      }, 150);

      // Enhanced upload with timeout and abort controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

      const response = await fetch(`${BACKEND_URL}/events/${eventId}/photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      setUploadState(prev => ({ ...prev, progress: 100 }));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          detail: `Upload failed with status ${response.status}` 
        }));
        
        // Handle specific error cases with user-friendly messages
        let errorMessage = 'Upload failed. Please try again.';
        
        if (response.status === 413) {
          errorMessage = 'Image is too large. Please try a smaller file.';
        } else if (response.status === 415) {
          errorMessage = 'Image format not supported. Please try a different image.';
        } else if (response.status === 401) {
          errorMessage = 'Authentication failed. Please refresh and try again.';
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Please try again in a moment.';
        } else if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : 'Upload failed. Please try again.';
        }

        // Implement intelligent retry logic with exponential backoff
        if (retryCount < MAX_RETRIES && (response.status >= 500 || response.status === 429)) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
          
          setTimeout(() => {
            uploadPhoto(file, retryCount + 1);
          }, delay);
          return;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      setUploadState({
        isUploading: false,
        progress: 100,
        error: null,
        success: true
      });

      // Call success callback if provided
      if (onPhotoUploaded) {
        onPhotoUploaded({
          photo_url: result.photo_url,
          offset_seconds: result.offset_seconds
        });
      }


      // Clear success state after 2 seconds for better UX
      setTimeout(() => {
        setUploadState(prev => ({ ...prev, success: false }));
      }, 2000);

    } catch (error) {
      console.error("Photo upload failed");
      
      // Handle network errors with retry logic
      const isNetworkError = error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        !navigator.onLine
      );
      
      if (isNetworkError && retryCount < MAX_RETRIES) {
        
        setUploadState(prev => ({ 
          ...prev, 
          error: `Network error. Retrying... (${retryCount + 1}/${MAX_RETRIES})`,
          progress: 0
        }));
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
        
        setTimeout(() => {
          uploadPhoto(file, retryCount + 1);
        }, delay);
        
        return;
      }
      
      // Determine error message based on error type
      let errorMessage = 'Upload failed';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Upload timed out. Please check your connection and try again.';
        } else if (!navigator.onLine) {
          errorMessage = 'No internet connection. Please check your network and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      // Add retry information if max retries reached
      if (retryCount >= MAX_RETRIES) {
        errorMessage += ` (Failed after ${MAX_RETRIES} attempts)`;
      }
      
      setUploadState({
        isUploading: false,
        progress: 0,
        error: errorMessage,
        success: false
      });

      // Clear error after 8 seconds for network errors (longer for user to read)
      setTimeout(() => {
        setUploadState(prev => ({ ...prev, error: null }));
      }, 8000);
    }
  }, [eventId, accessToken, startTime, addPhotoOffset, onPhotoUploaded, validateFile]);

  const capturePhoto = useCallback(async () => {
    if (uploadState.isUploading) return;

    try {
      // Check if camera is available
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Prefer back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });

      // Create canvas to capture the photo
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      // Create modal for camera interface
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-4 max-w-md w-full mx-4">
          <div class="text-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Take Photo</h3>
            <p class="text-sm text-gray-600 mt-1">Position your camera and tap capture</p>
          </div>
          <div class="relative mb-4 bg-black rounded-lg overflow-hidden">
            <video id="camera-preview" class="w-full h-64 object-cover" autoplay playsinline muted></video>
          </div>
          <div class="flex space-x-3">
            <button id="capture-btn" class="flex-1 bg-notey-orange text-notey-brown px-4 py-3 rounded-md font-medium hover:bg-notey-orange/90 transition-colors flex items-center justify-center">
              <span class="mr-2">📸</span>
              Capture
            </button>
            <button id="cancel-btn" class="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-md font-medium hover:bg-gray-300 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const videoElement = modal.querySelector('#camera-preview') as HTMLVideoElement;
      const captureBtn = modal.querySelector('#capture-btn') as HTMLButtonElement;
      const cancelBtn = modal.querySelector('#cancel-btn') as HTMLButtonElement;

      videoElement.srcObject = stream;

      // Wait for video to be ready
      await new Promise((resolve) => {
        videoElement.onloadedmetadata = () => resolve(void 0);
      });

      // Handle capture
      captureBtn.onclick = () => {
        // Set canvas dimensions to match video
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        // Draw current video frame to canvas
        context?.drawImage(videoElement, 0, 0);

        // Convert canvas to blob with good quality
        canvas.toBlob(async (blob) => {
          if (blob) {
            // Create file from blob
            const timestamp = Date.now();
            const file = new File([blob], `photo-${timestamp}.jpg`, { type: 'image/jpeg' });
            
            // Cleanup camera first
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(modal);
            
            // Validate and upload
            const validationError = validateFile(file);
            if (validationError) {
              setUploadState(prev => ({ ...prev, error: validationError }));
              setTimeout(() => {
                setUploadState(prev => ({ ...prev, error: null }));
              }, 5000);
            } else {
              await uploadPhoto(file);
            }
          } else {
            // Cleanup on error
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(modal);
            setUploadState(prev => ({ ...prev, error: 'Failed to capture photo. Please try again.' }));
            setTimeout(() => {
              setUploadState(prev => ({ ...prev, error: null }));
            }, 5000);
          }
        }, 'image/jpeg', 0.85); // Good quality
      };

      // Handle cancel
      const cleanup = () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
      };

      cancelBtn.onclick = cleanup;

      // Handle modal click outside
      modal.onclick = (e) => {
        if (e.target === modal) {
          cleanup();
        }
      };

      // Handle escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);

    } catch (error) {
      console.error('Camera access failed');
      let errorMessage = 'Camera access denied or not available.';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera permission denied. Please allow camera access and try again.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Camera not supported in this browser.';
        }
      }
      
      setUploadState(prev => ({ ...prev, error: errorMessage }));
      setTimeout(() => {
        setUploadState(prev => ({ ...prev, error: null }));
      }, 5000);
    }
  }, [uploadState.isUploading, validateFile, uploadPhoto]);

  const getButtonContent = useCallback(() => {
    if (uploadState.isUploading) {
      return (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-notey-brown border-t-transparent mr-2"></div>
          Uploading...
        </>
      );
    }

    if (uploadState.success) {
      return (
        <>
          <span className="mr-2">✅</span>
          Photo Captured!
        </>
      );
    }

    return (
      <>
        <span className="mr-2">📸</span>
        Take Photo
      </>
    );
  }, [uploadState.isUploading, uploadState.success]);

  const getButtonClassName = useCallback(() => {
    const baseClasses = "w-full px-4 py-4 sm:py-2 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-notey-cream transition-all duration-200 border text-base min-h-[48px] touch-manipulation flex items-center justify-center";
    
    if (uploadState.isUploading) {
      return `${baseClasses} bg-notey-orange/50 text-notey-brown border-notey-orange/30 cursor-not-allowed`;
    }

    if (uploadState.success) {
      return `${baseClasses} bg-green-100 text-green-700 border-green-200 hover:bg-green-200 focus:ring-green-500`;
    }

    if (uploadState.error) {
      return `${baseClasses} bg-red-100 text-red-700 border-red-200 hover:bg-red-200 focus:ring-red-500`;
    }

    return `${baseClasses} bg-notey-orange text-notey-brown border-notey-orange/30 hover:bg-notey-orange/90 focus:ring-notey-orange`;
  }, [uploadState.isUploading, uploadState.success, uploadState.error]);

  return (
    <div className="space-y-2">
      <button 
        onClick={capturePhoto}
        disabled={uploadState.isUploading || !eventId || !accessToken}
        className={getButtonClassName()}
        aria-label={uploadState.isUploading ? "Uploading photo" : "Take photo with camera"}
      >
        {getButtonContent()}
      </button>

      {/* Upload progress indicator */}
      {uploadState.isUploading && (
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div 
            className="bg-notey-orange h-1.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${uploadState.progress}%` }}
          ></div>
        </div>
      )}

      {/* Error message */}
      {uploadState.error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2 flex items-start">
          <span className="mr-1 flex-shrink-0">⚠️</span>
          <span>{uploadState.error}</span>
        </div>
      )}

      {/* Success message */}
      {uploadState.success && (
        <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-md p-2 flex items-center">
          <span className="mr-1">✅</span>
          <span>Photo captured and uploaded successfully!</span>
        </div>
      )}
    </div>
  );
}
