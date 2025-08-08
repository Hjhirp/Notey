import { useEffect, useState, useRef } from "react";
import TimelinePlayer from "./TimelinePlayer";
import DownloadMenu from "./DownloadMenu";
import config from "../config";

const BACKEND_URL = config.BACKEND_URL;

interface AudioChunk {
  id: string;
  event_id: string;
  audio_url: string;
  transcript?: string;
  summary?: string;
  start_time: number;
  length: number;
}

interface Photo {
  id?: string;
  event_id?: string;
  photo_url: string;
  offset_seconds: number;
  created_at?: string;
}

interface TimelineData {
  event: {
    id: string;
    title: string;
    started_at: string;
  };
  audio: {
    url: string;
    duration: number;
  } | null;
  photos: {
    id: string;
    offset: number;
    url: string;
    caption?: string;
  }[];
  transcript: {
    start: number;
    end: number;
    text: string;
  }[];
}

interface EventData {
  audio_url?: string;
  photos?: Photo[];
}

export default function Replay({ 
  eventId, 
  session,
  onEventDeleted 
}: { 
  eventId: string;
  session: any;
  onEventDeleted?: (id: string) => void;
}) {
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [selectedGalleryPhoto, setSelectedGalleryPhoto] = useState<Photo | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Keyboard navigation for gallery modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedGalleryPhoto) {
        if (e.key === 'Escape') {
          setSelectedGalleryPhoto(null);
        }
        // Prevent other keyboard shortcuts when gallery modal is open
        e.stopPropagation();
      }
    };
    
    if (selectedGalleryPhoto) {
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [selectedGalleryPhoto]);

  useEffect(() => {
    if (!eventId) return;

    const fetchEventData = async () => {
      try {
        setLoading(true);

        // Try to fetch timeline data first (new endpoint)
        try {
          const timelineRes = await fetch(`${BACKEND_URL}/events/${eventId}/timeline`);
          if (timelineRes.ok) {
            const timelineJson = await timelineRes.json();
            setTimelineData(timelineJson);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('Timeline endpoint not available, falling back to legacy endpoints');
        }

        // Fallback to legacy endpoints
        const eventRes = await fetch(`${BACKEND_URL}/events/${eventId}`);
        const eventJson = await eventRes.json();
        setEventData(eventJson);

        const chunksUrl = `${BACKEND_URL}/audio-chunks?event_id=${eventId}`;
        const chunksRes = await fetch(chunksUrl);
        const chunksJson = await chunksRes.json();
        
        setAudioChunks(Array.isArray(chunksJson) ? chunksJson : []);
        
      } catch (err) {
        console.error("Failed to load replay");
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId]);

  // Set up audio event listeners for play/pause state tracking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsAudioPlaying(true);
    const handlePause = () => setIsAudioPlaying(false);
    const handleEnded = () => setIsAudioPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioChunks, eventData]); // Re-run when audio source changes


  const deleteEvent = async () => {
    if (!session?.access_token) {
      alert('Authentication required. Please refresh the page and try again.');
      return;
    }
    
    setIsDeleting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/events/${eventId}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to delete event');
      }

      if (onEventDeleted) {
        onEventDeleted(eventId);
      }
      
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete event');
      alert('Failed to delete event. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!eventId) {
    return (
      <div className="bg-[#FCEED9] rounded-lg p-4 sm:p-6 border-2 border-[#F28C38] text-center">
        <p className="text-[#4A2C18] text-base sm:text-lg">⚠️ No event selected.</p>
        <p className="text-[#4A2C18] text-sm mt-2">Please select an event from the list to view its details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-[#FCEED9] rounded-lg p-4 sm:p-6 border-2 border-[#F28C38] text-center">
        <div className="animate-spin w-6 h-6 sm:w-8 sm:h-8 border-4 border-[#F28C38] border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-[#4A2C18] text-base sm:text-lg">⏳ Loading event details...</p>
      </div>
    );
  }


  // Combine all transcripts for the scrollable section
  const fullTranscript = audioChunks
    .map(chunk => chunk.transcript || "No transcript available")
    .join("\n\n");

  // Combine all summaries
  const fullSummary = audioChunks
    .map(chunk => chunk.summary)
    .filter(Boolean)
    .join(" ");

  return (
    <div className="card animate-fade-in">
      {/* Header with gradient */}
      <div className="card-header">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center">
            🎧 Event Replay
          </h2>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            title="Delete this event"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="card-content space-y-6 sm:space-y-8">
        {/* Timeline Player - use timeline data if available, otherwise create from legacy data */}
        {(timelineData?.audio || (audioChunks[0]?.audio_url || eventData?.audio_url)) && eventData?.photos?.length ? (
          <div className="space-y-4">
            <TimelinePlayer
              audioUrl={timelineData?.audio?.url || audioChunks[0]?.audio_url || eventData?.audio_url || ''}
              duration={timelineData?.audio?.duration || 0}
              photos={timelineData?.photos?.map(p => ({
                id: p.id,
                offset: p.offset,
                url: p.url,
                caption: p.caption
              })) || eventData?.photos?.map(p => ({
                id: p.id || `photo-${p.offset_seconds}`,
                offset: p.offset_seconds,
                url: p.photo_url,
                caption: undefined
              })) || []}
              transcript={timelineData?.transcript || []}
              className="mb-6"
            />
            
            {/* Download Menu */}
            <div className="flex justify-end">
              <DownloadMenu
                eventId={eventId}
                audioUrl={timelineData?.audio?.url || audioChunks[0]?.audio_url || eventData?.audio_url || ''}
                photos={timelineData?.photos?.map(p => ({
                  id: p.id,
                  url: p.url,
                  filename: `photo-${p.offset.toFixed(1)}s.jpg`
                })) || eventData?.photos?.map(p => ({
                  id: p.id || `photo-${p.offset_seconds}`,
                  url: p.photo_url,
                  filename: `photo-${p.offset_seconds.toFixed(1)}s.jpg`
                })) || []}
                eventTitle={timelineData?.event?.title || `Event ${eventId.split('-')[0]}`}
              />
            </div>
          </div>
        ) : (
          /* Fallback to Legacy Components */
          <>
            {/* Audio Player Section */}
            {(audioChunks[0]?.audio_url || eventData?.audio_url) && (
              <div className="bg-notey-cream/50 rounded-lg p-4 sm:p-5 border border-notey-orange/20">
                <h3 className="text-base sm:text-lg font-semibold text-notey-brown mb-4 flex items-center">
                  <span className="w-3 h-3 bg-notey-orange rounded-full mr-3"></span>
                  Audio Player
                </h3>
                <audio 
                  ref={audioRef}
                  controls 
                  src={audioChunks[0]?.audio_url || eventData?.audio_url} 
                  className="w-full h-12 sm:h-14 rounded-lg"
                  style={{
                    accentColor: '#F28C38'
                  }}
                />
              </div>
            )}

            {/* Legacy Download Menu for Fallback */}
            {(audioChunks[0]?.audio_url || eventData?.audio_url || (eventData?.photos && eventData.photos.length > 0)) && (
              <div className="flex justify-end">
                <DownloadMenu
                  eventId={eventId}
                  audioUrl={audioChunks[0]?.audio_url || eventData?.audio_url || ''}
                  photos={eventData?.photos?.map((p, i) => ({
                    id: p.id || `photo-${i}`,
                    url: p.photo_url,
                    filename: `photo-${p.offset_seconds.toFixed(1)}s.jpg`
                  })) || []}
                  eventTitle={`Event ${eventId.split('-')[0]}`}
                />
              </div>
            )}
          </>
        )}


        {/* Scrollable Transcript Section */}
        {fullTranscript && (
          <div className="bg-white rounded-lg border border-notey-orange/20 overflow-hidden shadow-sm">
            <h3 className="bg-gradient-to-r from-notey-pink to-notey-pink/80 px-4 sm:px-5 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white flex items-center">
              <span className="w-3 h-3 bg-white rounded-full mr-3"></span>
              Full Transcript
            </h3>
            <div className="p-4 sm:p-5 max-h-64 sm:max-h-80 overflow-y-auto">
              <div className="bg-notey-cream/30 rounded-lg p-4 border border-notey-orange/10">
                <pre className="text-notey-brown text-sm sm:text-base whitespace-pre-wrap leading-relaxed font-sans">
                  {fullTranscript}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Highlighted Summary Section */}
        {fullSummary && (
          <div className="bg-gradient-to-br from-notey-cream to-notey-cream/70 rounded-lg border border-notey-orange/30 p-4 sm:p-6 shadow-sm">
            <h3 className="text-base sm:text-lg font-semibold text-notey-brown mb-4 flex items-center">
              <span className="w-3 h-3 bg-notey-orange rounded-full mr-3"></span>
              Event Summary
            </h3>
            <div className="bg-white rounded-lg p-4 sm:p-5 border border-notey-orange/20 shadow-sm">
              <div className="prose prose-sm sm:prose-base max-w-none">
                <p className="text-notey-brown leading-relaxed m-0">
                  {fullSummary}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Photo Reference Gallery */}
        <div className="bg-white rounded-lg border border-notey-orange/20 overflow-hidden shadow-sm">
          <h3 className="bg-gradient-to-r from-notey-orange to-notey-orange/80 px-4 sm:px-5 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white flex items-center">
            <span className="w-3 h-3 bg-white rounded-full mr-3"></span>
            All Photos ({eventData?.photos?.length || 0})
          </h3>
          
          {eventData?.photos && eventData.photos.length > 0 ? (
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {eventData.photos.map((photo: Photo, idx: number) => (
                <div 
                  key={idx} 
                  className="bg-notey-cream/50 rounded-lg overflow-hidden border border-notey-orange/20 hover:border-notey-orange/40 transition-all duration-200 group hover:shadow-md cursor-pointer"
                  onClick={() => setSelectedGalleryPhoto(photo)}
                >
                  <div className="aspect-square overflow-hidden">
                    <img 
                      src={photo.photo_url} 
                      alt={`Event photo ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3 sm:p-4 bg-gradient-to-r from-notey-pink/80 to-notey-pink">
                    <p className="text-white text-xs sm:text-sm font-medium">
                      📸 Taken at {photo.offset_seconds?.toFixed(1) || "?"} seconds
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 sm:p-8 text-center bg-notey-cream/30">
              <div className="text-4xl sm:text-5xl mb-4">📷</div>
              <p className="text-notey-brown italic text-sm sm:text-base">No photos captured for this event.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Event</h3>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this event? This action cannot be undone and will remove all associated audio, transcripts, and photos.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteEvent}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin w-4 h-4 border border-white border-t-transparent rounded-full mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete Event'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Photo Modal */}
      {selectedGalleryPhoto && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setSelectedGalleryPhoto(null)}
        >
          <div
            className="relative max-w-6xl max-h-full w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              {/* Photo */}
              <div className="relative bg-black">
                <img
                  src={selectedGalleryPhoto.photo_url}
                  alt={`Event photo taken at ${selectedGalleryPhoto.offset_seconds}s`}
                  className="w-full h-auto max-h-[85vh] object-contain mx-auto block"
                  style={{ minHeight: '300px' }}
                />
                
                {/* Close button overlay */}
                <button
                  onClick={() => setSelectedGalleryPhoto(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-black/70 backdrop-blur-sm text-white rounded-full hover:bg-black/80 transition-colors flex items-center justify-center z-10"
                  aria-label="Close photo"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Photo Info */}
              <div className="p-6 bg-gradient-to-r from-notey-orange to-notey-orange/80">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold">
                      📸 Photo from Event
                    </h3>
                    <p className="text-white/90 text-sm sm:text-base mt-1">
                      Captured at {selectedGalleryPhoto.offset_seconds?.toFixed(1) || "unknown"} seconds
                    </p>
                    {selectedGalleryPhoto.created_at && (
                      <p className="text-white/80 text-xs mt-2">
                        {new Date(selectedGalleryPhoto.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  
                  {/* Download button */}
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = selectedGalleryPhoto.photo_url;
                      link.download = `photo-${selectedGalleryPhoto.offset_seconds?.toFixed(1) || 'unknown'}s.jpg`;
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="bg-white/20 backdrop-blur-sm text-white p-3 rounded-lg hover:bg-white/30 transition-colors flex items-center space-x-2"
                    title="Download photo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-medium">Download</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
