import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Star, 
  Clock, 
  Tag,
  ExternalLink,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import './ImportantEmails.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const ImportantEmails = ({ limit = 5 }) => {
  const { currentUser } = useAuth();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

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

  useEffect(() => {
    // Always try to fetch, even without currentUser
    fetchImportantEmails();
  }, [currentUser]);

  const fetchImportantEmails = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const response = await axios.get(
        `${API_URL}/email/messages/important?limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setEmails(response.data.messages || []);
    } catch (err) {
      console.error('Error fetching important emails:', err);
      setError('Failed to load important emails');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (emailId) => {
    setExpanded({ ...expanded, [emailId]: !expanded[emailId] });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const extractSender = (from) => {
    const match = from.match(/^([^<]+)/);
    return match ? match[1].trim() : from;
  };

  if (loading) {
    return (
      <div className="important-emails-widget loading">
        <div className="widget-header">
          <Mail size={20} />
          <h3>Important Emails</h3>
        </div>
        <div className="loading-skeleton">
          <div className="skeleton-item" />
          <div className="skeleton-item" />
          <div className="skeleton-item" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="important-emails-widget error">
        <div className="widget-header">
          <Mail size={20} />
          <h3>Important Emails</h3>
        </div>
        <div className="error-message">
          <AlertCircle size={16} />
          {error}
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="important-emails-widget empty">
        <div className="widget-header">
          <Mail size={20} />
          <h3>Important Emails</h3>
        </div>
        <div className="empty-state">
          <Mail size={32} className="icon-muted" />
          <p>No important emails yet</p>
          <span>Connect your email account to get started</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="important-emails-widget"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="widget-header">
        <div className="header-left">
          <Mail size={20} />
          <h3>Important Emails</h3>
          <span className="email-count">{emails.length}</span>
        </div>
        <button className="view-all-btn">
          View All
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="emails-list">
        {emails.map((email, index) => (
          <motion.div
            key={email._id}
            className="email-item"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => toggleExpand(email._id)}
          >
            <div className="email-header">
              <div className="email-meta">
                <Star size={16} className="importance-icon" />
                <span className="email-from">{extractSender(email.from)}</span>
                <span className="email-time">
                  <Clock size={12} />
                  {formatDate(email.date)}
                </span>
              </div>
              {email.classification?.confidence && (
                <div className="confidence-badge">
                  {Math.round(email.classification.confidence * 100)}%
                </div>
              )}
            </div>

            <h4 className="email-subject">{email.subject}</h4>

            {email.classification?.short_summary && (
              <p className="email-summary">
                {email.classification.short_summary}
              </p>
            )}

            {expanded[email._id] && (
              <motion.div
                className="email-expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <div className="email-body">
                  {email.raw_text?.substring(0, 500)}...
                </div>

                {email.classification?.tags && (
                  <div className="email-tags">
                    {email.classification.tags.map((tag, i) => (
                      <span key={i} className="tag">
                        <Tag size={12} />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {email.classification?.reasons && (
                  <div className="email-reasons">
                    <strong>Why important:</strong>
                    <ul>
                      {email.classification.reasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default ImportantEmails;
