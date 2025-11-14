import express from 'express';
import gmailService from '../services/gmail.service.js';
import emailProcessorService from '../services/emailProcessor.service.js';
import { authenticateUser } from '../middleware/auth.middleware.js';
import Queue from 'bull';
import { createClient } from 'redis';

const router = express.Router();

// Initialize Redis client and Bull Queue
let emailQueue;

async function initializeQueue() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    emailQueue = new Queue('email-processing', redisUrl);
    
    // Process email jobs
    emailQueue.process('process-email', async (job) => {
      const { userId, email, message } = job.data;
      return await emailProcessorService.processEmail(userId, email, message);
    });
    
    // Process batch import
    emailQueue.process('import-emails', async (job) => {
      const { userId, email, maxResults } = job.data;
      
      // Fetch messages from Gmail
      const messages = await gmailService.fetchMessages(userId, email, maxResults);
      
      // Process each message
      const results = await emailProcessorService.processBatch(userId, email, messages);
      
      return {
        total: messages.length,
        processed: results.filter(r => !r.error).length,
        errors: results.filter(r => r.error).length
      };
    });
    
    console.log('Email queue initialized');
  } catch (error) {
    console.error('Failed to initialize email queue:', error);
    // Continue without queue - process synchronously
  }
}

initializeQueue();

// Get OAuth URL for Gmail connection
router.get('/connect-url', authenticateUser, (req, res) => {
  try {
    const userId = req.user?.uid || 'demo_user';
    const authUrl = gmailService.getAuthUrl(userId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error getting auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL', details: error.message });
  }
});

// Handle OAuth callback
router.get('/oauth/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  
  if (!code || !userId) {
    return res.status(400).json({ error: 'Missing code or state' });
  }
  
  try {
    // Exchange code for tokens
    const tokens = await gmailService.getTokensFromCode(code);
    
    // Get user email from Google
    const { google } = await import('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials(tokens);
    
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    
    // Save account
    await gmailService.saveEmailAccount(userId, tokens, data.email);
    
    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?email_connected=true&email=${data.email}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?email_error=true`);
  }
});

// Get connected email accounts
router.get('/accounts', authenticateUser, async (req, res) => {
  try {
    const accounts = await gmailService.getUserAccounts(req.user.uid);
    res.json({ accounts });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Import emails (with job queue)
router.post('/import', authenticateUser, async (req, res) => {
  const { email, maxResults = 5 } = req.body;
  const userId = req.user.uid;
  
  if (!email) {
    return res.status(400).json({ error: 'Email account required' });
  }
  
  try {
    if (emailQueue) {
      // Queue the import job
      const job = await emailQueue.add('import-emails', {
        userId,
        email,
        maxResults
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });
      
      res.json({ 
        success: true, 
        jobId: job.id,
        message: `Import job queued for ${maxResults} emails`
      });
    } else {
      // Process synchronously if no queue
      const messages = await gmailService.fetchMessages(userId, email, maxResults);
      const results = await emailProcessorService.processBatch(userId, email, messages);
      
      res.json({
        success: true,
        total: messages.length,
        processed: results.filter(r => !r.error).length,
        errors: results.filter(r => r.error)
      });
    }
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import emails' });
  }
});

// Get import job status
router.get('/import/status/:jobId', authenticateUser, async (req, res) => {
  const { jobId } = req.params;
  
  if (!emailQueue) {
    return res.status(400).json({ error: 'Queue not available' });
  }
  
  try {
    const job = await emailQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;
    
    res.json({
      jobId,
      state,
      progress,
      result
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

// Toggle auto-sync
router.post('/auto-sync', authenticateUser, async (req, res) => {
  const { email, enabled } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email account required' });
  }
  
  try {
    const result = await gmailService.toggleAutoSync(req.user.uid, email, enabled);
    res.json(result);
  } catch (error) {
    console.error('Auto-sync error:', error);
    res.status(500).json({ error: 'Failed to toggle auto-sync' });
  }
});

// Get important emails
router.get('/messages/important', authenticateUser, async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    const messages = await emailProcessorService.getImportantEmails(req.user.uid, limit);
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching important emails:', error);
    res.status(500).json({ error: 'Failed to fetch important emails' });
  }
});

// Get email notes
router.get('/messages/notes', authenticateUser, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  
  try {
    const messages = await emailProcessorService.getEmailNotes(req.user.uid, limit);
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching email notes:', error);
    res.status(500).json({ error: 'Failed to fetch email notes' });
  }
});

// Get all processed messages
router.get('/messages', authenticateUser, async (req, res) => {
  const { filter = 'all', limit = 50 } = req.query;
  
  try {
    const db = await import('../config/mongodb.js').then(m => m.connectMongoDB());
    const query = { user_id: req.user.uid };
    
    if (filter === 'important') {
      query['classification.category'] = 'IMPORTANT';
    } else if (filter === 'notes') {
      query['classification.category'] = 'NOTE';
    } else if (filter === 'ignored') {
      query.status = 'ignored';
    }
    
    const messages = await db.collection('mail_messages')
      .find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Disconnect email account
router.delete('/disconnect', authenticateUser, async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email account required' });
  }
  
  try {
    const result = await gmailService.disconnectAccount(req.user.uid, email);
    res.json(result);
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

// Manual sync check (for testing)
router.post('/sync', authenticateUser, async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email account required' });
  }
  
  try {
    // Fetch latest emails (last 24 hours)
    const messages = await gmailService.fetchMessages(
      req.user.uid, 
      email, 
      10, 
      'newer_than:1d'
    );
    
    // Process new messages
    const results = await emailProcessorService.processBatch(req.user.uid, email, messages);
    
    res.json({
      success: true,
      new_messages: messages.length,
      processed: results.filter(r => !r.error).length
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync emails' });
  }
});

export default router;
