import { useState, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import PhotoButton from "./PhotoButton";
import config from "../config";

const BACKEND_URL = config.BACKEND_URL;

export default function Recorder({ session }: { session: Session | null }) {
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ photo_url: string; offset_seconds: number; id?: string }>>([]);
  const audioChunks = useRef<Blob[]>([]);
  const startTime = useRef<number>(0);
  const photoOffsets = useRef<number[]>([]);

  const startRecording = async () => {
    try {
      setFeedback(null);
      setIsProcessing(true);
      
      const token = session?.access_token;
      const res = await fetch(`${BACKEND_URL}/events/start`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: eventName.trim() || "Untitled Event"
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create event');
      }

      const { event_id } = await res.json();

      if (!event_id) {
        throw new Error('No event ID received');
      }

    // Store for frontend rendering
    setEventId(event_id);

    // Clear the event name for next recording
    setEventName("");

    // Reset uploaded photos for new recording
    setUploadedPhotos([]);

    // Use directly to avoid React state delay
    const liveEventId = event_id;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const newRecorder = new MediaRecorder(stream);

    audioChunks.current = [];

    newRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.current.push(e.data);
      }
    };

    newRecorder.onstart = () => {
      startTime.current = Date.now();
    };

    newRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks.current, {
        type: "audio/webm;codecs=opus",
      });


      const durationSec = audioBlob.size / 4000;

      if (durationSec < 1) {
        alert("⚠️ Recording too short. Try again.");
        return;
      }

      // Upload in background without blocking UI
      const uploadAsync = async () => {
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");
          formData.append("duration", String(durationSec));

          await fetch(`${BACKEND_URL}/events/${liveEventId}/audio`, {
            method: "POST",
            body: formData,
          });

        } catch (error) {
          console.error("Upload failed");
        }
      };

      // Start upload but don't wait for it
      uploadAsync();
    };

      setRecorder(newRecorder);
      newRecorder.start();
      setFeedback({ type: 'success', message: 'Recording started successfully!' });
    } catch (error) {
      console.error('Failed to start recording');
      setFeedback({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to start recording' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const stopRecording = () => {
    if (!recorder) return;
    
    setIsProcessing(true);
    setFeedback({ type: 'info', message: 'Processing recording...' });
    
    // Immediately update UI state for instant feedback
    setRecorder(null);
    
    // Stop the actual recording (onstop will handle upload)
    recorder.stop();
    
    // Reset processing state after a delay
    setTimeout(() => {
      setIsProcessing(false);
      setFeedback({ type: 'success', message: 'Recording saved successfully!' });
      setTimeout(() => setFeedback(null), 3000);
    }, 2000);
  };

  const addPhotoOffset = (offset: number) => {
    photoOffsets.current.push(offset);
  };

  const handlePhotoUploaded = (photoData: { photo_url: string; offset_seconds: number }) => {
    setUploadedPhotos(prev => {
      // Sort photos by offset_seconds to maintain timeline order
      const newPhotos = [...prev, { ...photoData, id: Date.now().toString() }];
      return newPhotos.sort((a, b) => a.offset_seconds - b.offset_seconds);
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4">
        {/* Feedback Messages */}
        {feedback && (
          <div className={`mb-3 p-2 rounded-lg text-xs ${
            feedback.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' :
            feedback.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' :
            'bg-blue-50 border border-blue-200 text-blue-700'
          }`}>
            {feedback.message}
          </div>
        )}
        
        {!recorder ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="eventName" className="block text-sm font-medium text-slate-700 mb-2">
                Event Name
              </label>
              <input
                id="eventName"
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Quick meeting notes..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-notey-orange focus:border-transparent transition-all duration-200"
                maxLength={100}
              />
              <div className="mt-1 text-xs text-slate-500">
                {eventName.length}/100 characters
              </div>
            </div>
            <button 
              onClick={startRecording}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-notey-orange text-white font-semibold rounded-lg hover:bg-notey-orange/90 focus:outline-none focus:ring-2 focus:ring-notey-orange focus:ring-offset-2 transition-all duration-200 text-sm min-h-[44px] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Starting...
                </>
              ) : (
                <>
                  <span className="mr-2">🎙️</span>
                  Start Recording
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Recording state indicator */}
            <div className="flex items-center justify-center space-x-2 py-3 bg-red-50 rounded-lg">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-700 font-medium text-sm">Recording...</span>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            </div>
            
            <PhotoButton 
              startTime={startTime.current} 
              addPhotoOffset={addPhotoOffset}
              eventId={eventId}
              accessToken={session?.access_token}
              onPhotoUploaded={handlePhotoUploaded}
            />

            {/* Photo thumbnails display */}
            {uploadedPhotos.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-600 flex items-center">
                  <span className="mr-2">📸</span>
                  Attached Photos ({uploadedPhotos.length})
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {uploadedPhotos.map((photo) => (
                    <div key={photo.id || photo.offset_seconds} className="relative group">
                      <img
                        src={photo.photo_url}
                        alt={`Photo at ${photo.offset_seconds.toFixed(1)}s`}
                        className="w-full h-16 object-cover rounded-md border border-slate-200 hover:border-notey-orange hover:shadow-md transition-all duration-200 cursor-pointer"
                        loading="lazy"
                        onError={(e) => {
                          // Handle broken image gracefully
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEg0NFY0NEgyMFYyMFoiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+CjxjaXJjbGUgY3g9IjI4IiBjeT0iMjgiIHI9IjMiIGZpbGw9IiM5Q0EzQUYiLz4KPHBhdGggZD0iTTI0IDM2TDI4IDMyTDM2IDQwSDI0VjM2WiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K';
                          target.alt = 'Failed to load photo';
                        }}
                        onClick={() => {
                          // Open photo in modal for better viewing
                          const modal = document.createElement('div');
                          modal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4';
                          modal.innerHTML = `
                            <div class="relative max-w-4xl max-h-full">
                              <img src="${photo.photo_url}" alt="Photo at ${photo.offset_seconds.toFixed(1)}s" class="max-w-full max-h-full object-contain rounded-lg">
                              <div class="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                                ${photo.offset_seconds.toFixed(1)}s
                              </div>
                              <button class="absolute top-2 left-2 bg-black/70 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/90 transition-colors" onclick="document.body.removeChild(this.closest('.fixed'))">
                                ✕
                              </button>
                            </div>
                          `;
                          modal.onclick = (e) => {
                            if (e.target === modal) {
                              document.body.removeChild(modal);
                            }
                          };
                          document.body.appendChild(modal);
                        }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5 rounded-b-md">
                        {photo.offset_seconds.toFixed(1)}s
                      </div>
                      {/* Hover overlay for better visual feedback */}
                      <div className="absolute inset-0 bg-notey-orange/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-md flex items-center justify-center">
                        <div className="bg-white/90 text-notey-brown text-xs px-2 py-1 rounded font-medium">
                          View
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button 
              onClick={stopRecording}
              disabled={isProcessing}
              className="w-full px-4 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-all duration-200 text-sm min-h-[44px] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <span className="mr-2">⏹</span>
                  Stop Recording
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
