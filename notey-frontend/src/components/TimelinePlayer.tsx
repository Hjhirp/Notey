import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { formatTime, getTimePercentage, findActivePhoto, throttle } from '../utils/timeUtils';

export interface TimelinePhoto {
  id: string;
  offset: number;
  url: string;
  caption?: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TimelinePlayerProps {
  audioUrl: string;
  duration: number;
  photos: TimelinePhoto[];
  transcript?: TranscriptSegment[];
  className?: string;
}

export default function TimelinePlayer({
  audioUrl,
  duration,
  photos,
  transcript = [],
  className = ''
}: TimelinePlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<TimelinePhoto | null>(null);
  const [autoPopupPhoto, setAutoPopupPhoto] = useState<TimelinePhoto | null>(null);
  const [lastTriggeredPhotoId, setLastTriggeredPhotoId] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const photoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Memoized sorted photos
  const sortedPhotos = useMemo(() => 
    [...photos].sort((a, b) => a.offset - b.offset),
    [photos]
  );
  
  // Find active photo and transcript segment
  const activePhoto = useMemo(() => 
    findActivePhoto(sortedPhotos, currentTime),
    [sortedPhotos, currentTime]
  );
  
  const activeTranscriptSegment = useMemo(() => {
    return transcript.find(segment => 
      currentTime >= segment.start && currentTime <= segment.end
    );
  }, [transcript, currentTime]);
  
  // Calculate how long a photo should stay visible
  const calculatePhotoDisplayDuration = useCallback((photo: TimelinePhoto, photoIndex: number): number => {
    const DEFAULT_DURATION = 5; // 5 seconds default
    const MIN_DURATION = 1; // Minimum 1 second
    
    // Find the next photo after this one
    const nextPhoto = sortedPhotos[photoIndex + 1];
    
    if (nextPhoto) {
      // Duration = time between current photo and next photo, max 5 seconds
      const timeDifference = nextPhoto.offset - photo.offset;
      return Math.max(MIN_DURATION, Math.min(DEFAULT_DURATION, timeDifference));
    }
    
    // If no next photo, show for default duration
    return DEFAULT_DURATION;
  }, [sortedPhotos]);
  
  // Handle automatic photo popup logic
  const handlePhotoPopup = useCallback((newCurrentTime: number) => {
    if (!isPlaying || !sortedPhotos.length) return;
    
    // Find photo that should be triggered at current time
    const photoToTrigger = sortedPhotos.find(photo => {
      const tolerance = 0.5; // 0.5 second tolerance
      return Math.abs(newCurrentTime - photo.offset) <= tolerance && 
             photo.id !== lastTriggeredPhotoId;
    });
    
    if (photoToTrigger) {
      const photoIndex = sortedPhotos.indexOf(photoToTrigger);
      const displayDuration = calculatePhotoDisplayDuration(photoToTrigger, photoIndex);
      
      // Clear any existing timeout
      if (photoTimeoutRef.current) {
        clearTimeout(photoTimeoutRef.current);
      }
      
      // Show the photo
      setAutoPopupPhoto(photoToTrigger);
      setLastTriggeredPhotoId(photoToTrigger.id);
      
      // Hide the photo after calculated duration
      photoTimeoutRef.current = setTimeout(() => {
        setAutoPopupPhoto(null);
        photoTimeoutRef.current = null;
      }, displayDuration * 1000);
    }
  }, [isPlaying, sortedPhotos, lastTriggeredPhotoId, calculatePhotoDisplayDuration]);

  // Reset triggered photos when seeking backwards
  const handleSeek = useCallback((newTime: number) => {
    // If seeking backwards significantly, reset triggered photos
    if (newTime < currentTime - 2) {
      setLastTriggeredPhotoId(null);
      setAutoPopupPhoto(null);
      if (photoTimeoutRef.current) {
        clearTimeout(photoTimeoutRef.current);
        photoTimeoutRef.current = null;
      }
    }
  }, [currentTime]);

  // Throttled time update for smooth performance
  const updateCurrentTime = useCallback(
    throttle(() => {
      if (audioRef.current) {
        const newTime = audioRef.current.currentTime;
        handleSeek(newTime);
        setCurrentTime(newTime);
        handlePhotoPopup(newTime);
      }
    }, 100),
    [handleSeek, handlePhotoPopup]
  );
  
  // Animation frame-based time sync
  const syncTime = useCallback(() => {
    updateCurrentTime();
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(syncTime);
    }
  }, [isPlaying, updateCurrentTime]);
  
  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleLoadedData = () => setIsLoaded(true);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdate = updateCurrentTime;
    
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [updateCurrentTime]);
  
  // Start/stop animation frame sync
  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(syncTime);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, syncTime]);
  
  // Seek to time function
  const seekToTime = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
      setCurrentTime(time);
      
      // Start playing when seeking from ticks/thumbnails
      if (!isPlaying) {
        audioRef.current.play().catch(() => {
          // Handle autoplay restrictions
          console.warn('Autoplay prevented');
        });
      }
    }
  }, [duration, isPlaying]);
  
  // Handle scrub bar click
  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current || !duration) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width * 100;
    const time = (percentage / 100) * duration;
    
    seekToTime(time);
  }, [duration, seekToTime]);
  
  // Handle photo tick click
  const handlePhotoTickClick = useCallback((photo: TimelinePhoto) => {
    seekToTime(photo.offset);
  }, [seekToTime]);
  
  // Handle filmstrip thumbnail click
  const handleThumbnailClick = useCallback((photo: TimelinePhoto) => {
    seekToTime(photo.offset);
  }, [seekToTime]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!audioRef.current) return;
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isPlaying) {
            audioRef.current.pause();
          } else {
            audioRef.current.play();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekToTime(currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekToTime(currentTime + 10);
          break;
        case 'Escape':
          if (selectedPhoto) {
            setSelectedPhoto(null);
          } else if (autoPopupPhoto) {
            // Allow manual dismissal of auto-popup
            setAutoPopupPhoto(null);
            if (photoTimeoutRef.current) {
              clearTimeout(photoTimeoutRef.current);
              photoTimeoutRef.current = null;
            }
          }
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, seekToTime, selectedPhoto, autoPopupPhoto]);

  // Cleanup photo timeout on unmount or when photos change
  useEffect(() => {
    return () => {
      if (photoTimeoutRef.current) {
        clearTimeout(photoTimeoutRef.current);
      }
    };
  }, []);

  // Reset auto-popup state when playback stops
  useEffect(() => {
    if (!isPlaying) {
      setAutoPopupPhoto(null);
      if (photoTimeoutRef.current) {
        clearTimeout(photoTimeoutRef.current);
        photoTimeoutRef.current = null;
      }
    }
  }, [isPlaying]);
  
  // Auto-scroll active photo in filmstrip
  useEffect(() => {
    if (activePhoto && filmstripRef.current) {
      const activeElement = filmstripRef.current.querySelector(
        `[data-photo-id="${activePhoto.id}"]`
      ) as HTMLElement;
      
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activePhoto]);
  
  const progressPercentage = getTimePercentage(currentTime, duration);
  
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      {/* Audio Player */}
      <div className="p-6 border-b border-slate-100">
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          controls
          className="w-full rounded-lg"
        />
      </div>
      
      <div className="p-6 pt-4">
        
        {/* Photo Filmstrip */}
        {sortedPhotos.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center">
              <span className="mr-2">📸</span>
              Photos Timeline ({sortedPhotos.length})
            </h3>
            
            <div
              ref={filmstripRef}
              className="flex space-x-3 overflow-x-auto pb-2 scroll-smooth"
              style={{ scrollbarWidth: 'thin' }}
            >
              {sortedPhotos.map((photo) => {
                const isActive = activePhoto?.id === photo.id;
                const isUpcoming = currentTime < photo.offset && photo.offset - currentTime <= 5; // Highlight photos within 5 seconds
                
                return (
                  <button
                    key={photo.id}
                    data-photo-id={photo.id}
                    className={`flex-shrink-0 group relative rounded-lg overflow-hidden transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isActive 
                        ? 'ring-2 ring-orange-500 scale-105 shadow-lg' 
                        : isUpcoming
                        ? 'ring-2 ring-yellow-400 scale-105 shadow-md'
                        : 'hover:ring-1 hover:ring-slate-300'
                    }`}
                    onClick={() => handleThumbnailClick(photo)}
                  >
                    <div className="w-20 h-20 bg-slate-100">
                      <img
                        src={photo.url}
                        alt={photo.caption || `Photo at ${formatTime(photo.offset)}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPhoto(photo);
                        }}
                      />
                    </div>
                    
                    <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t to-transparent p-1.5 ${
                      isActive 
                        ? 'from-orange-600/70' 
                        : isUpcoming 
                        ? 'from-yellow-600/70' 
                        : 'from-black/70'
                    }`}>
                      <div className="text-xs text-white font-medium flex items-center justify-between">
                        <span>{formatTime(photo.offset)}</span>
                        {isUpcoming && <span className="text-yellow-200">📸</span>}
                      </div>
                    </div>
                    
                    {/* Active Indicator */}
                    {isActive && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Transcript Display */}
        {transcript.length > 0 && activeTranscriptSegment && (
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
              <span className="mr-2">📝</span>
              Transcript
            </h3>
            
            <div className="text-sm text-slate-800 leading-relaxed">
              {activeTranscriptSegment.text}
            </div>
            
            <div className="text-xs text-slate-500 mt-2">
              {formatTime(activeTranscriptSegment.start)} - {formatTime(activeTranscriptSegment.end)}
            </div>
          </div>
        )}
      </div>
      
      {/* Auto-Popup Photo Overlay */}
      {autoPopupPhoto && !selectedPhoto && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-80 border-2 border-orange-500">
            {/* Photo */}
            <div className="relative">
              <img
                src={autoPopupPhoto.url}
                alt={autoPopupPhoto.caption || `Photo at ${formatTime(autoPopupPhoto.offset)}`}
                className="w-full h-56 object-cover"
              />
              
              {/* Close button */}
              <button
                onClick={() => {
                  setAutoPopupPhoto(null);
                  if (photoTimeoutRef.current) {
                    clearTimeout(photoTimeoutRef.current);
                    photoTimeoutRef.current = null;
                  }
                }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors flex items-center justify-center"
                aria-label="Close photo popup"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Expand button */}
              <button
                onClick={() => {
                  setSelectedPhoto(autoPopupPhoto);
                  setAutoPopupPhoto(null);
                  if (photoTimeoutRef.current) {
                    clearTimeout(photoTimeoutRef.current);
                    photoTimeoutRef.current = null;
                  }
                }}
                className="absolute top-2 left-2 w-8 h-8 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors flex items-center justify-center"
                aria-label="Expand photo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>
            </div>
            
            {/* Info */}
            <div className="p-3 bg-gradient-to-r from-orange-500 to-orange-600">
              <div className="text-white">
                <p className="font-semibold text-sm">
                  📸 {formatTime(autoPopupPhoto.offset)}
                </p>
                {autoPopupPhoto.caption && (
                  <p className="text-xs opacity-90 mt-1 line-clamp-2">
                    {autoPopupPhoto.caption}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-full w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl overflow-hidden">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.caption || `Photo at ${formatTime(selectedPhoto.offset)}`}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Photo at {formatTime(selectedPhoto.offset)}
                    </h3>
                    {selectedPhoto.caption && (
                      <p className="text-sm text-slate-600 mt-1">
                        {selectedPhoto.caption}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                    aria-label="Close photo"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
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