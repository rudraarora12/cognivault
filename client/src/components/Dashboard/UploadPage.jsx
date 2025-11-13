import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain, FileUp, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SmartUpload from '../Upload/SmartUpload';
import '../../styles/dashboard.css';

function UploadPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [uploadCount, setUploadCount] = useState(0);
  
  const handleUploadSuccess = (result) => {
    setUploadCount(prev => prev + 1);
    
    // Show success notification
    setTimeout(() => {
      if (window.confirm('Upload successful! Would you like to view your knowledge graph now?')) {
        navigate('/knowledge-graph');
      }
    }, 1500);
  };
  
  return (
    <div className="dashboard-container">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="dashboard-content"
      >
        {/* Header */}
        <div className="dashboard-header">
          <button
            className="back-button"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          
          <h1 className="dashboard-title">
            <FileUp size={32} />
            Smart Upload System
          </h1>
        </div>
        
        {/* Info Section */}
        <motion.div
          className="info-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="info-card">
            <Info size={20} />
            <div className="info-content">
              <h3>How Smart Upload Works</h3>
              <ul>
                <li>📄 Upload any document (PDF, Word, Text, Images)</li>
                <li>🧠 AI extracts and analyzes the content</li>
                <li>🔗 Automatically creates knowledge graph nodes</li>
                <li>💡 Discovers connections with existing memories</li>
                <li>🔍 Makes content searchable through AI chat</li>
              </ul>
            </div>
          </div>
        </motion.div>
        
        {/* Upload Component */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <SmartUpload
            userId={currentUser?.uid || 'demo_user'}
            onUploadSuccess={handleUploadSuccess}
          />
        </motion.div>
        
        {/* Stats */}
        {uploadCount > 0 && (
          <motion.div
            className="upload-stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="stat-card">
              <Brain size={24} />
              <span className="stat-value">{uploadCount}</span>
              <span className="stat-label">Files Uploaded This Session</span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default UploadPage;
