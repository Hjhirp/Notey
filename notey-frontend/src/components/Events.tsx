import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import config from "../config";

const BACKEND_URL = config.BACKEND_URL;

interface Event {
  id: string;
  title?: string;
  started_at: string;
}

export default function Events({
  session,
  onSelectEvent,
  selectedEventId,
  onEventDeleted,
}: {
  session: Session | null;
  onSelectEvent: (id: string) => void;
  selectedEventId?: string | null;
  onEventDeleted?: (id: string) => void;
}) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!session) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const token = session?.access_token;
        const res = await fetch(`${BACKEND_URL}/events`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!res.ok) {
          throw new Error('Failed to fetch events');
        }
        
        const json = await res.json();
        setEvents(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
        console.error('Error fetching events:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [session]);

  const deleteEvent = async (eventId: string) => {
    if (!session?.access_token) return;
    
    setDeletingId(eventId);
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

      // Remove from local state
      setEvents(prev => prev.filter(event => event.id !== eventId));
      
      // Clear selection if this event was selected
      if (selectedEventId === eventId && onEventDeleted) {
        onEventDeleted(eventId);
      }
      
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting event:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation(); // Prevent event selection
    setShowDeleteConfirm(eventId);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  return (
    <div className="animate-slide-in">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          📂 Your Events
        </h2>
      </div>

      {/* Events list container */}
      <div>
        {isLoading ? (
          // Loading state with branded spinner
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-notey-orange border-t-transparent mx-auto mb-3"></div>
            <p className="text-slate-600 text-sm">Loading events...</p>
          </div>
        ) : error ? (
          // Error state with retry option
          <div className="text-center py-8">
            <div className="text-2xl mb-3">⚠️</div>
            <h3 className="text-sm font-medium text-slate-900 mb-2">
              Something went wrong
            </h3>
            <p className="text-slate-600 text-xs mb-4">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-notey-orange text-white rounded-lg hover:bg-notey-orange/90 transition-colors text-xs font-medium"
            >
              Try Again
            </button>
          </div>
        ) : events.length === 0 ? (
          // Empty state with warm, friendly messaging
          <div className="text-center py-8">
            <div className="text-3xl mb-3">📝</div>
            <h3 className="text-sm font-medium text-slate-900 mb-2">
              No events yet
            </h3>
            <p className="text-slate-600 text-xs">
              Start recording to see your events here
            </p>
          </div>
        ) : (
          // Events list with proper spacing
          <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
            {events.map((event) => (
              <div key={event.id} className="relative">
                <div
                  className={`group p-3 rounded-lg border transition-all duration-200 cursor-pointer touch-manipulation ${
                    selectedEventId === event.id 
                      ? 'border-notey-orange bg-notey-orange/5' 
                      : 'border-slate-200 hover:border-notey-orange/30 hover:bg-slate-50'
                  }`}
                  onClick={() => onSelectEvent(event.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Event title */}
                      <h3 className={`text-sm font-medium mb-1 transition-colors duration-200 line-clamp-2 ${
                        selectedEventId === event.id 
                          ? 'text-notey-orange' 
                          : 'text-slate-900 group-hover:text-notey-orange'
                      }`}>
                        {event.title || "Untitled Event"}
                      </h3>
                      
                      {/* Date */}
                      <p className="text-xs text-slate-500">
                        {new Date(event.started_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteClick(e, event.id)}
                      disabled={deletingId === event.id}
                      className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-slate-400 hover:text-red-500 transition-all duration-200 disabled:opacity-50"
                      title="Delete event"
                    >
                      {deletingId === event.id ? (
                        <div className="animate-spin w-4 h-4 border border-slate-400 border-t-transparent rounded-full"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Delete confirmation modal */}
                {showDeleteConfirm === event.id && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCancelDelete}>
                    <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                      <div className="text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Event</h3>
                        <p className="text-slate-600 mb-6">
                          Are you sure you want to delete "{event.title || 'Untitled Event'}"? This action cannot be undone.
                        </p>
                        <div className="flex space-x-3">
                          <button
                            onClick={handleCancelDelete}
                            className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            disabled={deletingId === event.id}
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                          >
                            {deletingId === event.id ? (
                              <>
                                <div className="animate-spin w-4 h-4 border border-white border-t-transparent rounded-full mr-2"></div>
                                Deleting...
                              </>
                            ) : (
                              'Delete'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
