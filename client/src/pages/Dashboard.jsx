import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  Brain,
  Upload,
  Network,
  TrendingUp,
  Heart,
  Calendar,
  FileText,
  Tag,
  Sparkles,
  ArrowRight,
  Loader2,
  RefreshCw,
  BarChart3,
  Activity,
  BookOpen,
  File,
  FileType,
  Zap
} from 'lucide-react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import '../styles/dashboard.css';
import '../styles/premium-theme.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
    }
  }, [currentUser]);

  const loadDashboardData = async (showRefreshing = false) => {
    if (!currentUser) return;

    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const token = await currentUser.getIdToken();
      const response = await axios.get(`${API_URL}/dashboard/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setDashboardData(response.data);
    } catch (err) {
      console.error('[Dashboard] Error loading data:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="premium-loading-container">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="premium-loading-content"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Brain size={56} style={{ color: 'var(--neon-indigo)' }} />
          </motion.div>
          <p className="premium-loading-text">Loading your cognitive vault...</p>
        </motion.div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="premium-error-container">
        <p className="premium-error-text">{error}</p>
        <button className="premium-btn" onClick={() => loadDashboardData()}>Retry</button>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  return (
    <motion.main
      className="page container premium-dashboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Premium User Header */}
      <motion.div
        className="premium-header-card glass"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <div className="premium-header-content">
          <div>
            <h1 className="premium-welcome-title">
              Welcome back, <span className="premium-gradient-text">{dashboardData.userName}</span>
            </h1>
            <p className="premium-welcome-subtitle">{dashboardData.userEmail}</p>
            <div className="premium-stats-row">
              <PremiumStatBadge 
                icon={<FileText size={20} />} 
                label="Total Uploads" 
                value={dashboardData.totalUploads}
                gradient="indigo"
              />
              <PremiumStatBadge 
                icon={<Tag size={20} />} 
                label="Topics" 
                value={dashboardData.totalTagsDetected}
                gradient="violet"
              />
              <PremiumStatBadge 
                icon={<Network size={20} />} 
                label="Graph Nodes" 
                value={dashboardData.knowledgeGraphStats.totalNodes}
                gradient="teal"
              />
            </div>
          </div>
          <motion.button
            className="premium-btn premium-btn-refresh"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
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
          </motion.button>
        </div>
      </motion.div>

      {/* Premium Content Grid */}
      <div className="premium-grid premium-dashboard-grid">
        {/* Recent Uploads - Premium Design */}
        <PremiumRecentUploadsCard 
          uploads={dashboardData.recentUploads}
          onViewAll={() => navigate('/upload')}
          totalUploads={dashboardData.totalUploads}
        />

        {/* Topic & Emotion Stats - Premium Design */}
        <PremiumTopicEmotionCard 
          topicStats={dashboardData.topicStats}
          emotionalTrend={dashboardData.emotionalTrend}
        />

        {/* Mini Knowledge Graph - Premium Design */}
        <PremiumKnowledgeGraphCard
          graphStats={dashboardData.knowledgeGraphStats}
          onViewFull={() => navigate('/knowledge-graph')}
        />

        {/* Mini Timeline - Premium Design */}
        <PremiumTimelineCard
          events={dashboardData.timelinePreview}
          onViewFull={() => navigate('/cognitive-timeline')}
        />

        {/* AI Insights - Premium Design */}
        <PremiumAIInsightsCard insights={dashboardData.aiInsights} />

        {/* Branch Triggers - Premium Design */}
        <PremiumBranchTriggersCard triggers={dashboardData.branchTriggers} />
      </div>

      {/* Quick Actions - Premium Design */}
      <PremiumQuickActionsCard navigate={navigate} />
    </motion.main>
  );
}

// Premium Stat Badge Component
function PremiumStatBadge({ icon, label, value, gradient = 'indigo' }) {
  const gradientColors = {
    indigo: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.1))',
    violet: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1))',
    teal: 'linear-gradient(135deg, rgba(20, 184, 166, 0.2), rgba(20, 184, 166, 0.1))'
  };

  const borderColors = {
    indigo: 'rgba(99, 102, 241, 0.3)',
    violet: 'rgba(139, 92, 246, 0.3)',
    teal: 'rgba(20, 184, 166, 0.3)'
  };

  return (
    <motion.div
      className="premium-stat-badge"
      style={{
        background: gradientColors[gradient],
        border: `1px solid ${borderColors[gradient]}`,
        borderRadius: '16px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'relative',
        overflow: 'hidden'
      }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ 
        color: gradient === 'indigo' ? '#6366F1' : gradient === 'violet' ? '#8B5CF6' : '#14B8A6',
        filter: `drop-shadow(0 0 8px ${gradient === 'indigo' ? 'rgba(99, 102, 241, 0.5)' : gradient === 'violet' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(20, 184, 166, 0.5)'})`
      }}>
        {icon}
      </div>
      <div>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: '700', 
          fontFamily: 'Space Grotesk, sans-serif',
          background: gradient === 'indigo' ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 
                      gradient === 'violet' ? 'linear-gradient(135deg, #8B5CF6, #14B8A6)' :
                      'linear-gradient(135deg, #14B8A6, #6366F1)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          {value}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '2px' }}>
          {label}
        </div>
      </div>
    </motion.div>
  );
}

