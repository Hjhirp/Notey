import { useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import ReactMarkdown from 'react-markdown';
import ReportGenerator from "./ReportGenerator";

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  sources?: any[];
  related_concepts?: string[];
}

interface ChatbotProps {
  session: Session | null;
  chatQuery: string;
  setChatQuery: (query: string) => void;
  chatLoading: boolean;
  setChatLoading: (loading: boolean) => void;
  focusConcept: string | null;
  setFocusConcept: (concept: string | null) => void;
  showChatHistory: boolean;
  setShowChatHistory: (show: boolean) => void;
  chatMessages: ChatMessage[];
  setChatMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  chatSessions: Array<{id: string, title: string, updated_at: string, message_count: number}>;
  setChatSessions: (sessions: Array<{id: string, title: string, updated_at: string, message_count: number}>) => void;
  showReportGenerator: boolean;
  setShowReportGenerator: (show: boolean) => void;
  selectedConcept: string;
  setSelectedConcept: (concept: string) => void;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  setCurrentView: (view: 'events' | 'chat') => void;
  handleReportGeneration: (concept?: string, sessionId?: string) => Promise<void>;
  loadChatSessions: () => Promise<void>;
  createChatSession: (title: string) => Promise<string | null>;
  saveMessage: (sessionId: string, type: 'user' | 'bot', content: string, sources?: any[], related_concepts?: string[]) => Promise<void>;
  loadSessionMessages: (sessionId: string) => Promise<void>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  handleChatSubmit: () => Promise<void>;
}

