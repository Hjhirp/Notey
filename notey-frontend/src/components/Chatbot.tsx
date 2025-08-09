import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session } from "@supabase/supabase-js";
import ReportGenerator from './ReportGenerator';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  sources?: Array<{
    event_title: string;
    event_date?: string;
    concept_score?: number;
  }>;
  related_concepts?: string[];
}

interface ChatbotProps {
  session: Session | null;
  onFocusConcept?: (concept: string) => void;
  onSwitchToGraph?: () => void;
}

export default function Chatbot({ session, onFocusConcept, onSwitchToGraph }: ChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Add welcome message on mount
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        type: 'bot',
        content: "Hi! I'm your Notey AI assistant. I can help you find information in your notes and recordings. Try asking me something like:\n\n• \"What did we discuss about machine learning?\"\n• \"Show me notes about project planning\"\n• \"Find content related to web development\"\n• \"Generate a report about [topic]\"\n• \"Create PDF report for [concept]\"",
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || isLoading || !session) return;

    // Check if user is asking for a report
    const reportRequest = detectReportRequest(inputValue);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Handle report requests differently
    if (reportRequest.isReportRequest) {
      if (reportRequest.concept) {
        // Auto-trigger report generation with the extracted concept
        setSelectedConcept(reportRequest.concept);
        setShowReportGenerator(true);
        
        const reportBotMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: `I'll generate a PDF report about "${reportRequest.concept}" for you. This will include all related events, transcripts, and photos.`,
          timestamp: new Date(),
          related_concepts: [reportRequest.concept]
        };
        
        setMessages(prev => [...prev, reportBotMessage]);
      } else {
        // Extract potential concepts from the user's message
        const extractedConcepts = extractConceptsFromMessage(inputValue);
        
        if (extractedConcepts.length > 0) {
          // Use the first extracted concept
          setSelectedConcept(extractedConcepts[0]);
          setShowReportGenerator(true);
          
          const reportBotMessage: ChatMessage = {
            id: `bot-${Date.now()}`,
            type: 'bot',
            content: `I'll generate a PDF report about "${extractedConcepts[0]}" for you. This will include all related events, transcripts, and photos.`,
            timestamp: new Date(),
            related_concepts: extractedConcepts
          };
          
          setMessages(prev => [...prev, reportBotMessage]);
        } else {
          // Fallback: trigger report generator without a specific concept
          setSelectedConcept('');
          setShowReportGenerator(true);
          
          const reportBotMessage: ChatMessage = {
            id: `bot-${Date.now()}`,
            type: 'bot',
            content: `I'll help you generate a PDF report. Please specify which concept or topic you'd like the report to cover in the report generator.`,
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, reportBotMessage]);
        }
      }
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/chat/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          query: inputValue
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        type: 'bot',
        content: data.answer || data,
        timestamp: new Date(),
        sources: data.sources || [],
        related_concepts: data.related_concepts || []
      };

      setMessages(prev => [...prev, botMessage]);

      // Focus on the most relevant concept if available
      if (data.related_concepts && data.related_concepts.length > 0 && onFocusConcept) {
        onFocusConcept(data.related_concepts[0]);
        onSwitchToGraph?.();
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      const errorBotMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'bot',
        content: `Sorry, I encountered an error while processing your question: ${errorMessage}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isLoading, session, onFocusConcept, onSwitchToGraph]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = () => {
    setMessages([]);
    // Re-add welcome message
    setTimeout(() => {
      const welcomeMessage: ChatMessage = {
        id: 'welcome-new',
        type: 'bot',
        content: "Chat cleared! How can I help you today?",
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }, 100);
  };

  // Detect if user is asking for a report and extract concepts
  const detectReportRequest = (userInput: string): { isReportRequest: boolean; concept?: string } => {
    const reportKeywords = ['report', 'generate report', 'create report', 'pdf', 'summary report', 'export'];
    const lowerInput = userInput.toLowerCase();
    
    const isReportRequest = reportKeywords.some(keyword => lowerInput.includes(keyword));
    
    if (isReportRequest) {
      // Try to extract concept from phrases like "generate report about X" or "create report for Y"
      const aboutMatch = lowerInput.match(/(?:report|pdf|summary)(?:\s+(?:about|on|for|of)\s+)([^.?!]+)/);
      if (aboutMatch) {
        return { isReportRequest: true, concept: aboutMatch[1].trim() };
      }
    }
    
    return { isReportRequest, concept: undefined };
  };

  // Extract potential concepts from user message using common patterns
  const extractConceptsFromMessage = (message: string): string[] => {
    const concepts: string[] = [];
    const lowerMessage = message.toLowerCase();
    
    // Common patterns for concept extraction
    const patterns = [
      // "about X", "on X", "regarding X"
      /(?:about|on|regarding|concerning)\s+([a-zA-Z\s]+?)(?:\s|$|[.!?])/gi,
      // "X notes", "X project", "X concepts"
      /([a-zA-Z\s]+?)\s+(?:notes|project|concepts|ideas|recordings|meetings)/gi,
      // "machine learning", "web development", etc. (common technical terms)
      /(machine learning|web development|project planning|data science|artificial intelligence|software engineering|user experience|mobile development|cloud computing|database design)/gi,
      // Extract quoted concepts
      /"([^"]+)"/g,
      // Extract single quoted concepts
      /'([^']+)'/g
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const concept = match[1]?.trim();
        if (concept && concept.length > 2 && !concepts.includes(concept)) {
          concepts.push(concept);
        }
      }
    });
    
    // If no specific concepts found, try to extract meaningful keywords
    if (concepts.length === 0) {
      const words = message.replace(/[^\w\s]/gi, '').split(/\s+/);
      const meaningfulWords = words.filter(word => 
        word.length > 3 && 
        !['report', 'generate', 'create', 'make', 'about', 'with', 'from', 'this', 'that', 'have', 'been', 'will', 'what', 'when', 'where', 'how'].includes(word.toLowerCase())
      );
      
      if (meaningfulWords.length > 0) {
        concepts.push(meaningfulWords.slice(0, 3).join(' '));
      }
    }
    
    return concepts;
  };

  const handleReportGeneration = (concept?: string) => {
    setSelectedConcept(concept || '');
    setShowReportGenerator(true);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white">
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
            <p className="text-xs text-slate-500">Ask questions about your notes</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleReportGeneration()}
            className="flex items-center space-x-2 px-3 py-2 bg-notey-orange text-white text-sm font-medium rounded-lg hover:bg-notey-orange/90 transition-colors"
            title="Generate Report"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Report</span>
          </button>
          
          <button
            onClick={clearChat}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Clear chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
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
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    
                    {/* Sources and Related Concepts for Bot Messages */}
                    {message.type === 'bot' && (message.sources?.length || message.related_concepts?.length) && (
                      <div className="mt-3 space-y-2">
                        {/* Sources */}
                        {message.sources && message.sources.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-slate-600 mb-1">Sources:</div>
                            <div className="space-y-1">
                              {message.sources.map((source, i) => (
                                <div key={i} className="text-xs text-slate-700 bg-white/70 rounded-lg px-2 py-1">
                                  <span className="font-medium text-blue-700">{source.event_title}</span>
                                  {source.event_date && (
                                    <span className="ml-2 text-slate-500">({source.event_date})</span>
                                  )}
                                  {source.concept_score && (
                                    <span className="ml-2 text-orange-600">Score: {source.concept_score.toFixed(2)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Related Concepts */}
                        {message.related_concepts && message.related_concepts.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-slate-600 mb-1">Related Concepts:</div>
                            <div className="flex flex-wrap gap-1">
                              {message.related_concepts.map((concept, i) => (
                                <button
                                  key={i}
                                  onClick={() => onFocusConcept?.(concept)}
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
                              {message.related_concepts.map((concept, i) => (
                                <button
                                  key={`report-${i}`}
                                  onClick={() => handleReportGeneration(concept)}
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
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
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
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your notes..."
              disabled={isLoading}
              className="w-full px-4 py-3 pr-12 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading || !inputValue.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
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
          {['What did I record today?', 'Show me project notes', 'Find ML concepts', 'Generate report about...'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setInputValue(suggestion)}
              disabled={isLoading}
              className="px-3 py-1 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Report Generator Modal */}
      {showReportGenerator && (
        <ReportGenerator
          session={session}
          concept={selectedConcept}
          onClose={() => setShowReportGenerator(false)}
        />
      )}
    </div>
  );
}