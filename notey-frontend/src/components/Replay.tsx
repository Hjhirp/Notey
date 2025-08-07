import { useEffect, useState, useRef } from "react";
import PhotoTimelinePlayer from "./PhotoTimelinePlayer";
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
  const [audioChunks, setAudioChunks] = useState<AudioChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!eventId) return;

    const fetchEventData = async () => {
      try {
        setLoading(true);

        // Fetch basic event data (for photos, etc.)
        const eventRes = await fetch(`${BACKEND_URL}/events/${eventId}`);
        const eventJson = await eventRes.json();
        setEventData(eventJson);

        // Fetch audio chunks data (for transcript and summary)
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

  const toggleChunk = (chunkId: string) => {
    setExpandedChunk(expandedChunk === chunkId ? null : chunkId);
  };

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
    .map((chunk, idx) => `[Chunk ${idx + 1}] ${chunk.transcript || "No transcript available"}`)
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

        {/* Timeline-Synchronized Photos */}
        {eventData?.photos && eventData.photos.length > 0 && (
          <PhotoTimelinePlayer
            photos={eventData.photos}
            audioRef={audioRef}
            isPlaying={isAudioPlaying}
            className="mb-6 sm:mb-8"
          />
        )}

        {/* Audio Chunks Accordion */}
        <div className="bg-white rounded-lg border-2 border-[#F28C38] overflow-hidden">
          <h3 className="bg-[#F28C38] px-3 sm:px-4 py-3 text-base sm:text-lg font-semibold text-[#4A2C18] flex items-center">
            <span className="w-2 h-2 sm:w-3 sm:h-3 bg-[#4A2C18] rounded-full mr-2"></span>
            Audio Chunks ({audioChunks.length})
          </h3>
          
          {audioChunks.length > 0 ? (
            <div className="divide-y divide-[#F4A9A0]">
              {audioChunks.map((chunk, idx) => (
                <div key={chunk.id || idx} className="bg-[#FCEED9]">
                  <button
                    onClick={() => toggleChunk(chunk.id || idx.toString())}
                    className="w-full px-3 sm:px-4 py-3 sm:py-4 text-left hover:bg-[#F4A9A0] transition-colors duration-200 flex items-center justify-between touch-manipulation min-h-[48px]"
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <span className="w-2 h-2 bg-[#F28C38] rounded-full mr-2 sm:mr-3 flex-shrink-0"></span>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-[#4A2C18] text-sm sm:text-base block">
                          Chunk {idx + 1}
                        </span>
                        <span className="text-xs sm:text-sm text-[#F4A9A0] block sm:inline sm:ml-2">
                          ({chunk.start_time}s - {(chunk.start_time + chunk.length).toFixed(1)}s)
                        </span>
                      </div>
                    </div>
                    <span className="text-[#F28C38] text-lg sm:text-xl flex-shrink-0 ml-2">
                      {expandedChunk === (chunk.id || idx.toString()) ? '−' : '+'}
                    </span>
                  </button>
                  
                  {expandedChunk === (chunk.id || idx.toString()) && (
                    <div className="px-3 sm:px-4 pb-4 bg-[#FCEED9] space-y-3">
                      <div className="bg-[#F4A9A0] rounded-lg p-3">
                        <h5 className="text-sm font-bold text-[#4A2C18] mb-2">Summary</h5>
                        <p className="text-[#4A2C18] text-sm leading-relaxed">
                          {chunk.summary || "No summary available"}
                        </p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-3 border border-[#F4A9A0]">
                        <h5 className="text-sm font-bold text-[#4A2C18] mb-2">Transcript</h5>
                        <pre className="text-[#4A2C18] text-xs sm:text-sm whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                          {chunk.transcript || "No transcript available"}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 sm:p-6 text-center bg-[#FCEED9]">
              <p className="text-[#4A2C18] italic text-sm sm:text-base">No audio chunks found for this event.</p>
            </div>
          )}
        </div>

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
                  className="bg-notey-cream/50 rounded-lg overflow-hidden border border-notey-orange/20 hover:border-notey-orange/40 transition-all duration-200 group hover:shadow-md"
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
    </div>
  );
}