export default function Chatbot(props: ChatbotProps) {
  const {
    session,
    chatQuery,
    setChatQuery,
    chatLoading,
    focusConcept,
    setFocusConcept,
    showChatHistory,
    setShowChatHistory,
    chatMessages,
    setChatMessages,
    currentSessionId,
    setCurrentSessionId,
    chatSessions,
    loadSessionMessages,
    deleteChatSession,
    handleChatSubmit,
    showReportGenerator,
    setShowReportGenerator,
    selectedConcept,
    handleReportGeneration,
    selectedEventId,
    setSelectedEventId,
    setCurrentView
  } = props;

  if (showChatHistory) {
    return (
      <div className="animate-fade-in">
        {/* Chatbot Interface with History */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Notey AI</h2>
                <p className="text-xs text-slate-500">Chat History</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleReportGeneration('', currentSessionId || undefined)}
                className="flex items-center space-x-2 px-3 py-2 bg-notey-orange text-white text-sm font-medium rounded-lg hover:bg-notey-orange/90 transition-colors"
                title="Generate Report"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Report</span>
              </button>
              
              <button
                onClick={() => {
                  setShowChatHistory(false);
                  setChatMessages([]);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Back to Graph"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((message) => (
              <div key={message.id} className="flex animate-fade-in">
                <div className={`flex w-full ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'} space-x-3`}>
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.type === 'user' 
                        ? 'bg-blue-600 ml-3' 
                        : 'bg-gradient-to-r from-purple-500 to-pink-600 mr-3'
                    }`}>
                      {message.type === 'user' ? (
                        <span className="text-white text-sm font-semibold">U</span>
                      ) : (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      )}
                    </div>

                    {/* Message Content */}
                    <div className={`flex flex-col ${message.type === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-2xl px-4 py-3 ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-900'
                      }`}>
                        {message.type === 'bot' ? (
                          <div className="prose prose-sm prose-slate max-w-none">
                            <ReactMarkdown
                              components={{
                                h1: ({children}) => <h1 className="text-lg font-bold text-slate-900 mb-2">{children}</h1>,
                                h2: ({children}) => <h2 className="text-md font-semibold text-slate-800 mb-2">{children}</h2>,
                                h3: ({children}) => <h3 className="text-sm font-semibold text-slate-800 mb-1">{children}</h3>,
                                p: ({children}) => <p className="text-sm leading-relaxed mb-2 text-slate-700">{children}</p>,
                                strong: ({children}) => <strong className="font-semibold text-slate-900">{children}</strong>,
                                em: ({children}) => <em className="italic text-slate-600">{children}</em>,
                                ul: ({children}) => <ul className="list-none space-y-1 ml-0">{children}</ul>,
                                li: ({children}) => <li className="flex items-start space-x-2 text-sm text-slate-700">
                                  <span className="text-blue-500 font-bold mt-0.5">•</span>
                                  <span>{children}</span>
                                </li>,
                                code: ({children}) => <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-slate-800">{children}</code>,
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        )}
                        
                        {/* Sources and Related Concepts for Bot Messages */}
                        {message.type === 'bot' && (message.sources?.length || message.related_concepts?.length) && (
                          <div className="mt-3 space-y-2">
                            {/* Sources */}
                            {message.sources && message.sources.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-slate-600 mb-1">Sources:</div>
                                <div className="space-y-1">
                                  {message.sources.map((source: any, i: number) => (
                                    <button
                                      key={i}
                                      onClick={() => {
                                        if (source.event_id) {
                                          setSelectedEventId(source.event_id);
                                          setCurrentView('events');
                                        }
                                      }}
                                      className="w-full text-left text-xs text-slate-700 bg-white/70 hover:bg-white/90 rounded-lg px-2 py-1 transition-colors cursor-pointer"
                                    >
                                      <span className="font-medium text-blue-700 hover:text-blue-800">{source.event_title}</span>
                                      {source.event_date && (
                                        <span className="ml-2 text-slate-500">({new Date(source.event_date).toLocaleDateString()})</span>
                                      )}
                                      <div className="text-xs text-slate-400 mt-1">Click to view event</div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Related Concepts */}
                            {message.related_concepts && message.related_concepts.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-slate-600 mb-1">Related Concepts:</div>
                                <div className="flex flex-wrap gap-1">
                                  {message.related_concepts.map((concept: string, i: number) => (
                                    <button
                                      key={i}
                                      onClick={() => setFocusConcept(concept)}
                                      className="inline-block bg-orange-100 text-orange-700 hover:bg-orange-200 px-2 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer"
                                    >
                                      {concept}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Report Generation Actions */}
                            {message.related_concepts && message.related_concepts.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs font-semibold text-slate-600 mb-1">Actions:</div>
                                <div className="flex flex-wrap gap-2">
                                  {message.related_concepts.map((concept: string, i: number) => (
                                    <button
                                      key={`report-${i}`}
                                      onClick={() => handleReportGeneration(concept, currentSessionId || undefined)}
                                      className="inline-flex items-center space-x-1 bg-notey-orange/10 text-notey-orange hover:bg-notey-orange/20 px-2 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <span>Generate Report</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <span className="text-xs text-slate-400 mt-1 px-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {chatLoading && (
              <div className="flex justify-start animate-fade-in">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="bg-slate-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSubmit();
                    }
                  }}
                  placeholder="Ask about your notes..."
                  disabled={chatLoading}
                  className="w-full px-4 py-3 pr-12 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={chatLoading || !chatQuery.trim()}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {chatLoading ? (
                    <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Question Bar + 3D Graph view
  return (
    <div className="space-y-6">
      {/* Question Input Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Ask about your notes</h3>
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSubmit();
                }
              }}
              placeholder="What would you like to know about your notes?"
              disabled={chatLoading}
              className="w-full px-4 py-3 pr-12 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleChatSubmit}
              disabled={chatLoading || !chatQuery.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {chatLoading ? (
                <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        {/* Quick suggestions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {['What patterns do you see in my [topic] notes?', 'Help me connect ideas about [topic]', 'What should I explore next about [subject]?', 'Summarize my key insights on [topic]'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setChatQuery(suggestion)}
              disabled={chatLoading}
              className="px-3 py-1 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}