// Premium Recent Uploads Card
function PremiumRecentUploadsCard({ uploads, onViewAll, totalUploads = 0 }) {
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) return <FileText size={18} style={{ color: '#EF4444' }} />;
    if (['doc', 'docx'].includes(ext)) return <FileType size={18} style={{ color: '#2563EB' }} />;
    if (['txt', 'md'].includes(ext)) return <File size={18} style={{ color: '#6B7280' }} />;
    return <File size={18} style={{ color: '#6366F1' }} />;
  };

  return (
    <motion.div
      className="premium-glass premium-card-large"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <div className="premium-card-header">
        <div>
          <h3 className="premium-section-title">
            <FileText size={24} style={{ color: 'var(--neon-indigo)' }} />
            Recent Uploads
          </h3>
          {totalUploads > 0 && (
            <p className="premium-section-subtitle">{totalUploads} total documents</p>
          )}
        </div>
        <motion.button
          className="premium-btn-secondary"
          onClick={onViewAll}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          View All <ArrowRight size={14} />
        </motion.button>
      </div>

      {uploads.length === 0 ? (
        <div className="premium-empty-state">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Upload size={64} style={{ color: 'var(--neon-indigo)', opacity: 0.4 }} />
          </motion.div>
          <p className="premium-empty-text">No uploads yet</p>
          <p className="premium-empty-subtext">Start building your knowledge vault</p>
          <motion.button
            className="premium-btn"
            onClick={onViewAll}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ marginTop: '20px' }}
          >
            <Upload size={16} />
            Upload Document
          </motion.button>
        </div>
      ) : (
        <div className="premium-uploads-list">
          {uploads.map((upload, index) => (
            <motion.div
              key={upload.file_id}
              className="premium-list-item"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ x: 4 }}
            >
              <div className="premium-upload-item-content">
                <div className="premium-upload-icon">
                  {getFileIcon(upload.file_name)}
                </div>
                <div className="premium-upload-details">
                  <div className="premium-upload-name">{upload.file_name}</div>
                  <div className="premium-upload-meta">
                    {new Date(upload.upload_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })} • {upload.document_type} • {upload.total_chunks} chunks
                  </div>
                  {upload.tags && upload.tags.length > 0 && (
                    <div className="premium-tags-container">
                      {upload.tags.slice(0, 4).map((tag, i) => (
                        <span key={i} className="premium-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Premium Topic & Emotion Stats Card
function PremiumTopicEmotionCard({ topicStats, emotionalTrend }) {
  const recentMood = emotionalTrend[0]?.sentiment || 'neutral';
  const moodConfig = {
    positive: { color: '#10B981', gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))' },
    negative: { color: '#EF4444', gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))' },
    neutral: { color: '#6366F1', gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.1))' }
  };

  const config = moodConfig[recentMood] || moodConfig.neutral;

  return (
    <motion.div
      className="premium-glass premium-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <h3 className="premium-section-title">
        <BarChart3 size={24} style={{ color: 'var(--neon-violet)' }} />
        Learning Analytics
      </h3>
      
      <div className="premium-stats-grid">
        <PremiumStatItem
          label="Top Topic"
          value={topicStats.topTopics[0]?.topic || 'None'}
          icon={<Tag size={18} />}
          gradient="indigo"
        />
        <PremiumStatItem
          label="Recent Mood"
          value={recentMood}
          icon={<Heart size={18} />}
          gradient="violet"
          customColor={config.color}
        />
        <PremiumStatItem
          label="Unique Topics"
          value={topicStats.totalUniqueTopics}
          icon={<BookOpen size={18} />}
          gradient="teal"
        />
      </div>

      {/* Mini Emotion Trend Bar */}
      {emotionalTrend.length > 0 && (
        <div className="premium-emotion-mini-chart">
          <div className="premium-chart-label">Emotion Trend</div>
          <div className="premium-chart-bars">
            {emotionalTrend.slice(0, 5).map((emotion, index) => {
              const height = emotion.score * 100;
              const barColor = emotion.sentiment === 'positive' ? '#10B981' : 
                              emotion.sentiment === 'negative' ? '#EF4444' : '#6366F1';
              return (
                <motion.div
                  key={index}
                  className="premium-chart-bar"
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                  style={{
                    background: `linear-gradient(180deg, ${barColor}, ${barColor}80)`,
                    boxShadow: `0 0 12px ${barColor}40`
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function PremiumStatItem({ label, value, icon, gradient, customColor }) {
  const gradientColors = {
    indigo: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.05))',
    violet: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))',
    teal: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.05))'
  };

  return (
    <motion.div
      className="premium-stat-item"
      style={{
        background: gradientColors[gradient],
        border: `1px solid rgba(${gradient === 'indigo' ? '99, 102, 241' : gradient === 'violet' ? '139, 92, 246' : '20, 184, 166'}, 0.2)`,
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
      whileHover={{ scale: 1.02 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '14px' }}>
        {icon}
        {label}
      </div>
      <div style={{ 
        fontWeight: '700', 
        fontSize: '16px',
        color: customColor || (gradient === 'indigo' ? '#6366F1' : gradient === 'violet' ? '#8B5CF6' : '#14B8A6'),
        textTransform: 'capitalize',
        fontFamily: 'Space Grotesk, sans-serif'
      }}>
        {typeof value === 'string' ? value : value.toString()}
      </div>
    </motion.div>
  );
}

// Premium Knowledge Graph Preview
function PremiumKnowledgeGraphCardInner({ graphStats, onViewFull }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (graphStats.topConcepts && graphStats.topConcepts.length > 0) {
      const top5 = graphStats.topConcepts.slice(0, 5);
      const flowNodes = top5.map((concept, index) => {
        const angle = (index / top5.length) * 2 * Math.PI;
        const radius = 120;
        return {
          id: `node_${index}`,
          type: 'default',
          position: {
            x: 200 + radius * Math.cos(angle),
            y: 150 + radius * Math.sin(angle)
          },
          data: { label: concept.name },
          style: {
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            color: '#fff',
            border: '2px solid rgba(139, 92, 246, 0.5)',
            borderRadius: '12px',
            padding: '10px 16px',
            fontSize: '12px',
            fontWeight: '600',
            minWidth: '100px',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
            fontFamily: 'Inter, sans-serif'
          }
        };
      });

      const flowEdges = [];
      for (let i = 0; i < top5.length; i++) {
        const next = (i + 1) % top5.length;
        flowEdges.push({
          id: `edge_${i}`,
          source: `node_${i}`,
          target: `node_${next}`,
          type: 'smoothstep',
          animated: true,
          style: { 
            stroke: '#6366F1', 
            strokeWidth: 2,
            filter: 'drop-shadow(0 0 4px rgba(99, 102, 241, 0.5))'
          }
        });
      }

      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [graphStats.topConcepts, setNodes, setEdges]);

  return (
    <>
      {graphStats.totalNodes === 0 ? (
        <div className="premium-empty-state">
          <Network size={64} style={{ color: 'var(--neon-indigo)', opacity: 0.4 }} />
          <p className="premium-empty-text">No graph data yet</p>
          <p className="premium-empty-subtext">Upload documents to build your knowledge graph</p>
        </div>
      ) : (
        <div className="premium-graph-container">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            minZoom={0.6}
            maxZoom={1.2}
            nodesDraggable={false}
          >
            <Background 
              color="#1e293b" 
              gap={20}
              size={1}
              style={{ opacity: 0.3 }}
            />
            <Controls 
              style={{ 
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '12px'
              }}
            />
          </ReactFlow>
        </div>
      )}
      <div className="premium-graph-stats">
        <span>{graphStats.totalNodes} nodes</span>
        <span className="premium-divider-vertical" />
        <span>{graphStats.totalEdges} edges</span>
      </div>
    </>
  );
}

function PremiumKnowledgeGraphCard({ graphStats, onViewFull }) {
  return (
    <motion.div
      className="premium-glass premium-card-large"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
    >
      <div className="premium-card-header">
        <div>
          <h3 className="premium-section-title">
            <Network size={24} style={{ color: 'var(--neon-teal)' }} />
            Knowledge Graph
          </h3>
          <p className="premium-section-subtitle">Conceptual relationships</p>
        </div>
        <motion.button
          className="premium-btn-secondary"
          onClick={onViewFull}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Open Full <ArrowRight size={14} />
        </motion.button>
      </div>
      <ReactFlowProvider>
        <PremiumKnowledgeGraphCardInner graphStats={graphStats} onViewFull={onViewFull} />
      </ReactFlowProvider>
    </motion.div>
  );
}

// Premium Timeline Preview
function PremiumTimelineCard({ events, onViewFull }) {
  return (
    <motion.div
      className="premium-glass premium-card-large"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
    >
      <div className="premium-card-header">
        <div>
          <h3 className="premium-section-title">
            <Calendar size={24} style={{ color: 'var(--neon-violet)' }} />
            Timeline
          </h3>
          <p className="premium-section-subtitle">Learning journey</p>
        </div>
        <motion.button
          className="premium-btn-secondary"
          onClick={onViewFull}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Open Full <ArrowRight size={14} />
        </motion.button>
      </div>

      {events.length === 0 ? (
        <div className="premium-empty-state">
          <Calendar size={64} style={{ color: 'var(--neon-violet)', opacity: 0.4 }} />
          <p className="premium-empty-text">No timeline events yet</p>
          <p className="premium-empty-subtext">Start learning to see your journey</p>
        </div>
      ) : (
        <div className="premium-timeline-container">
          {events.map((event, index) => {
            const date = new Date(event.timestamp);
            const isRecent = index === 0;
            
            return (
              <motion.div
                key={event.chunk_id || index}
                className="premium-timeline-item"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <div className="premium-timeline-marker-wrapper">
                  <div 
                    className="premium-timeline-marker"
                    style={{
                      boxShadow: isRecent ? '0 0 20px rgba(99, 102, 241, 0.8)' : '0 0 12px rgba(99, 102, 241, 0.5)'
                    }}
                  />
                  {index < events.length - 1 && (
                    <div className="premium-timeline-line" />
                  )}
                </div>
                <div className="premium-timeline-content">
                  <div className="premium-timeline-date">
                    {date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                    })}
                  </div>
                  <div className="premium-timeline-summary">
                    {event.summary || 'No summary available'}
                  </div>
                  {event.tags && event.tags.length > 0 && (
                    <div className="premium-tags-container">
                      {event.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="premium-tag premium-tag-small">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// Premium AI Insights Card
function PremiumAIInsightsCard({ insights }) {
  return (
    <motion.div
      className="premium-insights-box premium-card-large"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.6 }}
    >
      <div className="premium-insights-header">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
        >
          <Sparkles size={28} style={{ color: 'var(--neon-violet)' }} />
        </motion.div>
        <h3 className="premium-section-title" style={{ margin: 0 }}>
          AI Insights
        </h3>
      </div>
      <p className="premium-insights-text">
        {insights}
      </p>
    </motion.div>
  );
}

// Premium Branch Triggers Card
function PremiumBranchTriggersCard({ triggers }) {
  return (
    <motion.div
      className="premium-glass premium-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.7 }}
    >
      <h3 className="premium-section-title">
        <Sparkles size={24} style={{ color: 'var(--neon-teal)' }} />
        New Branches
      </h3>
      {triggers.length === 0 ? (
        <div className="premium-empty-state-small">
          <p className="premium-empty-text">No new branches detected</p>
        </div>
      ) : (
        <div className="premium-branches-list">
          {triggers.map((trigger, index) => (
            <motion.div
              key={index}
              className="premium-branch-item"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 + index * 0.1 }}
              whileHover={{ scale: 1.02, x: 4 }}
            >
              <div className="premium-branch-icon">
                <Zap size={16} style={{ color: 'var(--neon-teal)' }} />
              </div>
              <div className="premium-branch-content">
                <div className="premium-branch-topic">{trigger.trigger}</div>
                <div className="premium-branch-date">
                  {new Date(trigger.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Premium Quick Actions
function PremiumQuickActionsCard({ navigate }) {
  const actions = [
    { 
      label: 'Upload Document', 
      icon: <Upload size={22} />, 
      path: '/upload', 
      gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
      glow: 'rgba(99, 102, 241, 0.4)'
    },
    { 
      label: 'Knowledge Graph', 
      icon: <Network size={22} />, 
      path: '/knowledge-graph', 
      gradient: 'linear-gradient(135deg, #8B5CF6, #14B8A6)',
      glow: 'rgba(139, 92, 246, 0.4)'
    },
    { 
      label: 'Timeline', 
      icon: <Calendar size={22} />, 
      path: '/cognitive-timeline', 
      gradient: 'linear-gradient(135deg, #14B8A6, #6366F1)',
      glow: 'rgba(20, 184, 166, 0.4)'
    },
    { 
      label: 'Incognito Vault', 
      icon: <Brain size={22} />, 
      path: '/incognito', 
      gradient: 'linear-gradient(135deg, #8B5CF6, #FF5F9E)',
      glow: 'rgba(139, 92, 246, 0.4)'
    }
  ];

  return (
    <motion.div
      className="premium-glass premium-actions-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.8 }}
    >
      <h3 className="premium-section-title">
        <Activity size={24} style={{ color: 'var(--neon-indigo)' }} />
        Quick Actions
      </h3>
      <div className="premium-actions-grid">
        {actions.map((action, index) => (
          <motion.button
            key={action.path}
            className="premium-action-btn"
            onClick={() => navigate(action.path)}
            style={{
              background: action.gradient,
              boxShadow: `0 4px 20px ${action.glow}`
            }}
            whileHover={{ 
              scale: 1.05, 
              y: -4,
              boxShadow: `0 8px 30px ${action.glow}`
            }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 + index * 0.1 }}
          >
            {action.icon}
            <span>{action.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
