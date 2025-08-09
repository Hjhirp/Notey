import { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph3D from '3d-force-graph';
import { exportGraph, getGraphStats, getChunkConcepts, GraphNode, GraphLink, GraphStats } from '../lib/api';

interface NotesGraph3DProps {
  session?: any;
  eventId?: string;
  className?: string;
  focusConceptName?: string;
}

interface ConceptEvent {
  concept_name: string;
  events: Array<{
    event_id: string;
    event_title: string;
    total_score: number;
    mention_count: number;
  }>;
}

interface SidePanelData {
  type: 'chunk' | 'concept';
  data: any;
  relatedData?: any[];
}

export default function NotesGraph3D({ session, eventId, className = '', focusConceptName }: NotesGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [],
    links: []
  });
  const [conceptEvents, setConceptEvents] = useState<ConceptEvent[]>([]);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanelData | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredConceptEvents, setFilteredConceptEvents] = useState<ConceptEvent[]>([]);

  const loadGraphData = useCallback(async () => {
    if (!session?.access_token) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load graph data and stats in parallel
      const [graphResponse, statsResponse] = await Promise.all([
        exportGraph(eventId, 500, session),
        getGraphStats(eventId, session)
      ]);

      setGraphData(graphResponse);
      setStats(statsResponse);

      // Build concept-events mapping for list view
      const conceptEventsMap: { [key: string]: ConceptEvent } = {};
      
      // Process the graph data to build concept-events relationships
      graphResponse.links
        .filter(link => link.type === 'MENTIONS' && link.source.startsWith('event_'))
        .forEach(link => {
          const conceptId = link.target.replace('concept_', '');
          const eventId = link.source.replace('event_', '');
          
          // Find the concept and event nodes
          const conceptNode = graphResponse.nodes.find(n => n.id === link.target);
          const eventNode = graphResponse.nodes.find(n => n.id === link.source);
          
          if (conceptNode && eventNode) {
            const conceptName = conceptNode.label;
            
            if (!conceptEventsMap[conceptName]) {
              conceptEventsMap[conceptName] = {
                concept_name: conceptName,
                events: []
              };
            }
            
            conceptEventsMap[conceptName].events.push({
              event_id: eventId,
              event_title: eventNode.label,
              total_score: link.score || 1.0,
              mention_count: 1 // This would be aggregated in a real implementation
            });
          }
        });

      // Convert to array and sort by number of events
      const conceptEventsList = Object.values(conceptEventsMap)
        .sort((a, b) => b.events.length - a.events.length);
      
      setConceptEvents(conceptEventsList);
      setFilteredConceptEvents(conceptEventsList); // Initialize filtered results

      // Initialize or update the graph
      if (graphRef.current && containerRef.current) {
        // Configure the graph with the new data
        graphRef.current
          .graphData(graphResponse)
          .nodeAutoColorBy('type')
          .nodeLabel((node: GraphNode) => `${node.type}: ${node.label}`)
          .linkLabel((link: GraphLink) => `${link.type} (${link.score?.toFixed(2) || '1.00'})`)
          .onNodeClick(handleNodeClick)
          .onNodeHover(handleNodeHover);
      }

    } catch (err) {
      console.error('Failed to load graph data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  }, [session, eventId]);

  const handleNodeClick = useCallback(async (node: GraphNode) => {
    if (!session?.access_token) return;

    try {
      if (node.type === 'chunk') {
        // Load chunk details and related concepts
        const chunkId = node.metadata?.chunk_id;
        if (chunkId) {
          const concepts = await getChunkConcepts(chunkId, session);
          setSidePanel({
            type: 'chunk',
            data: node,
            relatedData: concepts
          });
          setShowSidePanel(true);
        }
      } else if (node.type === 'concept') {
        // Find all chunks that mention this concept
        const relatedChunks = graphData.links
          .filter(link => link.target === node.id && link.type === 'MENTIONS')
          .map(link => graphData.nodes.find(n => n.id === link.source))
          .filter(Boolean);

        setSidePanel({
          type: 'concept',
          data: node,
          relatedData: relatedChunks
        });
        setShowSidePanel(true);
      }
    } catch (err) {
      console.error('Error handling node click:', err);
    }
  }, [session, graphData]);

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    // Optional: Add hover effects
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'default';
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize the 3D force graph with consistent theme colors
    const graph = new ForceGraph3D(containerRef.current)
      .backgroundColor('#F8FAFC') // slate-50 background
      .showNavInfo(false)
      .nodeColor((node: any) => {
        // Use consistent theme colors for nodes
        const graphNode = node as GraphNode;
        switch (graphNode.type) {
          case 'event':
            return '#3B82F6'; // blue-500
          case 'concept':
            return '#F28C38'; // notey-orange
          case 'chunk':
            return '#FCEED9'; // notey-cream
          default:
            return '#64748B'; // slate-500
        }
      })
      .nodeRelSize(8)
      .nodeOpacity(0.9)
      .linkWidth(2)
      .linkColor(() => '#CBD5E1') // slate-300 for links
      .linkOpacity(0.7)
      .linkDirectionalArrowLength(4)
      .linkDirectionalArrowRelPos(1)
      .linkDirectionalArrowColor(() => '#94A3B8') // slate-400 for arrows
      .d3AlphaDecay(0.01)
      .d3VelocityDecay(0.3);
    graphRef.current = graph;

    // Load initial data
    loadGraphData();

    // Handle window resize
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        const container = containerRef.current;
        graphRef.current
          .width(container.clientWidth)
          .height(container.clientHeight);
      }
    };

    // Initial resize
    setTimeout(handleResize, 100);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (graphRef.current) {
        // Cleanup
        graphRef.current = null;
      }
    };
  }, [loadGraphData]);

  // Focus/zoom on a concept node when focusConceptName changes
  useEffect(() => {
    if (!focusConceptName || !graphRef.current || !graphData.nodes.length) return;
    // Find the concept node
    const node = graphData.nodes.find(
      n => n.type === 'concept' && n.label.toLowerCase() === focusConceptName.toLowerCase()
    );
    if (node && graphRef.current) {
      // Find the node's position in the ForceGraph instance
      const fgNode = graphRef.current.graphData().nodes.find((n: any) => n.id === node.id);
      if (fgNode && typeof fgNode.x === 'number' && typeof fgNode.y === 'number' && typeof fgNode.z === 'number') {
        graphRef.current.cameraPosition(
          { x: fgNode.x, y: fgNode.y, z: fgNode.z + 200 },
          { x: fgNode.x, y: fgNode.y, z: fgNode.z },
          1000
        );
        graphRef.current.zoomToFit(400, 40, (n: any) => n.id === node.id);
      }
    }
  }, [focusConceptName, graphData]);

  const closeSidePanel = () => {
    setShowSidePanel(false);
    setSidePanel(null);
  };

  const refreshGraph = () => {
    loadGraphData();
  };

  // Search filtering functionality
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredConceptEvents(conceptEvents);
      return;
    }

    const filtered = conceptEvents.filter(conceptEvent => 
      conceptEvent.concept_name.toLowerCase().includes(query.toLowerCase()) ||
      conceptEvent.events.some(event => 
        event.event_title.toLowerCase().includes(query.toLowerCase())
      )
    );
    
    setFilteredConceptEvents(filtered);
  }, [conceptEvents]);

  // Update filtered results when conceptEvents changes
  useEffect(() => {
    handleSearch(searchQuery);
  }, [conceptEvents, handleSearch, searchQuery]);

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-red-800">Graph Error</h3>
          <button 
            onClick={refreshGraph}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Concept Graph</h3>
          <p className="text-sm text-gray-600 mt-1">
            Explore relationships between your events and concepts in an interactive 3D visualization.
          </p>
          {stats && (
            <p className="text-sm text-gray-500 mt-1">
              {stats.events} events • {stats.concepts} concepts • {stats.concept_mentions} connections
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'graph'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🕸️ Graph
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 List
            </button>
          </div>
          
          <button
            onClick={refreshGraph}
            disabled={loading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span className="text-gray-700">Loading {viewMode === 'graph' ? 'graph' : 'concepts'}...</span>
            </div>
          </div>
        )}
        
        {viewMode === 'graph' ? (
          <div 
            ref={containerRef} 
            className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 relative"
            style={{ height: 'calc(100vh - 400px)', minHeight: '500px' }}
          >
            {/* Legend */}
            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur rounded-lg p-3 text-xs shadow-lg border border-slate-200 z-10">
              <div className="font-semibold mb-2 text-slate-900">Legend</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3B82F6' }}></div>
                  <span className="text-slate-700">Events</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F28C38' }}></div>
                  <span className="text-slate-700">Concepts</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="flex flex-col h-full">
            {/* Search Bar */}
            <div className="p-4 border-b border-slate-200 bg-white">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search concepts or events..."
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearch('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg className="h-4 w-4 text-slate-400 hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="mt-2 text-sm text-slate-600">
                  {filteredConceptEvents.length} result{filteredConceptEvents.length !== 1 ? 's' : ''} for "{searchQuery}"
                </p>
              )}
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto">
              {filteredConceptEvents.length > 0 ? (
                <div className="space-y-4">
                  {filteredConceptEvents.map((conceptEvent, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F28C38' }}></div>
                        <h4 className="font-semibold text-slate-900 text-lg">
                          {conceptEvent.concept_name}
                        </h4>
                      </div>
                      <span className="text-sm text-slate-500 bg-white px-2 py-1 rounded">
                        {conceptEvent.events.length} event{conceptEvent.events.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {conceptEvent.events.map((event, eventIdx) => (
                        <div
                          key={eventIdx}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm hover:opacity-80 transition-opacity cursor-pointer text-white"
                          style={{ backgroundColor: '#3B82F6' }}
                          title={`Score: ${event.total_score.toFixed(2)}`}
                        >
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                          {event.event_title}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {searchQuery ? 'No Results Found' : 'No Concepts Found'}
                  </h3>
                  <p className="text-slate-600 max-w-md mx-auto">
                    {searchQuery 
                      ? `No concepts or events match "${searchQuery}". Try a different search term.`
                      : 'Concepts will appear here once you extract them from your audio recordings using AI analysis.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Side Panel */}
      {showSidePanel && sidePanel && (
        <div className="absolute right-0 top-0 w-80 h-full bg-white border-l border-gray-200 shadow-lg z-20 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 capitalize">
                {sidePanel.type} Details
              </h4>
              <button
                onClick={closeSidePanel}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {sidePanel.type === 'chunk' && (
              <>
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Chunk Info</h5>
                  <p className="text-sm text-gray-700">{sidePanel.data.label}</p>
                  {sidePanel.data.metadata?.start_time && (
                    <p className="text-xs text-gray-500 mt-1">
                      Time: {sidePanel.data.metadata.start_time.toFixed(1)}s
                    </p>
                  )}
                </div>

                {sidePanel.data.metadata?.summary && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Summary</h5>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {sidePanel.data.metadata.summary}
                    </p>
                  </div>
                )}

                {sidePanel.data.metadata?.transcript && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Transcript</h5>
                    <div className="bg-gray-50 rounded p-3 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                        {sidePanel.data.metadata.transcript}
                      </pre>
                    </div>
                  </div>
                )}

                {sidePanel.relatedData && sidePanel.relatedData.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Related Concepts</h5>
                    <div className="space-y-2">
                      {sidePanel.relatedData.map((concept: any, idx: number) => (
                        <div key={idx} className="bg-orange-50 rounded p-2">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-medium">
                              {concept.concepts?.name || 'Unknown'}
                            </span>
                            <span className="text-xs text-orange-600">
                              {concept.score?.toFixed(2) || '1.00'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {sidePanel.type === 'concept' && (
              <>
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Concept</h5>
                  <p className="text-lg text-orange-600 font-medium">
                    {sidePanel.data.label}
                  </p>
                </div>

                {sidePanel.relatedData && sidePanel.relatedData.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">
                      Mentioned In Chunks ({sidePanel.relatedData.length})
                    </h5>
                    <div className="space-y-2">
                      {sidePanel.relatedData.map((chunk: GraphNode, idx: number) => (
                        <div key={idx} className="bg-green-50 rounded p-2">
                          <p className="text-sm">{chunk.label}</p>
                          {chunk.metadata?.start_time && (
                            <p className="text-xs text-green-600">
                              {chunk.metadata.start_time.toFixed(1)}s
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}