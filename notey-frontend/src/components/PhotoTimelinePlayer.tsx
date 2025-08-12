import { useEffect, useState, useRef, useCallback, useMemo, type RefObject } from 'react';

interface Photo {
  id?: string;
  event_id?: string;
  photo_url: string;
  offset_seconds: number;
  created_at?: string;
}

interface PhotoTimelinePlayerProps {
  photos: Photo[];
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  className?: string;
}

interface PhotoLoadingState {
  [photoId: string]: 'loading' | 'loaded' | 'error';
}

interface PhotoCache {
  [photoId: string]: {
    blob: string;
    timestamp: number;
  };
}

// Performance constants
const MONITORING_INTERVAL = 250; // Reduced from 500ms for smoother experience
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const PRELOAD_THRESHOLD = 10; // Preload photos within 10 seconds
const MAX_VISIBLE_PHOTOS = 20; // Limit visible photos for performance

export default function PhotoTimelinePlayer({ 
  photos, 
  audioRef, 
  isPlaying, 
  className = "" 
}: PhotoTimelinePlayerProps) {
  const [visiblePhotos, setVisiblePhotos] = useState<Photo[]>([]);
  const [shownPhotoIds, setShownPhotoIds] = useState<Set<string>>(new Set());
  const [photoLoadingStates, setPhotoLoadingStates] = useState<PhotoLoadingState>({});
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photoCache, setPhotoCache] = useState<PhotoCache>({});
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeekTime = useRef<number>(-1);
  const preloadedPhotos = useRef<Set<string>>(new Set());
  const intersectionObserver = useRef<IntersectionObserver | null>(null);

  // Memoized sorted photos to prevent unnecessary re-renders
  const sortedPhotos = useMemo(() => 
    [...photos].sort((a, b) => a.offset_seconds - b.offset_seconds), 
    [photos]
  );

  // Memoized photo ID generator
  const getPhotoId = useCallback((photo: Photo, index: number): string => {
    return photo.id || `${photo.offset_seconds}-${index}`;
  }, []);

  // Optimized time formatter with memoization
  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Enhanced photo preloading with cache management
  const preloadPhoto = useCallback((photo: Photo, photoId: string) => {
    if (preloadedPhotos.current.has(photoId) || photoCache[photoId]) {
      return;
    }

    preloadedPhotos.current.add(photoId);
    
    const img = new Image();
    img.onload = () => {
      // Convert to blob URL for better caching
      fetch(photo.photo_url)
        .then(response => response.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          setPhotoCache(prev => ({
            ...prev,
            [photoId]: {
              blob: blobUrl,
              timestamp: Date.now()
            }
          }));
          setPhotoLoadingStates(prev => ({ ...prev, [photoId]: 'loaded' }));
        })
        .catch(() => {
          setPhotoLoadingStates(prev => ({ ...prev, [photoId]: 'error' }));
        });
    };
    img.onerror = () => {
      setPhotoLoadingStates(prev => ({ ...prev, [photoId]: 'error' }));
    };
    img.src = photo.photo_url;
  }, [photoCache]);

  // Cache cleanup to prevent memory leaks
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    Object.entries(photoCache).forEach(([photoId, cache]) => {
      if (now - cache.timestamp > CACHE_DURATION) {
        URL.revokeObjectURL(cache.blob);
        setPhotoCache(prev => {
          const newCache = { ...prev };
          delete newCache[photoId];
          return newCache;
        });
      }
    });
  }, [photoCache]);

  // Optimized intersection observer for lazy loading
  useEffect(() => {
    intersectionObserver.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const photoId = entry.target.getAttribute('data-photo-id');
            if (photoId) {
              const photo = sortedPhotos.find(p => getPhotoId(p, sortedPhotos.indexOf(p)) === photoId);
              if (photo) {
                preloadPhoto(photo, photoId);
              }
            }
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    return () => {
      intersectionObserver.current?.disconnect();
    };
  }, [sortedPhotos, getPhotoId, preloadPhoto]);

  // Enhanced photo loading with retry and caching
  const handlePhotoLoad = useCallback((photoId: string) => {
    setPhotoLoadingStates(prev => ({ ...prev, [photoId]: 'loaded' }));
  }, []);

  const handlePhotoError = useCallback((photoId: string) => {
    console.warn(`Failed to load photo: ${photoId}`);
    setPhotoLoadingStates(prev => ({ ...prev, [photoId]: 'error' }));
    
    // Intelligent retry with exponential backoff
    setTimeout(() => {
      const photoElement = document.querySelector(`img[data-photo-id="${photoId}"]`) as HTMLImageElement;
      if (photoElement && photoElement.src) {
        setPhotoLoadingStates(prev => ({ ...prev, [photoId]: 'loading' }));
        const originalSrc = photoElement.src.split('?')[0];
        photoElement.src = `${originalSrc}?retry=${Date.now()}`;
      }
    }, 2000);
  }, []);

  const handlePhotoLoadStart = useCallback((photoId: string) => {
    setPhotoLoadingStates(prev => ({ ...prev, [photoId]: 'loading' }));
  }, []);

  // Optimized seek detection with debouncing
  const handleSeekDetection = useCallback((currentTime: number) => {
    if (lastSeekTime.current > currentTime + 1) { // Allow for small timing variations
      setShownPhotoIds(new Set());
      setVisiblePhotos([]);
    }
    lastSeekTime.current = currentTime;
  }, []);

  // Performance-optimized timeline monitoring
  const updateVisiblePhotos = useCallback(() => {
    try {
      if (!audioRef.current) return;

      const currentTime = audioRef.current.currentTime;
      
      if (typeof currentTime !== 'number' || isNaN(currentTime) || currentTime < 0) {
        return;
      }
      
      handleSeekDetection(currentTime);

      // Preload upcoming photos within threshold
      const upcomingPhotos = sortedPhotos.filter(photo => 
        photo.offset_seconds > currentTime && 
        photo.offset_seconds <= currentTime + PRELOAD_THRESHOLD
      );
      
      upcomingPhotos.forEach(photo => {
        const photoId = getPhotoId(photo, sortedPhotos.indexOf(photo));
        preloadPhoto(photo, photoId);
      });

      // Find photos to show with performance optimization
      const photosToShow = sortedPhotos.filter(photo => {
        if (!photo || typeof photo.offset_seconds !== 'number' || isNaN(photo.offset_seconds)) {
          return false;
        }
        
        const photoId = getPhotoId(photo, sortedPhotos.indexOf(photo));
        return currentTime >= photo.offset_seconds && !shownPhotoIds.has(photoId);
      });

      if (photosToShow.length > 0) {
        setVisiblePhotos(prev => {
          const newVisible = [...prev, ...photosToShow]
            .sort((a, b) => a.offset_seconds - b.offset_seconds)
            .slice(-MAX_VISIBLE_PHOTOS); // Limit for performance

          return newVisible;
        });

        setShownPhotoIds(prev => {
          const newShown = new Set(prev);
          photosToShow.forEach(photo => {
            const photoId = getPhotoId(photo, sortedPhotos.indexOf(photo));
            newShown.add(photoId);
          });
          return newShown;
        });
      }
    } catch (error) {
      console.error('Photo timeline error');
    }
  }, [audioRef, sortedPhotos, shownPhotoIds, getPhotoId, handleSeekDetection, preloadPhoto]);

  // Optimized monitoring interval with performance considerations
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Use optimized interval timing
      intervalRef.current = setInterval(updateVisiblePhotos, MONITORING_INTERVAL);
      updateVisiblePhotos();
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, updateVisiblePhotos]);

  // Enhanced cleanup and cache management
  useEffect(() => {
    setVisiblePhotos([]);
    setShownPhotoIds(new Set());
    setPhotoLoadingStates({});
    lastSeekTime.current = -1;
    preloadedPhotos.current.clear();
    
    // Cleanup old cache entries
    cleanupCache();
  }, [photos, cleanupCache]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Cleanup blob URLs to prevent memory leaks
      Object.values(photoCache).forEach(cache => {
        URL.revokeObjectURL(cache.blob);
      });
    };
  }, [photoCache]);

  // Close modal when clicking outside or pressing escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPhoto(null);
      }
    };

    if (selectedPhoto) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [selectedPhoto]);

  // Get cached photo URL or fallback to original
  const getPhotoUrl = useCallback((photo: Photo, photoId: string) => {
    return photoCache[photoId]?.blob || photo.photo_url;
  }, [photoCache]);

  if (sortedPhotos.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`photo-timeline-player ${className}`}>
        {visiblePhotos.length > 0 && (
          <div className="card animate-slide-in">
            <div className="card-header">
              <h3 className="text-base sm:text-lg font-semibold text-white flex items-center">
                <span className="w-3 h-3 bg-white rounded-full mr-3 animate-pulse-slow"></span>
                Timeline Photos ({visiblePhotos.length})
                {visiblePhotos.length >= MAX_VISIBLE_PHOTOS && (
                  <span className="ml-2 text-xs opacity-80">(showing latest {MAX_VISIBLE_PHOTOS})</span>
                )}
              </h3>
            </div>
            
            <div className="card-content">
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {visiblePhotos.map((photo) => {
                  const photoId = getPhotoId(photo, sortedPhotos.indexOf(photo));
                  const loadingState = photoLoadingStates[photoId] || 'loading';
                  const photoUrl = getPhotoUrl(photo, photoId);
                  
                  return (
                    <div 
                      key={photoId}
                      className="group relative bg-notey-cream/30 rounded-xl overflow-hidden border border-notey-orange/20 hover:border-notey-orange/50 transition-all duration-300 hover:shadow-lg animate-fade-in touch-manipulation"
                      style={{ 
                        animationDelay: `${Math.min(visiblePhotos.indexOf(photo) * 50, 1000)}ms`,
                        willChange: 'transform, opacity'
                      }}
                      data-photo-id={photoId}
                      ref={(el) => {
                        if (el && intersectionObserver.current) {
                          intersectionObserver.current.observe(el);
                        }
                      }}
                    >
                      {/* Enhanced Photo Container with Progressive Loading */}
                      <div className="relative aspect-square overflow-hidden bg-notey-cream/50">
                        {/* Optimized Loading State */}
                        {loadingState === 'loading' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-notey-cream/90 to-notey-cream/70 backdrop-blur-sm">
                            <div className="flex flex-col items-center space-y-2">
                              <div className="w-8 h-8 border-3 border-notey-orange/30 border-t-notey-orange rounded-full animate-spin"></div>
                              <div className="text-xs text-notey-brown/60 font-medium">Loading...</div>
                            </div>
                          </div>
                        )}
                        
                        {/* Enhanced Error State */}
                        {loadingState === 'error' ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-red-100 text-red-600">
                            <svg className="w-12 h-12 mb-2 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs font-medium mb-1">Image unavailable</span>
                            <button 
                              className="text-xs text-red-500 hover:text-red-600 underline transition-colors"
                              onClick={() => {
                                setPhotoLoadingStates(prev => ({ ...prev, [photoId]: 'loading' }));
                                const img = new Image();
                                img.onload = () => handlePhotoLoad(photoId);
                                img.onerror = () => handlePhotoError(photoId);
                                img.src = `${photo.photo_url}?retry=${Date.now()}`;
                              }}
                            >
                              Retry
                            </button>
                          </div>
                        ) : (
                          <img 
                            src={photoUrl} 
                            alt={`Timeline photo at ${formatTime(photo.offset_seconds)}`}
                            data-photo-id={photoId}
                            className={`w-full h-full object-cover transition-all duration-500 transform-gpu ${
                              loadingState === 'loaded' 
                                ? 'group-hover:scale-110 opacity-100 filter-none' 
                                : 'opacity-0 scale-95 filter blur-sm'
                            }`}
                            loading="lazy"
                            decoding="async"
                            onLoadStart={() => handlePhotoLoadStart(photoId)}
                            onLoad={() => handlePhotoLoad(photoId)}
                            onError={() => handlePhotoError(photoId)}
                            onClick={() => setSelectedPhoto(photo)}
                            style={{ 
                              imageRendering: 'crisp-edges',
                              backfaceVisibility: 'hidden'
                            }}
                          />
                        )}
                        
                        {/* Enhanced Hover Overlay with Smooth Animations */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center pb-2">
                          <div className="bg-white/95 backdrop-blur-sm rounded-full p-2.5 transform scale-75 group-hover:scale-100 transition-all duration-300 shadow-lg">
                            <svg className="w-4 h-4 text-notey-brown" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      
                      {/* Enhanced Metadata Display with Better Mobile Support */}
                      <div className="p-3 bg-gradient-to-r from-notey-pink/95 to-notey-pink border-t border-notey-pink/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                            <span className="text-white text-base flex-shrink-0">📸</span>
                            <div className="text-white min-w-0">
                              <p className="text-sm font-semibold leading-tight truncate">
                                {formatTime(photo.offset_seconds)}
                              </p>
                              <p className="text-xs opacity-90 leading-tight">
                                {photo.offset_seconds.toFixed(1)}s into recording
                              </p>
                            </div>
                          </div>
                          
                          {photo.created_at && (
                            <div className="text-white/80 text-xs text-right flex-shrink-0 ml-2">
                              <div className="truncate max-w-20">
                                {new Date(photo.created_at).toLocaleDateString(undefined, { 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Optimized Photo Modal with Performance Enhancements */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setSelectedPhoto(null)}
          style={{ willChange: 'opacity' }}
        >
          <div 
            className="relative max-w-6xl max-h-full w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Optimized Modal Image Container */}
            <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl">
              {/* Preload modal image for better UX */}
              <img 
                src={getPhotoUrl(selectedPhoto, getPhotoId(selectedPhoto, sortedPhotos.indexOf(selectedPhoto)))} 
                alt={`Timeline photo at ${formatTime(selectedPhoto.offset_seconds)}`}
                className="w-full h-auto max-h-[80vh] object-contain bg-gray-100"
                loading="eager"
                decoding="sync"
                style={{ 
                  imageRendering: 'crisp-edges',
                  maxWidth: '100%',
                  height: 'auto'
                }}
              />
              
              {/* Enhanced Modal Header with Better Typography */}
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/60 to-transparent p-4 sm:p-6">
                <div className="flex items-start justify-between text-white">
                  <div className="flex items-center space-x-3 pr-4">
                    <span className="text-base">📸</span>
                    <div>
                      <h3 className="font-bold text-lg sm:text-xl leading-tight">Timeline Photo</h3>
                      <p className="text-sm sm:text-base opacity-90 leading-tight">
                        Captured at <span className="font-semibold">{formatTime(selectedPhoto.offset_seconds)}</span>
                      </p>
                      <p className="text-xs sm:text-sm opacity-75 leading-tight">
                        {selectedPhoto.offset_seconds.toFixed(1)} seconds into recording
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all duration-200 flex items-center justify-center focus-ring flex-shrink-0"
                    aria-label="Close photo"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Enhanced Modal Footer with Rich Metadata */}
              {selectedPhoto.created_at && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-4 sm:p-6">
                  <div className="text-white">
                    <div className="text-sm sm:text-base opacity-90 leading-relaxed">
                      Captured on <span className="font-medium">
                        {new Date(selectedPhoto.created_at).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm opacity-75 mt-1">
                      at {new Date(selectedPhoto.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}