import { google } from 'googleapis';
import crypto from 'crypto';
import { connectMongoDB } from '../config/mongodb.js';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const IV_LENGTH = 16;

// Encryption helpers
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

class GmailService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/email/oauth/callback'
    );
    
    this.scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/userinfo.email'
    ];
  }

  // Generate OAuth URL
  getAuthUrl(userId) {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      state: userId, // Pass userId in state for callback
      prompt: 'consent'
    });
  }

  // Exchange code for tokens
  async getTokensFromCode(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  // Save encrypted tokens to MongoDB
  async saveEmailAccount(userId, tokens, email) {
    try {
      const db = await connectMongoDB();
      const collection = db.collection('email_accounts');
      
      const encryptedTokens = {
        access_token: encrypt(tokens.access_token),
        refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        token_type: tokens.token_type,
        expiry_date: tokens.expiry_date
      };
      
      await collection.updateOne(
        { user_id: userId, email: email },
        {
          $set: {
            user_id: userId,
            email: email,
            provider: 'gmail',
            tokens_encrypted: encryptedTokens,
            connected_at: new Date(),
            auto_sync: false,
            last_sync: null,
            status: 'connected'
          }
        },
        { upsert: true }
      );
      
      return { success: true, email };
    } catch (error) {
      console.warn('MongoDB not available, using in-memory storage:', error.message);
      
      // Use in-memory storage as fallback
      if (!this.mockStorage) {
        this.mockStorage = new Map();
      }
      
      this.mockStorage.set(`${userId}:${email}`, {
        user_id: userId,
        email: email,
        provider: 'gmail',
        tokens: tokens,
        connected_at: new Date(),
        auto_sync: false,
        last_sync: null,
        status: 'connected'
      });
      
      return { success: true, email, warning: 'Using in-memory storage (data will not persist)' };
    }
  }

  // Get decrypted tokens for user
  async getUserTokens(userId, email) {
    try {
      const db = await connectMongoDB();
      const account = await db.collection('email_accounts').findOne({ 
        user_id: userId, 
        email: email 
      });
      
      if (!account || !account.tokens_encrypted) {
        throw new Error('Email account not found');
      }
      
      const tokens = {
        access_token: decrypt(account.tokens_encrypted.access_token),
        refresh_token: account.tokens_encrypted.refresh_token ? 
          decrypt(account.tokens_encrypted.refresh_token) : null,
        token_type: account.tokens_encrypted.token_type,
        expiry_date: account.tokens_encrypted.expiry_date
      };
      
      return tokens;
    } catch (error) {
      // Try mock storage
      if (this.mockStorage && this.mockStorage.has(`${userId}:${email}`)) {
        const account = this.mockStorage.get(`${userId}:${email}`);
        return account.tokens;
      }
      throw new Error('Email account not found');
    }
  }

  // Get Gmail client for user
  async getGmailClient(userId, email) {
    const tokens = await this.getUserTokens(userId, email);
    this.oauth2Client.setCredentials(tokens);
    
    // Handle token refresh if needed
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      await this.saveEmailAccount(userId, credentials, email);
      this.oauth2Client.setCredentials(credentials);
    }
    
    return google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  // Fetch messages from Gmail
  async fetchMessages(userId, email, maxResults = 5, query = '') {
    const gmail = await this.getGmailClient(userId, email);
    
    try {
      // List messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: maxResults,
        q: query || 'in:inbox OR label:important'
      });
      
      if (!response.data.messages) {
        return [];
      }
      
      // Fetch full message details
      const messages = [];
      for (const msg of response.data.messages) {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });
        
        messages.push(this.parseMessage(fullMessage.data));
      }
      
      return messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  // Parse Gmail message
  parseMessage(message) {
    const headers = message.payload.headers;
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    
    return {
      message_id: message.id,
      thread_id: message.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: getHeader('Date'),
      labels: message.labelIds || [],
      snippet: message.snippet,
      body: this.extractBody(message.payload),
      attachments: this.extractAttachments(message.payload)
    };
  }

  // Extract message body
  extractBody(payload) {
    let body = '';
    
    if (payload.body && payload.body.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && !body && part.body.data) {
          // Strip HTML if no plain text available
          const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
          body = html.replace(/<[^>]*>/g, '').trim();
        } else if (part.parts) {
          body += this.extractBody(part);
        }
      }
    }
    
    return body;
  }

  // Extract attachments info
  extractAttachments(payload, attachments = []) {
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.body.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
            attachmentId: part.body.attachmentId
          });
        }
        
        if (part.parts) {
          this.extractAttachments(part, attachments);
        }
      }
    }
    
    return attachments;
  }

  // Get user's connected email accounts
  async getUserAccounts(userId) {
    try {
      const db = await connectMongoDB();
      const accounts = await db.collection('email_accounts')
        .find({ user_id: userId })
        .project({ 
          email: 1, 
          provider: 1, 
          connected_at: 1, 
          auto_sync: 1, 
          last_sync: 1,
          status: 1 
        })
        .toArray();
      
      return accounts;
    } catch (error) {
      console.warn('MongoDB not available, using in-memory storage');
      
      // Use mock storage fallback
      if (!this.mockStorage) {
        return [];
      }
      
      const accounts = [];
      for (const [key, value] of this.mockStorage.entries()) {
        if (key.startsWith(`${userId}:`)) {
          accounts.push({
            email: value.email,
            provider: value.provider,
            connected_at: value.connected_at,
            auto_sync: value.auto_sync,
            last_sync: value.last_sync,
            status: value.status
          });
        }
      }
      return accounts;
    }
  }

  // Toggle auto-sync for an account
  async toggleAutoSync(userId, email, enabled) {
    const db = await connectMongoDB();
    await db.collection('email_accounts').updateOne(
      { user_id: userId, email: email },
      { $set: { auto_sync: enabled } }
    );
    
    // TODO: Setup Gmail push notifications if enabled
    
    return { success: true, auto_sync: enabled };
  }

  // Disconnect email account
  async disconnectAccount(userId, email) {
    const db = await connectMongoDB();
    
    // Remove account
    await db.collection('email_accounts').deleteOne({ 
      user_id: userId, 
      email: email 
    });
    
    // Remove related messages and chunks
    await db.collection('mail_messages').deleteMany({ 
      user_id: userId,
      email: email 
    });
    
    await db.collection('mail_chunks').deleteMany({ 
      user_id: userId,
      email: email 
    });
    
    return { success: true };
  }
}

export default new GmailService();
