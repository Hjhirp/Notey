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
import ReportGenerator from "./components/ReportGenerator";
import Chatbot from "./components/Chatbot";
import ReactMarkdown from 'react-markdown';

type ViewType = 'events' | 'chat';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('events');
  const [isLoading, setIsLoading] = useState(true);
  const [chatQuery, setChatQuery] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [focusConcept, setFocusConcept] = useState<string | null>(null);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{id: string, type: 'user' | 'bot', content: string, timestamp: Date, sources?: any[], related_concepts?: string[]}>>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<Array<{id: string, title: string, updated_at: string, message_count: number}>>([]);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string>('');
  const [chatSources, setChatSources] = useState<Array<{event_id: string, event_title: string, event_date: string}>>([]);

  const handleEventDeleted = (deletedEventId: string) => {
    if (selectedEventId === deletedEventId) {
      setSelectedEventId(null);
    }
  };

  // Load chat sessions
  const loadChatSessions = useCallback(async () => {
    if (!session?.access_token) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat/sessions`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const sessions = await response.json();
        setChatSessions(sessions);
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    }
  }, [session?.access_token]);

  // Create new chat session
  const createChatSession = useCallback(async (title: string) => {
    if (!session?.access_token) return null;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title }),
      });
      
      if (response.ok) {
        const newSession = await response.json();
        loadChatSessions(); // Refresh the list
        return newSession.id;
      }
    } catch (error) {
      console.error('Failed to create chat session:', error);
    }
    return null;
  }, [session?.access_token, loadChatSessions]);

  // Save message to specific session
  const saveMessage = useCallback(async (sessionId: string, type: 'user' | 'bot', content: string, sources?: any[], related_concepts?: string[]) => {
    if (!session?.access_token || !sessionId) return;
    
    try {
      const requestBody = {
        session_id: sessionId,
        type,
        content,
        sources,
        related_concepts,
      };
      
      console.log('Saving message with payload:', requestBody);
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to save message - Response:', response.status, errorText);
      } else {
        console.log('Message saved successfully');
      }
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  }, [session?.access_token]);

  // Load messages for a session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    if (!session?.access_token) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat/sessions/${sessionId}/messages`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const messages = await response.json();
        const formattedMessages = messages.map((msg: any) => ({
          id: msg.id,
          type: msg.type,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          sources: msg.sources || [],
          related_concepts: msg.related_concepts || []
        }));
        setChatMessages(formattedMessages);
        setCurrentSessionId(sessionId);
        setShowChatHistory(true);
      }
    } catch (error) {
      console.error('Failed to load session messages:', error);
    }
  }, [session?.access_token]);

  // Delete chat session
  const deleteChatSession = useCallback(async (sessionId: string) => {
    if (!session?.access_token) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        // If we're currently viewing this session, clear it
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setChatMessages([]);
          setShowChatHistory(false);
        }
        // Refresh the session list
        loadChatSessions();
      }
    } catch (error) {
      console.error('Failed to delete chat session:', error);
    }
  }, [session?.access_token, currentSessionId, loadChatSessions]);

  // Chat functionality
  const handleChatSubmit = useCallback(async () => {
    if (!chatQuery.trim() || chatLoading) return;
    
    let sessionId = currentSessionId;
    
    // Create new session if none exists
    if (!sessionId) {
      const title = chatQuery.slice(0, 50) + (chatQuery.length > 50 ? '...' : '');
      sessionId = await createChatSession(title);
      if (!sessionId) return;
      setCurrentSessionId(sessionId);
    }
    
    const userMessage = {
      id: `user-${Date.now()}`,
      type: 'user' as const,
      content: chatQuery,
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setShowChatHistory(true);
    setChatLoading(true);
    setChatQuery('');
    
    // Save user message to database
    await saveMessage(sessionId, 'user', userMessage.content);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          query: userMessage.content
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const botMessage = {
        id: `bot-${Date.now()}`,
        type: 'bot' as const,
        content: data.answer || data,
        timestamp: new Date(),
        sources: data.sources || [],
        related_concepts: data.related_concepts || []
      };
      
      setChatMessages(prev => [...prev, botMessage]);
      
      // Save bot message to database
      await saveMessage(sessionId, 'bot', botMessage.content, botMessage.sources, botMessage.related_concepts);
      
      // Focus on the most relevant concept node if available
      if (data.related_concepts && data.related_concepts.length > 0) {
        setFocusConcept(data.related_concepts[0]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      const errorBotMessage = {
        id: `error-${Date.now()}`,
        type: 'bot' as const,
        content: `Sorry, I encountered an error while processing your question: ${errorMessage}`,
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, errorBotMessage]);
      // Save error message to database
      await saveMessage(sessionId, 'bot', errorBotMessage.content);
    } finally {
      setChatLoading(false);
    }
  }, [chatQuery, chatLoading, session?.access_token, currentSessionId, createChatSession, saveMessage]);


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

  // Extract sources from the latest bot message for a specific session
  const getChatSourcesForSession = async (sessionId: string) => {
    if (!session?.access_token) return [];
    
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat/sessions/${sessionId}/messages`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const messages = await response.json();
        const latestBotMessage = messages
          .filter((msg: any) => msg.type === 'bot')
          .pop(); // Get the most recent bot message
        
        // Convert sources from the latest bot message to the format expected by ReportGenerator
        if (latestBotMessage?.sources && Array.isArray(latestBotMessage.sources)) {
          return latestBotMessage.sources.map((source: any) => ({
            event_id: source.event_id,
            event_title: source.event_title,
            event_date: source.event_date
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load session messages for report:', error);
    }
    
    return [];
  };

  // Handle report generation
  const handleReportGeneration = async (concept?: string, sessionId?: string) => {
    let chatSources: Array<{event_id: string, event_title: string, event_date: string}> = [];
    
    if (sessionId) {
      chatSources = await getChatSourcesForSession(sessionId);
      // When generating from chat context, use a descriptive title
      if (chatSources.length > 0) {
        setSelectedConcept(`Chat Context Report (${chatSources.length} source${chatSources.length !== 1 ? 's' : ''})`);
      } else {
        setSelectedConcept('Chat Context Report (No sources found)');
      }
    } else {
      setSelectedConcept(concept || '');
    }
    
    setChatSources(chatSources);
    setShowReportGenerator(true);
  };

  // Load chat sessions when user logs in
  useEffect(() => {
    if (session?.access_token) {
      loadChatSessions();
    }
  }, [session?.access_token, loadChatSessions]);

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
                        onClick={() => setCurrentView('chat')}
                        className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          currentView === 'chat'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="mr-2">💬</span>
                        Chat
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
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Chat History</h2>
                        <button
                          onClick={() => {
                            setCurrentSessionId(null);
                            setChatMessages([]);
                            setShowChatHistory(false);
                          }}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="New Chat"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto space-y-2">
                        {chatSessions.length > 0 ? (
                          chatSessions.map((session) => (
                            <div
                              key={session.id}
                              className={`relative group rounded-lg border transition-colors ${
                                currentSessionId === session.id
                                  ? 'bg-blue-50 border-blue-200'
                                  : 'bg-white border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <button
                                onClick={() => loadSessionMessages(session.id)}
                                className="w-full text-left p-3 pr-16"
                              >
                                <div className="font-medium text-sm text-slate-900 mb-1 line-clamp-2">
                                  {session.title}
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span>{session.message_count} messages</span>
                                  <span>{new Date(session.updated_at).toLocaleDateString()}</span>
                                </div>
                              </button>
                              
                              {/* Action Buttons */}
                              <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Generate Report Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReportGeneration('', session.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                  title="Generate Report"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </button>
                                
                                {/* Delete Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Delete this chat? This action cannot be undone.')) {
                                      deleteChatSession(session.id);
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                  title="Delete chat"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-slate-500">
                            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                            <p className="text-sm">No chat history yet</p>
                            <p className="text-xs mt-1">Start a conversation to see it here</p>
                          </div>
                        )}
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
                        onClick={() => setCurrentView('chat')}
                        className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          currentView === 'chat'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="mr-2">💬</span>
                        Chat
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
                    {currentView === 'chat' ? (
                      <div className="animate-fade-in">
                        <Chatbot
                          session={session}
                          chatQuery={chatQuery}
                          setChatQuery={setChatQuery}
                          chatLoading={chatLoading}
                          setChatLoading={setChatLoading}
                          focusConcept={focusConcept}
                          setFocusConcept={setFocusConcept}
                          showChatHistory={showChatHistory}
                          setShowChatHistory={setShowChatHistory}
                          chatMessages={chatMessages}
                          setChatMessages={setChatMessages}
                          currentSessionId={currentSessionId}
                          setCurrentSessionId={setCurrentSessionId}
                          chatSessions={chatSessions}
                          setChatSessions={setChatSessions}
                          showReportGenerator={showReportGenerator}
                          setShowReportGenerator={setShowReportGenerator}
                          selectedConcept={selectedConcept}
                          setSelectedConcept={setSelectedConcept}
                          selectedEventId={selectedEventId}
                          setSelectedEventId={setSelectedEventId}
                          setCurrentView={setCurrentView}
                          handleReportGeneration={handleReportGeneration}
                          loadChatSessions={loadChatSessions}
                          createChatSession={createChatSession}
                          saveMessage={saveMessage}
                          loadSessionMessages={loadSessionMessages}
                          deleteChatSession={deleteChatSession}
                          handleChatSubmit={handleChatSubmit}
                        />
                        {!showChatHistory && (
                          <div className="mt-6 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                            <NotesGraph3D 
                              session={session} 
                              eventId={selectedEventId || undefined}
                              className=""
                              focusConceptName={focusConcept || undefined}
                            />
                          </div>
                        )}
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
      
      {/* Report Generator Modal */}
      {showReportGenerator && (
        <ReportGenerator
          session={session}
          concept={selectedConcept}
          onClose={() => {
            setShowReportGenerator(false);
            setChatSources([]); // Clear chat sources when closing
          }}
          relatedConcepts={chatSources.length > 0 ? chatSources : undefined}
        />
      )}
      
      <Analytics />
    </div>
  );
}

export default App;
