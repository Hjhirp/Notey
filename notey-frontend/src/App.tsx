import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Analytics } from "@vercel/analytics/react";
import Auth from "./components/Auth";
import Recorder from "./components/Recorder";
import Events from "./components/Events";
import Replay from "./components/Replay";
import Navbar from "./components/Navbar";
import NotesGraph3D from "./components/NotesGraph3D";

type ViewType = 'events' | 'graph';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('events');
  const [isLoading, setIsLoading] = useState(true);

  const handleEventDeleted = (deletedEventId: string) => {
    if (selectedEventId === deletedEventId) {
      setSelectedEventId(null);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      } catch (error) {
        console.error("Authentication error");
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setSession(session);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-notey-cream to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-notey-orange mx-auto mb-4"></div>
          <p className="text-notey-brown">Loading Notey...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Enhanced Navbar */}
      <Navbar session={session} setSession={setSession} />
      
      {!session ? (
        /* Landing Page - Notion-like Hero Section */
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-notey-cream/30">
          <div className="container mx-auto px-6 py-20 max-w-6xl">
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-notey-orange/10 rounded-2xl mb-8">
                <img 
                  src="/notey.png" 
                  alt="Notey Logo" 
                  className="w-12 h-12 object-contain"
                  onError={(e) => {
                    // Fallback to emoji if logo fails to load
                    const target = e.target as HTMLImageElement;
                    target.outerHTML = '<span class="text-4xl">🎙️</span>';
                  }}
                />
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 mb-6 leading-tight">
                Your voice,
                <br />
                <span className="text-notey-orange">transcribed & organized</span>
              </h1>
              <p className="text-xl sm:text-2xl text-slate-600 mb-12 max-w-3xl mx-auto leading-relaxed">
                Record audio notes, get AI-powered transcriptions and summaries. 
                Never lose an important thought again.
              </p>
            </div>

            {/* Auth Section */}
            <div className="max-w-md mx-auto">
              <Auth session={session} setSession={setSession} />
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-8 mt-20">
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-notey-orange/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Smart Recording</h3>
                <p className="text-slate-600">One-click recording with automatic transcription and AI summarization</p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-notey-pink/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📝</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">AI Summaries</h3>
                <p className="text-slate-600">Get concise summaries of your recordings with key insights highlighted</p>
              </div>
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-notey-orange/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🗂️</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Organized</h3>
                <p className="text-slate-600">All your notes organized and searchable in one beautiful interface</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Main App Interface - Notion-like Layout */
        <div className="min-h-screen bg-slate-50">
          <div className="flex">
            {/* Sidebar */}
            <div className="hidden lg:flex lg:w-80 lg:flex-col lg:fixed lg:inset-y-0 lg:pt-16">
              <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-slate-200">
                <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                  {/* Navigation Tabs */}
                  <div className="px-6 mb-6">
                    <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
                      <button
                        onClick={() => setCurrentView('events')}
                        className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          currentView === 'events'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="mr-2">🎧</span>
                        Events
                      </button>
                      <button
                        onClick={() => setCurrentView('graph')}
                        className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          currentView === 'graph'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="mr-2">🕸️</span>
                        Graph
                      </button>
                    </div>
                  </div>

                  {currentView === 'events' ? (
                    <>
                      <div className="px-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
                        <Recorder session={session} />
                      </div>
                      <div className="mt-8 px-6">
                        <Events 
                          session={session} 
                          onSelectEvent={setSelectedEventId}
                          selectedEventId={selectedEventId}
                          onEventDeleted={handleEventDeleted}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="px-6">
                      <h2 className="text-lg font-semibold text-slate-900 mb-4">Concept Graph</h2>
                      <p className="text-sm text-slate-600 mb-4">
                        Explore relationships between your events, chunks, and concepts in an interactive 3D visualization.
                      </p>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 space-y-1">
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                            <span>Events</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            <span>Audio Chunks</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                            <span>Concepts</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:pl-80 flex flex-col flex-1">
              <main className="flex-1 pt-16">
                <div className="py-8 px-6">
                  {/* Mobile Layout - Show navigation tabs */}
                  <div className="lg:hidden mb-6">
                    <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
                      <button
                        onClick={() => setCurrentView('events')}
                        className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          currentView === 'events'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="mr-2">🎧</span>
                        Events
                      </button>
                      <button
                        onClick={() => setCurrentView('graph')}
                        className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          currentView === 'graph'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="mr-2">🕸️</span>
                        Graph
                      </button>
                    </div>
                  </div>

                  {/* Mobile Events Layout */}
                  {currentView === 'events' && (
                    <div className="lg:hidden space-y-6 mb-8">
                      <Recorder session={session} />
                      <Events 
                        session={session} 
                        onSelectEvent={setSelectedEventId}
                        selectedEventId={selectedEventId}
                        onEventDeleted={handleEventDeleted}
                      />
                    </div>
                  )}

                  {/* Content Area */}
                  <div className="max-w-6xl mx-auto">
                    {currentView === 'graph' ? (
                      <div className="animate-fade-in">
                        <NotesGraph3D 
                          session={session} 
                          eventId={selectedEventId || undefined}
                          className=""
                        />
                      </div>
                    ) : selectedEventId ? (
                      <div className="animate-fade-in max-w-4xl mx-auto">
                        <Replay eventId={selectedEventId} session={session} onEventDeleted={handleEventDeleted} />
                      </div>
                    ) : (
                      <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-2xl mb-6">
                          <span className="text-3xl">🎧</span>
                        </div>
                        <h3 className="text-2xl font-semibold text-slate-900 mb-3">
                          Select an event to get started
                        </h3>
                        <p className="text-slate-600 max-w-md mx-auto">
                          Choose an event from your sidebar to view its transcript, summary, and audio player
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      )}
      <Analytics />
    </div>
  );
}

export default App;
