import { useEffect, useState, useCallback } from "react";
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
  const [chatQuery, setChatQuery] = useState('');
  const [chatResponse, setChatResponse] = useState<any>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [focusConcept, setFocusConcept] = useState<string | null>(null);

  const handleEventDeleted = (deletedEventId: string) => {
    if (selectedEventId === deletedEventId) {
      setSelectedEventId(null);
    }
  };

  // Chat functionality
  const handleChatSubmit = useCallback(async () => {
    if (!chatQuery.trim() || chatLoading) return;
    
    setChatLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          query: chatQuery
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setChatResponse(data);
      // Focus on the most relevant concept node if available
      if (data.related_concepts && data.related_concepts.length > 0) {
        setFocusConcept(data.related_concepts[0]);
        setCurrentView('graph'); // Switch to graph view automatically
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setChatResponse(`Sorry, I encountered an error while processing your question: ${errorMessage}`);
    } finally {
      setChatLoading(false);
    }
  }, [chatQuery, chatLoading, session?.access_token]);

  const handleChatKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  }, [handleChatSubmit]);

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
                    <div className="px-6 flex flex-col h-full">
                      <h2 className="text-lg font-semibold text-slate-900 mb-4">Concept Graph</h2>
                      <p className="text-sm text-slate-600 mb-4">
                        Explore relationships between your events and concepts in an interactive 3D visualization.
                      </p>
                      
                      {/* Chat Interface */}
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-slate-900 mb-2">Ask Questions</h3>
                        <p className="text-xs text-slate-500 mb-3">
                          Ask questions like "What concepts are related to machine learning?" or "Show me events about product development"
                        </p>
                        
                        {/* Chat Input */}
                        <div className="relative mb-3">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            value={chatQuery}
                            onChange={(e) => setChatQuery(e.target.value)}
                            onKeyPress={handleChatKeyPress}
                            placeholder="Ask about your concepts..."
                            disabled={chatLoading}
                            className="block w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                          />
                          <button 
                            onClick={handleChatSubmit}
                            disabled={chatLoading || !chatQuery.trim()}
                            className="absolute inset-y-0 right-0 pr-2 flex items-center disabled:opacity-50"
                          >
                            {chatLoading ? (
                              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                            ) : (
                              <svg className="h-4 w-4 text-blue-600 hover:text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* Chat Response */}
                        {chatResponse && (
                          <div className="bg-white border border-blue-200 rounded-xl p-5 mb-4 shadow-md animate-fade-in">
                            <div className="flex items-start gap-3 mb-2">
                              <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
                                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <div className="text-base text-blue-900 font-medium whitespace-pre-wrap mb-2">{chatResponse.answer || chatResponse}</div>
                                {/* Show sources and related concepts if available */}
                                {Array.isArray(chatResponse.sources) && chatResponse.sources.length > 0 && (
                                  <div className="mt-3">
                                    <div className="font-semibold text-xs text-slate-500 mb-1">Sources:</div>
                                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                                      {chatResponse.sources.map((src: any, i: number) => (
                                        <li key={i}>
                                          <span className="font-medium text-blue-700">{src.event_title}</span>
                                          {src.event_date && (
                                            <span className="ml-2 text-slate-400">({src.event_date})</span>
                                          )}
                                          {src.concept_score && (
                                            <span className="ml-2 text-xs text-orange-600">Score: {src.concept_score.toFixed(2)}</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {Array.isArray(chatResponse.related_concepts) && chatResponse.related_concepts.length > 0 && (
                                  <div className="mt-3">
                                    <div className="font-semibold text-xs text-slate-500 mb-1">Related Concepts:</div>
                                    <div className="flex flex-wrap gap-2">
                                      {chatResponse.related_concepts.map((concept: string, i: number) => (
                                        <span key={i} className="inline-block bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-semibold">
                                          {concept}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => setChatResponse(null)}
                                className="flex-shrink-0 text-blue-400 hover:text-blue-600 mt-1"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Legend */}
                      <div className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 space-y-1">
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                            <span>Events</span>
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
                          focusConceptName={focusConcept || undefined}
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
