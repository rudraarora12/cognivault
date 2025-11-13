import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Brain,
  TrendingUp,
  Heart,
  Network,
  Sparkles,
  Calendar,
  Tag,
  ArrowRight,
  Loader2,
  Upload,
  FileText,
  X,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import './CognitiveTimeline.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function CognitiveTimeline() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [topicSpikes, setTopicSpikes] = useState({});
  const [emotionTrend, setEmotionTrend] = useState([]);
  const [knowledgeEvolution, setKnowledgeEvolution] = useState({ nodes: [], edges: [], newBranches: [] });
  const [branchTriggers, setBranchTriggers] = useState([]);
  const [insights, setInsights] = useState('');
  const [activeSection, setActiveSection] = useState('timeline');
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Load data when component mounts or user changes
  useEffect(() => {
    if (currentUser) {
      loadTimelineData();
    }
  }, [currentUser]);

  // Refresh data when navigating to timeline page (after uploads)
  useEffect(() => {
    if (currentUser && location.pathname === '/cognitive-timeline') {
      // Small delay to ensure any background processing is complete
      const refreshTimer = setTimeout(() => {
        loadTimelineData();
      }, 500);
      return () => clearTimeout(refreshTimer);
    }
  }, [location.pathname, currentUser]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!currentUser) {
      setError('You must be signed in to upload content');
      return;
    }

    if (!selectedFile && !textInput.trim()) {
      setError('Please select a file or enter text');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadSuccess(false);

      const token = await currentUser.getIdToken();
      const formData = new FormData();

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      if (textInput.trim()) {
        formData.append('textInput', textInput.trim());
      }

      console.log('[Timeline Frontend] Uploading content...');
      const response = await axios.post(`${API_URL}/timeline/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('[Timeline Frontend] Upload successful:', response.data);
      setUploadSuccess(true);
      setSelectedFile(null);
      setTextInput('');
      
      // Reload timeline data after upload (wait for processing to complete)
      // Smart Upload processing can take 3-5 seconds for large files
      setTimeout(() => {
        loadTimelineData();
        setUploadSuccess(false);
      }, 4000);
    } catch (error) {
      console.error('[Timeline Frontend] Upload error:', error);
      setError(error.response?.data?.error || 'Failed to upload content');
      setUploadSuccess(false);
    } finally {
      setUploading(false);
    }
  };

  const loadTimelineData = async (showRefreshing = false) => {
    if (!currentUser) {
      console.warn('[Timeline Frontend] No current user, cannot load data');
      return;
    }

    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      console.log('[Timeline Frontend] Starting to load timeline data...');
      
      const token = await currentUser.getIdToken();
      console.log('[Timeline Frontend] Firebase token retrieved:', token ? 'Yes' : 'No');
      console.log('[Timeline Frontend] User ID:', currentUser.uid);
      console.log('[Timeline Frontend] API URL:', API_URL);

      const [eventsRes, spikesRes, emotionRes, evolutionRes, triggersRes, insightsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/timeline/events`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/timeline/topic-spikes`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/timeline/emotion-trend`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/timeline/knowledge-evolution`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/timeline/branch-triggers`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/timeline/insights`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Process events
      if (eventsRes.status === 'fulfilled') {
        console.log('[Timeline Frontend] Events loaded:', eventsRes.value.data.length);
        setEvents(eventsRes.value.data);
      } else {
        console.error('[Timeline Frontend] Events failed:', eventsRes.reason?.response?.data || eventsRes.reason?.message);
        setEvents([]);
      }

      // Process topic spikes
      if (spikesRes.status === 'fulfilled') {
        console.log('[Timeline Frontend] Topic spikes loaded:', Object.keys(spikesRes.value.data).length, 'months');
        setTopicSpikes(spikesRes.value.data);
      } else {
        console.error('[Timeline Frontend] Topic spikes failed:', spikesRes.reason?.response?.data || spikesRes.reason?.message);
        setTopicSpikes({});
      }

      // Process emotion trend
      if (emotionRes.status === 'fulfilled') {
        console.log('[Timeline Frontend] Emotion trend loaded:', emotionRes.value.data.length, 'points');
        setEmotionTrend(emotionRes.value.data);
      } else {
        console.error('[Timeline Frontend] Emotion trend failed:', emotionRes.reason?.response?.data || emotionRes.reason?.message);
        setEmotionTrend([]);
      }

      // Process knowledge evolution
      if (evolutionRes.status === 'fulfilled') {
        const evolution = evolutionRes.value.data;
        console.log('[Timeline Frontend] Knowledge evolution loaded:', evolution.nodes?.length || 0, 'nodes,', evolution.edges?.length || 0, 'edges');
        setKnowledgeEvolution(evolution);
      } else {
        console.error('[Timeline Frontend] Knowledge evolution failed:', evolutionRes.reason?.response?.data || evolutionRes.reason?.message);
        setKnowledgeEvolution({ nodes: [], edges: [], newBranches: [] });
      }

      // Process branch triggers
      if (triggersRes.status === 'fulfilled') {
        console.log('[Timeline Frontend] Branch triggers loaded:', triggersRes.value.data.length);
        setBranchTriggers(triggersRes.value.data);
      } else {
        console.error('[Timeline Frontend] Branch triggers failed:', triggersRes.reason?.response?.data || triggersRes.reason?.message);
        setBranchTriggers([]);
      }

      // Process insights
      if (insightsRes.status === 'fulfilled') {
        console.log('[Timeline Frontend] Insights loaded');
        setInsights(insightsRes.value.data.insights || '');
      } else {
        console.error('[Timeline Frontend] Insights failed:', insightsRes.reason?.response?.data || insightsRes.reason?.message);
        setInsights('');
      }

      console.log('[Timeline Frontend] All data loaded successfully');
      setError(null);
    } catch (error) {
      console.error('[Timeline Frontend] Critical error loading timeline data:', error);
      console.error('[Timeline Frontend] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setError(error.response?.data?.error || error.message || 'Failed to load timeline data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="timeline-loading">
        <Loader2 className="spinner" />
        <p>Loading your cognitive journey...</p>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="timeline-error">
        <h2>Unable to Load Timeline</h2>
        <p>{error}</p>
        <button onClick={loadTimelineData}>Retry</button>
      </div>
    );
  }

  return (
    <motion.div
      className="cognitive-timeline-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="timeline-header">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
        >
          <div>
            <h1 className="timeline-title">
              <Brain className="title-icon" />
              Cognitive Timeline
            </h1>
            <p className="timeline-subtitle">Your learning evolution visualized</p>
          </div>
          <button
            onClick={() => loadTimelineData(true)}
            disabled={refreshing || loading}
            className="refresh-timeline-btn"
            style={{
              padding: '10px 20px',
              background: refreshing || loading ? '#4b5563' : '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: refreshing || loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {refreshing ? (
              <>
                <Loader2 className="spinner-small" size={16} />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Refresh
              </>
            )}
          </button>
        </motion.div>

        {insights && (
          <motion.div
            className="insights-card"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Sparkles className="insights-icon" />
            <div className="insights-content">
              <h3>AI Insights</h3>
              <p>{insights}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Upload Section */}
      <motion.section
        className="timeline-upload-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="upload-container">
          <h3 className="upload-title">
            <Upload className="upload-icon" />
            Add to Your Timeline
          </h3>
          <p className="upload-subtitle">Upload files or enter text to build your learning journey</p>
          
          <div className="upload-form">
            <div className="upload-inputs">
              <div className="file-upload-area">
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.txt,.docx"
                  onChange={handleFileSelect}
                  className="file-input"
                  disabled={uploading}
                />
                <label htmlFor="file-upload" className="file-label">
                  <FileText size={24} />
                  {selectedFile ? selectedFile.name : 'Choose file (PDF, TXT, DOCX)'}
                </label>
                {selectedFile && (
                  <button
                    className="remove-file-btn"
                    onClick={() => setSelectedFile(null)}
                    disabled={uploading}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="text-input-area">
                <textarea
                  placeholder="Or enter text directly..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="text-input"
                  disabled={uploading}
                  rows={3}
                />
              </div>
            </div>

            {error && (
              <div className="upload-error">
                {error}
              </div>
            )}

            {uploadSuccess && (
              <div className="upload-success">
                <CheckCircle size={20} />
                Content uploaded successfully! Timeline updating...
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={uploading || (!selectedFile && !textInput.trim())}
              className="upload-button"
            >
              {uploading ? (
                <>
                  <Loader2 className="spinner-small" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Upload to Timeline
                </>
              )}
            </button>
          </div>
        </div>
      </motion.section>

      <div className="timeline-sections">
        {/* Section 1: Topic Spike Graph */}
        <TopicSpikeGraph topicSpikes={topicSpikes} />

        {/* Section 2: Emotion Trend Line Graph */}
        <EmotionTrendGraph emotionTrend={emotionTrend} />

        {/* Section 3: Knowledge Evolution Visualization */}
        <KnowledgeEvolutionGraph knowledgeEvolution={knowledgeEvolution} />

        {/* Section 4: Branch Trigger Cards */}
        <BranchTriggerCards branchTriggers={branchTriggers} />

        {/* Section 5: Learning Timeline View (at the end) */}
        <TimelineView events={events} />
      </div>
    </motion.div>
  );
}

// Section 1: Learning Timeline View
function TimelineView({ events }) {
  if (events.length === 0) {
    return (
      <SectionContainer icon={<Calendar />} title="Learning Timeline" subtitle="Your learning journey over time">
        <div className="empty-state">No learning events yet. Start uploading content to see your timeline!</div>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer icon={<Calendar />} title="Learning Timeline" subtitle="Chronological view of your learning">
      <div className="timeline-container">
        {events.map((event, index) => (
          <motion.div
            key={event.chunk_id || index}
            className="timeline-event"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="timeline-marker" />
            <div className="timeline-content">
              <div className="event-date">
                {new Date(event.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
              <div className="event-summary">{event.summary || 'No summary available'}</div>
              {event.text_snippet && (
                <div className="event-snippet">{event.text_snippet}</div>
              )}
              {event.tags && event.tags.length > 0 && (
                <div className="event-tags">
                  {event.tags.slice(0, 5).map((tag, i) => (
                    <span key={i} className="tag-chip">
                      <Tag size={12} />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </SectionContainer>
  );
}

// Section 2: Topic Spike Graph
function TopicSpikeGraph({ topicSpikes }) {
  const months = Object.keys(topicSpikes).sort();
  const allTopics = new Set();
  months.forEach(month => {
    Object.keys(topicSpikes[month]).forEach(topic => allTopics.add(topic));
  });

  const topicArray = Array.from(allTopics);
  const maxCount = Math.max(
    ...months.flatMap(month => Object.values(topicSpikes[month]))
  );

  if (months.length === 0) {
    return (
      <SectionContainer icon={<TrendingUp />} title="Topic Spikes" subtitle="Trending topics over time">
        <div className="empty-state">No topic data available yet.</div>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer icon={<TrendingUp />} title="Topic Spikes" subtitle="Your learning focus over time">
      <div className="topic-spike-container">
        <div className="spike-chart">
          {months.map((month, monthIndex) => (
            <div key={month} className="spike-month">
              <div className="month-label">{month}</div>
              <div className="spike-bars">
                {topicArray.slice(0, 10).map((topic) => {
                  const count = topicSpikes[month][topic] || 0;
                  const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div
                      key={topic}
                      className="spike-bar"
                      style={{
                        height: `${height}%`,
                        backgroundColor: `hsl(${(topicArray.indexOf(topic) * 30) % 360}, 70%, 60%)`
                      }}
                      title={`${topic}: ${count}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="topic-legend">
          {topicArray.slice(0, 10).map((topic, i) => (
            <div key={topic} className="legend-item">
              <div
                className="legend-color"
                style={{
                  backgroundColor: `hsl(${(i * 30) % 360}, 70%, 60%)`
                }}
              />
              <span>{topic}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
}

// Section 3: Emotion Trend Line Graph
function EmotionTrendGraph({ emotionTrend }) {
  if (emotionTrend.length === 0) {
    return (
      <SectionContainer icon={<Heart />} title="Emotion Trend" subtitle="Your emotional journey">
        <div className="empty-state">No emotion data available yet.</div>
      </SectionContainer>
    );
  }

  const points = emotionTrend.map((item, index) => ({
    x: index,
    y: item.score * 100,
    date: item.date,
    sentiment: item.sentiment
  }));

  const maxY = 100;
  const svgWidth = 800;
  const svgHeight = 300;
  const padding = 40;

  const pathData = points
    .map((point, i) => {
      const x = padding + (i / (points.length - 1 || 1)) * (svgWidth - 2 * padding);
      const y = svgHeight - padding - (point.y / maxY) * (svgHeight - 2 * padding);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      default: return '#6366f1';
    }
  };

  return (
    <SectionContainer icon={<Heart />} title="Emotion Trend" subtitle="Sentiment analysis over time">
      <div className="emotion-trend-container">
        <svg width="100%" height="300" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="emotion-svg">
          <defs>
            <linearGradient id="emotionGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${pathData} L ${padding + (svgWidth - 2 * padding)} ${svgHeight - padding} L ${padding} ${svgHeight - padding} Z`}
            fill="url(#emotionGradient)"
            className="emotion-area"
          />
          <path
            d={pathData}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            className="emotion-line"
          />
          {points.map((point, i) => {
            const x = padding + (i / (points.length - 1 || 1)) * (svgWidth - 2 * padding);
            const y = svgHeight - padding - (point.y / maxY) * (svgHeight - 2 * padding);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="5"
                fill={getSentimentColor(point.sentiment)}
                className="emotion-point"
              />
            );
          })}
        </svg>
        <div className="emotion-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#10b981' }} />
            <span>Positive</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#6366f1' }} />
            <span>Neutral</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#ef4444' }} />
            <span>Negative</span>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}

// Section 4: Knowledge Evolution Visualization
function KnowledgeEvolutionGraphInner({ knowledgeEvolution }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (knowledgeEvolution && knowledgeEvolution.nodes && knowledgeEvolution.nodes.length > 0) {
      console.log('[Timeline Frontend] Setting up React Flow with', knowledgeEvolution.nodes.length, 'nodes');
      
      const flowNodes = knowledgeEvolution.nodes.map((node, index) => ({
        id: node.id || `node_${index}`,
        type: 'default',
        position: {
          x: (index % 5) * 150 + 50,
          y: Math.floor(index / 5) * 150 + 50
        },
        data: {
          label: node.label || 'Topic',
          count: node.count || 0
        },
        style: {
          background: '#6366f1',
          color: '#fff',
          border: '2px solid #4f46e5',
          borderRadius: '8px',
          padding: '10px',
          fontSize: '12px'
        }
      }));

      const flowEdges = (knowledgeEvolution.edges || []).map((edge, index) => ({
        id: edge.id || `edge_${index}`,
        source: edge.source || '',
        target: edge.target || '',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 }
      })).filter(edge => edge.source && edge.target);

      console.log('[Timeline Frontend] React Flow:', flowNodes.length, 'nodes,', flowEdges.length, 'edges');
      setNodes(flowNodes);
      setEdges(flowEdges);
    } else {
      console.log('[Timeline Frontend] No nodes to display in React Flow');
      setNodes([]);
      setEdges([]);
    }
  }, [knowledgeEvolution, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      className="knowledge-flow"
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}

function KnowledgeEvolutionGraph({ knowledgeEvolution }) {
  if (knowledgeEvolution.nodes.length === 0) {
    return (
      <SectionContainer icon={<Network />} title="Knowledge Evolution" subtitle="How your knowledge graph has grown">
        <div className="empty-state">No knowledge graph data available yet.</div>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer icon={<Network />} title="Knowledge Evolution" subtitle="Your conceptual growth visualized">
      <div className="knowledge-evolution-container">
        <ReactFlowProvider>
          <KnowledgeEvolutionGraphInner knowledgeEvolution={knowledgeEvolution} />
        </ReactFlowProvider>
        {knowledgeEvolution.newBranches && knowledgeEvolution.newBranches.length > 0 && (
          <div className="new-branches-list">
            <h4>New Knowledge Branches</h4>
            {knowledgeEvolution.newBranches.slice(0, 5).map((branch, i) => (
              <div key={i} className="branch-item">
                <Sparkles size={16} />
                <span>{branch.topic}</span>
                <span className="branch-date">
                  {new Date(branch.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionContainer>
  );
}

// Section 5: Branch Trigger Cards
function BranchTriggerCards({ branchTriggers }) {
  if (branchTriggers.length === 0) {
    return (
      <SectionContainer icon={<Sparkles />} title="Branch Triggers" subtitle="Moments when new topics emerged">
        <div className="empty-state">No branch triggers detected yet.</div>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer icon={<Sparkles />} title="Branch Triggers" subtitle="When new knowledge branches appeared">
      <div className="branch-triggers-grid">
        {branchTriggers.map((trigger, index) => (
          <motion.div
            key={index}
            className="branch-trigger-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02, y: -5 }}
          >
            <div className="trigger-date">
              {new Date(trigger.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            <div className="trigger-content">
              <h3>New Branch Triggered</h3>
              <div className="trigger-topic">{trigger.trigger}</div>
              {trigger.ledTo && trigger.ledTo.length > 0 && (
                <div className="trigger-led-to">
                  <span>Led to:</span>
                  <div className="led-to-topics">
                    {trigger.ledTo.map((topic, i) => (
                      <span key={i} className="led-to-topic">
                        {topic}
                        {i < trigger.ledTo.length - 1 && <ArrowRight size={12} />}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </SectionContainer>
  );
}

// Reusable Section Container
function SectionContainer({ icon, title, subtitle, children }) {
  return (
    <motion.section
      className="timeline-section"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="section-header">
        <div className="section-icon">{icon}</div>
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="section-content">{children}</div>
    </motion.section>
  );
}

