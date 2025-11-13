import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Image,
  File,
  CheckCircle,
  XCircle,
  Loader,
  Clock,
  Tag,
  Brain,
  AlertCircle,
  X,
  Eye
} from 'lucide-react';
import axios from 'axios';
import './SmartUpload.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// File type configurations
const FILE_TYPES = {
  pdf: { icon: FileText, color: '#dc2626' },
  doc: { icon: FileText, color: '#2563eb' },
  docx: { icon: FileText, color: '#2563eb' },
  txt: { icon: FileText, color: '#6b7280' },
  md: { icon: FileText, color: '#8b5cf6' },
  image: { icon: Image, color: '#10b981' },
  default: { icon: File, color: '#6b7280' }
};

const ALLOWED_TYPES = [
  '.pdf', '.doc', '.docx', '.txt', '.md',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'
];

function SmartUpload({ userId = 'demo_user', onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  
  const fileInputRef = useRef(null);
  
  // Get file type for icon
  const getFileType = (fileName, mimeType) => {
    if (mimeType?.startsWith('image/')) return 'image';
    const ext = fileName.split('.').pop().toLowerCase();
    return FILE_TYPES[ext] ? ext : 'default';
  };
  
  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);
  
  // Handle drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);
  
  // Handle file selection
  const handleFileSelect = (selectedFile) => {
    const fileExt = '.' + selectedFile.name.split('.').pop().toLowerCase();
    
    if (!ALLOWED_TYPES.includes(fileExt)) {
      setError(`File type not supported. Allowed types: ${ALLOWED_TYPES.join(', ')}`);
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return;
    }
    
    setFile(selectedFile);
    setError(null);
    setUploadResult(null);
  };
  
  // Handle file upload
  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(
        `${API_URL}/upload/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          params: { user_id: userId }
        }
      );
      
      setUploadResult(response.data);
      setFile(null);
      
      // Fetch updated history
      fetchUploadHistory();
      
      // Callback to parent
      if (onUploadSuccess) {
        onUploadSuccess(response.data);
      }
      
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };
  
  // Fetch upload history
  const fetchUploadHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/upload/history`, {
        params: { user_id: userId, limit: 5 }
      });
      setUploadHistory(response.data.files || []);
    } catch (err) {
      console.error('Failed to fetch upload history:', err);
    }
  };
  
  // View file details
  const viewFileDetails = async (fileId) => {
    try {
      const response = await axios.get(`${API_URL}/upload/file/${fileId}`, {
        params: { user_id: userId }
      });
      setViewingFile(response.data);
    } catch (err) {
      console.error('Failed to fetch file details:', err);
    }
  };
  
  // Load history on mount
  React.useEffect(() => {
    fetchUploadHistory();
  }, [userId]);
  
  return (
    <div className="smart-upload-container">
      {/* Upload Area */}
      <motion.div
        className={`upload-area ${dragActive ? 'drag-active' : ''}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!file ? (
          <div className="upload-prompt" onClick={() => fileInputRef.current?.click()}>
            <Upload size={48} className="upload-icon" />
            <h3>Drop your file here or click to browse</h3>
            <p>Supports: PDF, Word, Text, Markdown, Images</p>
            <p className="file-limit">Max file size: 10MB</p>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              accept={ALLOWED_TYPES.join(',')}
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div className="selected-file">
            <div className="file-preview">
              {React.createElement(
                FILE_TYPES[getFileType(file.name, file.type)]?.icon || File,
                { size: 48, color: FILE_TYPES[getFileType(file.name, file.type)]?.color }
              )}
              <div className="file-info">
                <h4>{file.name}</h4>
                <p>{(file.size / 1024).toFixed(2)} KB</p>
              </div>
              <button
                className="remove-file"
                onClick={() => {
                  setFile(null);
                  setUploadResult(null);
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            <button
              className="upload-button"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader className="spinning" size={20} />
                  Processing...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Upload & Process
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
      
      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="upload-error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <XCircle size={20} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Upload Result */}
      <AnimatePresence>
        {uploadResult && uploadResult.success && (
          <motion.div
            className="upload-success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="success-header">
              <CheckCircle size={24} />
              <h3>Upload Successful!</h3>
            </div>
            
            <div className="result-grid">
              <div className="result-item">
                <Brain size={20} />
                <span className="label">Chunks Created</span>
                <span className="value">{uploadResult.total_chunks}</span>
              </div>
              
              <div className="result-item">
                <Tag size={20} />
                <span className="label">Tags Extracted</span>
                <span className="value">{uploadResult.total_tags}</span>
              </div>
              
              <div className="result-item">
                <FileText size={20} />
                <span className="label">Document Type</span>
                <span className="value">{uploadResult.document_type}</span>
              </div>
              
              <div className="result-item">
                <Clock size={20} />
                <span className="label">Processing Time</span>
                <span className="value">{uploadResult.processing_time_ms}ms</span>
              </div>
            </div>
            
            <p className="success-message">{uploadResult.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Upload History */}
      {uploadHistory.length > 0 && (
        <motion.div
          className="upload-history"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h3>Recent Uploads</h3>
          <div className="history-list">
            {uploadHistory.map(file => (
              <motion.div
                key={file.file_id}
                className="history-item"
                whileHover={{ scale: 1.02 }}
                onClick={() => viewFileDetails(file.file_id)}
              >
                <div className="history-icon">
                  {React.createElement(
                    FILE_TYPES[getFileType(file.file_name, file.file_type)]?.icon || File,
                    { size: 24 }
                  )}
                </div>
                
                <div className="history-info">
                  <h4>{file.file_name}</h4>
                  <p>
                    {file.total_chunks} chunks • {file.total_characters} chars
                    {file.processing_status === 'completed' ? (
                      <CheckCircle size={14} className="status-icon success" />
                    ) : file.processing_status === 'processing' ? (
                      <Loader size={14} className="status-icon processing spinning" />
                    ) : (
                      <XCircle size={14} className="status-icon error" />
                    )}
                  </p>
                </div>
                
                <div className="history-actions">
                  <button
                    className="view-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      viewFileDetails(file.file_id);
                    }}
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
      
      {/* File Details Modal */}
      <AnimatePresence>
        {viewingFile && (
          <motion.div
            className="file-details-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingFile(null)}
          >
            <motion.div
              className="file-details-modal"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>{viewingFile.file?.file_name}</h2>
                <button onClick={() => setViewingFile(null)}>
                  <X size={24} />
                </button>
              </div>
              
              <div className="modal-content">
                <div className="file-metadata">
                  <div className="meta-item">
                    <strong>Document Type:</strong>
                    {viewingFile.file?.document_analysis?.document_type}
                  </div>
                  <div className="meta-item">
                    <strong>Main Topic:</strong>
                    {viewingFile.file?.document_analysis?.main_topic}
                  </div>
                  <div className="meta-item">
                    <strong>Total Chunks:</strong>
                    {viewingFile.chunks?.length}
                  </div>
                </div>
                
                <div className="chunks-preview">
                  <h3>Processed Chunks</h3>
                  <div className="chunks-list">
                    {viewingFile.chunks?.slice(0, 3).map((chunk, idx) => (
                      <div key={chunk.chunk_id} className="chunk-preview">
                        <h4>Chunk {idx + 1}</h4>
                        <p className="chunk-summary">{chunk.summary}</p>
                        <div className="chunk-tags">
                          {chunk.tags?.map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SmartUpload;
