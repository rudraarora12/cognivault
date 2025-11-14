import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Link2, 
  CheckCircle, 
  AlertCircle, 
  Trash2,
  RefreshCw,
  Download,
  ToggleLeft,
  ToggleRight,
  X,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import './EmailConnect.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const EmailConnect = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [importStatus, setImportStatus] = useState({});
  
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
    // Always fetch accounts, even without currentUser
    fetchAccounts();
  }, [currentUser]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      const response = await axios.get(`${API_URL}/email/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccounts(response.data.accounts || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError('Failed to fetch email accounts');
    } finally {
      setLoading(false);
    }
  };

  const connectGmail = async () => {
    try {
      const token = await getAuthToken();
      
      const response = await axios.get(`${API_URL}/email/connect-url`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Redirect to Google OAuth
      window.location.href = response.data.authUrl;
    } catch (err) {
      console.error('Error getting auth URL:', err);
      setError('Failed to connect Gmail account');
    }
  };

  const importEmails = async (email, maxResults = 5) => {
    try {
      setImporting(true);
      setError(null);
      setImportStatus({ ...importStatus, [email]: 'importing' });
      
      const token = await getAuthToken();
      const response = await axios.post(
        `${API_URL}/email/import`,
        { email, maxResults },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      if (response.data.jobId) {
        // Poll for job status
        checkJobStatus(response.data.jobId, email);
      } else {
        setImportStatus({ ...importStatus, [email]: 'completed' });
        setSuccess(`Imported ${response.data.processed} emails successfully`);
      }
    } catch (err) {
      console.error('Import error:', err);
      setError('Failed to import emails');
      setImportStatus({ ...importStatus, [email]: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const checkJobStatus = async (jobId, email) => {
    try {
      const token = await getAuthToken();
      
      const interval = setInterval(async () => {
        const response = await axios.get(
          `${API_URL}/email/import/status/${jobId}`,
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        const { state, result } = response.data;
        
        if (state === 'completed') {
          clearInterval(interval);
          setImportStatus({ ...importStatus, [email]: 'completed' });
          setSuccess(`Imported ${result.processed} emails successfully`);
        } else if (state === 'failed') {
          clearInterval(interval);
          setImportStatus({ ...importStatus, [email]: 'error' });
          setError('Import job failed');
        }
      }, 2000);
      
      // Clear interval after 30 seconds
      setTimeout(() => clearInterval(interval), 30000);
    } catch (err) {
      console.error('Error checking job status:', err);
      setImportStatus({ ...importStatus, [email]: 'error' });
    }
  };

  const toggleAutoSync = async (email, currentState) => {
    try {
      const token = await getAuthToken();
      await axios.post(
        `${API_URL}/email/auto-sync`,
        { email, enabled: !currentState },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      // Refresh accounts
      fetchAccounts();
      setSuccess(`Auto-sync ${!currentState ? 'enabled' : 'disabled'} for ${email}`);
    } catch (err) {
      console.error('Error toggling auto-sync:', err);
      setError('Failed to toggle auto-sync');
    }
  };

  const disconnectAccount = async (email) => {
    if (!confirm(`Are you sure you want to disconnect ${email}?`)) {
      return;
    }
    
    try {
      const token = await getAuthToken();
      await axios.delete(`${API_URL}/email/disconnect`, {
        data: { email },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh accounts
      fetchAccounts();
      setSuccess(`Disconnected ${email}`);
    } catch (err) {
      console.error('Error disconnecting account:', err);
      setError('Failed to disconnect account');
    }
  };

  const syncNow = async (email) => {
    try {
      const token = await getAuthToken();
      const response = await axios.post(
        `${API_URL}/email/sync`,
        { email },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      setSuccess(`Synced ${response.data.new_messages} new messages`);
    } catch (err) {
      console.error('Sync error:', err);
      setError('Failed to sync emails');
    }
  };

  return (
    <motion.div
      className="email-connect-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="email-connect-modal"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <div className="modal-header">
          <div className="header-title">
            <Mail size={24} />
            <h2>Email Integration</h2>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <CheckCircle size={20} />
              {success}
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <Loader2 className="spinner" size={32} />
              <p>Loading email accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="no-accounts">
              <Mail size={48} className="icon-muted" />
              <h3>No Email Accounts Connected</h3>
              <p>Connect your Gmail account to automatically sync and process your emails into your knowledge vault.</p>
              <button 
                onClick={connectGmail} 
                className="btn-primary"
              >
                <Link2 size={20} />
                Connect Gmail Account
              </button>
            </div>
          ) : (
            <div className="accounts-list">
              {accounts.map((account) => (
                <div key={account.email} className="account-card">
                  <div className="account-header">
                    <div className="account-info">
                      <Mail size={20} />
                      <div>
                        <h4>{account.email}</h4>
                        <span className="account-meta">
                          Connected {new Date(account.connected_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="account-status">
                      {importStatus[account.email] === 'importing' && (
                        <span className="status-importing">
                          <Loader2 className="spinner-small" />
                          Importing...
                        </span>
                      )}
                      {importStatus[account.email] === 'completed' && (
                        <span className="status-success">
                          <CheckCircle size={16} />
                          Imported
                        </span>
                      )}
                      {importStatus[account.email] === 'error' && (
                        <span className="status-error">
                          <AlertCircle size={16} />
                          Error
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="account-actions">
                    <button
                      onClick={() => importEmails(account.email, 5)}
                      disabled={importing || importStatus[account.email] === 'importing'}
                      className="btn-secondary"
                      title="Import last 5 emails"
                    >
                      <Download size={16} />
                      Import Top 5
                    </button>

                    <button
                      onClick={() => syncNow(account.email)}
                      className="btn-secondary"
                      title="Check for new emails"
                    >
                      <RefreshCw size={16} />
                      Sync Now
                    </button>

                    <button
                      onClick={() => toggleAutoSync(account.email, account.auto_sync)}
                      className={`btn-toggle ${account.auto_sync ? 'active' : ''}`}
                      title={account.auto_sync ? 'Disable auto-sync' : 'Enable auto-sync'}
                    >
                      {account.auto_sync ? (
                        <>
                          <ToggleRight size={16} />
                          Auto-Sync On
                        </>
                      ) : (
                        <>
                          <ToggleLeft size={16} />
                          Auto-Sync Off
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => disconnectAccount(account.email)}
                      className="btn-danger"
                      title="Disconnect account"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {account.last_sync && (
                    <div className="account-footer">
                      Last synced: {new Date(account.last_sync).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}

              <div className="add-account-section">
                <button 
                  onClick={connectGmail} 
                  className="btn-outline"
                >
                  <Link2 size={16} />
                  Add Another Account
                </button>
              </div>
            </div>
          )}

          <div className="integration-info">
            <h4>How it works:</h4>
            <ul>
              <li><strong>Connect:</strong> Securely link your Gmail account with read-only access</li>
              <li><strong>Import:</strong> Process your recent emails (up to 100) into your knowledge vault</li>
              <li><strong>Classify:</strong> AI automatically categorizes emails as Notes, Important, or Ignored</li>
              <li><strong>Sync:</strong> Enable auto-sync to continuously update with new emails</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EmailConnect;
