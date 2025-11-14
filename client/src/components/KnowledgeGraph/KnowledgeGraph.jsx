import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  MiniMap,
  Panel,
  useReactFlow,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import {
  Brain,
  Tag,
  User,
  FileText,
  Search,
  Maximize2,
  Minimize2,
  RefreshCw,
  Download,
  Upload,
  Layers,
  Filter,
  Eye,
  EyeOff,
  Trash2,
  X,
  CheckCircle,
  Loader2
} from 'lucide-react';
import CustomNode from './CustomNode';
import GraphControls from './GraphControls';
import GraphStats from './GraphStats';
import { NotificationContainer } from './Notification';
import { useAuth } from '../../contexts/AuthContext';
import './KnowledgeGraph.css';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const nodeTypes = {
  memory: CustomNode,
  concept: CustomNode,
  entity: CustomNode,
  source: CustomNode
};

const KnowledgeGraph = () => {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid || 'demo_user';
  
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [depthLevel, setDepthLevel] = useState(2);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [graphStats, setGraphStats] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [showLabels, setShowLabels] = useState(true);
  const [layoutMode, setLayoutMode] = useState('force');
  const [notifications, setNotifications] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Helper function to get auth token with fallback
  const getAuthToken = async () => {
    try {
      if (currentUser && currentUser.getIdToken) {
        return await currentUser.getIdToken();
      }
    } catch (err) {
      console.log('Using demo token for auth');
    }
    return 'demo-token';
  };

  const [textInput, setTextInput] = useState('');
  const [uploadError, setUploadError] = useState(null);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  
  const { fitView } = useReactFlow();

  // Notification helpers
  const addNotification = (message, type = 'info', duration = 5000) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type, duration }]);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Initialize graph with mock data
  const initializeMockData = async () => {
    try {
      setLoading(true);
      addNotification('Clearing old data and creating 5 memories...', 'info', 3000);
      
      const token = currentUser ? await currentUser.getIdToken() : null;
      const response = await axios.post(`${API_URL}/graph/mock/initialize`, {
        count: 5,           // Create only 5 memories instead of 10
        clearExisting: true // Clear old data first
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (response.data.success) {
        addNotification('Mock data loaded successfully! 🎉', 'success');
        await loadFullGraph();
        setGraphStats(response.data.stats);
      } else {
        addNotification('Failed to load mock data', 'error');
      }
    } catch (error) {
      console.error('Error initializing mock data:', error);
      const errorMessage = error.response?.data?.error 
        || error.message 
        || 'Backend server not reachable. Please ensure the server is running on port 5000.';
      addNotification(`Error: ${errorMessage}`, 'error', 8000);
    } finally {
      setLoading(false);
    }
  };

  // Load full graph
  const loadFullGraph = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const response = await axios.get(`${API_URL}/graph/full`, {
        params: { limit: 200 },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const { nodes: rawNodes, edges: rawEdges } = response.data;
      
      if (!rawNodes || rawNodes.length === 0) {
        addNotification('No data found. Click "Mock Data" to initialize.', 'warning');
        setNodes([]);
        setEdges([]);
        return;
      }
      
      // Process and layout nodes
      const processedNodes = processNodes(rawNodes);
      const processedEdges = processEdges(rawEdges);
      
      setNodes(processedNodes);
      setEdges(processedEdges);
      
      addNotification(`Loaded ${rawNodes.length} nodes and ${rawEdges.length} edges`, 'success', 3000);
      
      // Fit view after nodes are loaded
      setTimeout(() => fitView({ padding: 0.2 }), 100);
      
    } catch (error) {
      console.error('Error loading graph:', error);
      addNotification('Error loading graph. Please check if the server is running.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load subgraph around a specific node
  const loadSubgraph = async (nodeId, depthLevel = 2) => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const response = await axios.get(`${API_URL}/graph/subgraph`, {
        params: { 
          node_id: nodeId, 
          depth: depthLevel
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const { nodes: rawNodes, edges: rawEdges } = response.data;
      
      const processedNodes = processNodes(rawNodes);
      const processedEdges = processEdges(rawEdges);
      
      setNodes(processedNodes);
      setEdges(processedEdges);
      
      setTimeout(() => fitView({ padding: 0.2 }), 100);
      
    } catch (error) {
      console.error('Error loading subgraph:', error);
    } finally {
      setLoading(false);
    }
  };

  // Process nodes for React Flow
  const processNodes = (rawNodes) => {
    const radius = 300;
    const angleStep = (2 * Math.PI) / rawNodes.length;
    
    return rawNodes.map((node, index) => {
      let x, y;
      
      if (layoutMode === 'circular') {
        x = 400 + radius * Math.cos(index * angleStep);
        y = 400 + radius * Math.sin(index * angleStep);
      } else if (layoutMode === 'grid') {
        const cols = Math.ceil(Math.sqrt(rawNodes.length));
        x = (index % cols) * 200 + 100;
        y = Math.floor(index / cols) * 200 + 100;
      } else {
        // Force-directed layout simulation
        x = 400 + (Math.random() - 0.5) * 600;
        y = 400 + (Math.random() - 0.5) * 400;
      }
      
      return {
        id: node.id,
        type: node.type.toLowerCase(),
        position: { x, y },
        data: {
          ...node,
          label: showLabels ? node.label : '',
          showLabels
        }
      };
    });
  };

  // Process edges for React Flow
  const processEdges = (rawEdges) => {
    return rawEdges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: edge.type === 'SIMILAR_TO',
      style: getEdgeStyle(edge.type),
      label: showLabels ? edge.label : '',
      labelStyle: { fill: '#666', fontSize: 10 },
      data: edge
    }));
  };

  // Get edge style based on type
  const getEdgeStyle = (type) => {
    const styles = {
      SIMILAR_TO: { stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5 5' },
      TAGGED_WITH: { stroke: '#6366f1', strokeWidth: 1.5 },
      MENTIONS: { stroke: '#f59e0b', strokeWidth: 1.5 },
      DERIVED_FROM: { stroke: '#8b5cf6', strokeWidth: 2 }
    };
    return styles[type] || { stroke: '#94a3b8', strokeWidth: 1 };
  };

  // Search nodes
  const handleSearch = async () => {
    if (!searchQuery) {
      await loadFullGraph();
      return;
    }
    
    try {
      setLoading(true);
      const token = await getAuthToken();
      const response = await axios.get(`${API_URL}/graph/search`, {
        params: {
          query: searchQuery,
          type: filterType !== 'all' ? filterType : undefined
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const searchResults = response.data;
      if (searchResults.length > 0) {
        // Load subgraph for first result
        await loadSubgraph(searchResults[0].id);
      }
    } catch (error) {
      console.error('Error searching nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle node click
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    if (node.id !== selectedNode?.id) {
      loadSubgraph(node.id);
    }
  }, [selectedNode]);

  // Handle node changes
  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  // Handle edge changes
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Toggle fullscreen
  const toggleFullscreen = () => {
    const element = document.querySelector('.knowledge-graph-container');
    if (!isFullscreen) {
      element.requestFullscreen?.() || element.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Get graph statistics
  const loadGraphStats = async () => {
    try {
      const token = await getAuthToken();
      const response = await axios.get(`${API_URL}/graph/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGraphStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Clear all data
  const clearAllData = async () => {
    if (!window.confirm('Are you sure you want to clear all your data? This cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      addNotification('Clearing all data...', 'info', 2000);
      
      const token = await getAuthToken();
      await axios.delete(`${API_URL}/graph/clear`, {
        params: { user_id: userId },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNodes([]);
      setEdges([]);
      setGraphStats(null);
      setSelectedNode(null);
      
      addNotification('All data cleared successfully!', 'success', 3000);
    } catch (error) {
      console.error('Error clearing data:', error);
      addNotification('Failed to clear data', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (currentUser) {
      loadFullGraph();
      loadGraphStats();
    }
  }, [currentUser]);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadSuccess(false);
      setUploadError(null);
    }
  };

  // Handle upload to Knowledge Graph
  const handleUpload = async () => {
    if (!currentUser) {
      setUploadError('You must be signed in to upload content');
      addNotification('Please sign in to upload content', 'error');
      return;
    }

    if (!selectedFile && !textInput.trim()) {
      setUploadError('Please select a file or enter text');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(false);

      const token = await currentUser.getIdToken();
      const formData = new FormData();

      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      if (textInput.trim()) {
        formData.append('textInput', textInput.trim());
      }

      console.log('[Knowledge Graph] Uploading content...');
      const response = await axios.post(`${API_URL}/graph/memory`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('[Knowledge Graph] Upload successful:', response.data);
      setUploadSuccess(true);
      setSelectedFile(null);
      setTextInput('');
      addNotification('Content uploaded successfully! Refreshing graph...', 'success');
      
      // Reload graph after upload
      setTimeout(() => {
        loadFullGraph();
        loadGraphStats();
        setUploadSuccess(false);
        setShowUploadPanel(false);
      }, 2000);
    } catch (error) {
      console.error('[Knowledge Graph] Upload error:', error);
      const errorMsg = error.response?.data?.error || 'Failed to upload content';
      setUploadError(errorMsg);
      addNotification(errorMsg, 'error');
      setUploadSuccess(false);
    } finally {
      setUploading(false);
    }
  };

  // Filter nodes based on type
  const filteredNodes = useMemo(() => {
    if (filterType === 'all') return nodes;
    return nodes.filter(node => node.type === filterType);
  }, [nodes, filterType]);

  // Filter edges based on filtered nodes
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
  }, [filteredNodes, edges]);

  return (
    <div className="knowledge-graph-container">
      <NotificationContainer 
        notifications={notifications}
        removeNotification={removeNotification}
      />
      
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <Brain className="animate-spin" size={48} />
            <p>Loading Knowledge Graph...</p>
          </div>
        </div>
      )}

      <div className="graph-header">
        <h2>
          <Brain /> Knowledge Graph
        </h2>
        
        <div className="graph-actions">
          <button 
            onClick={() => setShowUploadPanel(!showUploadPanel)}
            className="action-btn"
            title="Upload Content"
          >
            <Upload size={18} />
            Upload
          </button>
          
          <button 
            onClick={initializeMockData}
            className="action-btn"
            title="Initialize Mock Data"
          >
            <Layers size={18} />
            Mock Data
          </button>
          
          <button 
            onClick={clearAllData}
            className="action-btn danger-btn"
            title="Clear All Data"
          >
            <Trash2 size={18} />
            Clear
          </button>
          
          <button 
            onClick={loadFullGraph}
            className="action-btn"
            title="Refresh Graph"
          >
            <RefreshCw size={18} />
          </button>
          
          <button 
            onClick={toggleFullscreen}
            className="action-btn"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Upload Panel */}
      {showUploadPanel && (
        <motion.div
          className="graph-upload-panel"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="upload-panel-header">
            <h3>Upload Content to Knowledge Graph</h3>
            <button 
              onClick={() => setShowUploadPanel(false)}
              className="close-upload-btn"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="upload-panel-content">
            <div className="file-upload-area">
              <input
                type="file"
                id="graph-file-upload"
                accept=".pdf,.txt,.docx"
                onChange={handleFileSelect}
                className="file-input"
                disabled={uploading}
              />
              <label htmlFor="graph-file-upload" className="file-label">
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

            {uploadError && (
              <div className="upload-error">
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div className="upload-success">
                <CheckCircle size={20} />
                Content uploaded successfully! Graph updating...
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
                  Upload to Graph
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      <GraphControls
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        depthLevel={depthLevel}
        setDepthLevel={setDepthLevel}
        filterType={filterType}
        setFilterType={setFilterType}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
      />

      <ReactFlow
        nodes={filteredNodes}
        edges={filteredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#1e293b" gap={16} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            const colors = {
              memory: '#10b981',
              concept: '#6366f1',
              entity: '#f59e0b',
              source: '#8b5cf6'
            };
            return colors[node.type] || '#94a3b8';
          }}
          nodeStrokeWidth={3}
          pannable
          zoomable
        />
        
        <Panel position="bottom-left">
          <GraphStats stats={graphStats} />
        </Panel>
        
        {selectedNode && (
          <Panel position="top-right">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="node-details"
            >
              <h3>Node Details</h3>
              <p><strong>ID:</strong> {selectedNode.id}</p>
              <p><strong>Type:</strong> {selectedNode.type}</p>
              {selectedNode.data.summary && (
                <p><strong>Summary:</strong> {selectedNode.data.summary}</p>
              )}
              {selectedNode.data.tags && (
                <p><strong>Tags:</strong> {selectedNode.data.tags.join(', ')}</p>
              )}
            </motion.div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
};

import ErrorBoundary from './ErrorBoundary';

export default function KnowledgeGraphWrapper(props) {
  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <KnowledgeGraph {...props} />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}
