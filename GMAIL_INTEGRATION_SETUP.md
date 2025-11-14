# 📧 Gmail Integration Setup Guide

## 🚀 Complete Implementation for CogniVault Email Intelligence

This guide will walk you through setting up Gmail integration for CogniVault, allowing you to:
- Connect Gmail accounts via OAuth
- Import and process emails into your knowledge vault
- Automatically classify emails as Notes, Important, or Ignored
- View important emails on your dashboard
- Sync new emails automatically

---

## 📋 Prerequisites

Before starting, ensure you have:
- A Google Cloud account (free tier available)
- Node.js backend running
- Redis installed locally (for job queue)
- MongoDB, Neo4j, and Pinecone already configured

---

## 🔧 Step 1: Google Cloud Setup

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Create Project"**
3. Name it: `cognivault-email` (or your preference)
4. Note your **Project ID**

### 1.2 Enable Required APIs

In your Google Cloud project, enable these APIs:

```bash
# Using gcloud CLI:
gcloud services enable gmail.googleapis.com
gcloud services enable oauth2.googleapis.com

# Or manually in Console:
# Go to APIs & Services → Library
# Search and enable:
# - Gmail API
# - Google OAuth2 API
```

### 1.3 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → **OAuth client ID**
3. If prompted, configure OAuth consent screen first:
   - User Type: **External** (for testing)
   - App name: **CogniVault**
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add these scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.labels`
     - `https://www.googleapis.com/auth/userinfo.email`

4. Create OAuth client:
   - Application type: **Web application**
   - Name: **CogniVault Web Client**
   - Authorized JavaScript origins:
     - `http://localhost:5173`
     - `http://localhost:5001`
   - Authorized redirect URIs:
     - `http://localhost:5001/api/email/oauth/callback`
   - Click **Create**

5. **Download** the credentials JSON and save:
   - Client ID: `YOUR_CLIENT_ID`
   - Client Secret: `YOUR_CLIENT_SECRET`

---

## 🔑 Step 2: Environment Variables

Add these to your `server/.env` file:

```env
# Google OAuth / Gmail
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=http://localhost:5001/api/email/oauth/callback

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# Encryption key for token storage (generate a random 32-char string)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Frontend URL (for OAuth redirect)
FRONTEND_URL=http://localhost:5173
```

To generate an encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## 📦 Step 3: Install Dependencies

### Backend Dependencies

```bash
cd server
npm install googleapis bull redis
```

Your `package.json` should now include:
```json
{
  "dependencies": {
    "googleapis": "^128.0.0",
    "bull": "^4.11.5",
    "redis": "^4.6.11",
    // ... other dependencies
  }
}
```

### Start Redis (Required for Job Queue)

#### macOS:
```bash
# Install Redis
brew install redis

# Start Redis
brew services start redis

# Or run in foreground
redis-server
```

#### Linux:
```bash
# Install Redis
sudo apt-get install redis-server

# Start Redis
sudo systemctl start redis
```

#### Windows:
Use WSL or Docker:
```bash
docker run -d -p 6379:6379 redis:latest
```

---

## 🧪 Step 4: Testing the Integration

### 4.1 Start the Backend

```bash
cd server
npm run dev
```

You should see:
```
✅ Email queue initialized
🌟 CogniVault server running on http://localhost:5001
```

### 4.2 Start the Frontend

```bash
cd client
npm run dev
```

### 4.3 Test Gmail Connection

1. **Go to Dashboard**: http://localhost:5173/dashboard
2. **Look for** "Email Intelligence" section at bottom
3. **Click** "📧 Connect Email" button
4. **You'll be redirected** to Google OAuth
5. **Sign in** with your Gmail account
6. **Grant permissions** (read-only access)
7. **Redirected back** to dashboard with success message

### 4.4 Import Test Emails (Top 5)

1. After connecting, you'll see your email account listed
2. Click **"Import Top 5"** button
3. Watch the status change to "Importing..."
4. Wait for completion (about 10-30 seconds)
5. Status changes to "Imported" ✅

### 4.5 View Processed Emails

1. **Important Emails Widget**: Shows on dashboard
2. **Knowledge Graph**: Navigate to graph to see email nodes
3. **Check MongoDB**: Verify email documents created

---

## 📊 Step 5: Verify Data Flow

### 5.1 Check MongoDB Collections

```javascript
// In MongoDB Compass or shell
use cognivault

// Check email accounts
db.email_accounts.find()
// Should show connected account with encrypted tokens

// Check processed messages
db.mail_messages.find()
// Should show imported emails with classification

// Check email chunks
db.mail_chunks.find()
// Should show chunked email content with embeddings
```

### 5.2 Check Neo4j Graph

```cypher
// In Neo4j Browser
// Find Email nodes
MATCH (e:Email) RETURN e LIMIT 10

// Find Memory nodes from emails
MATCH (m:Memory)-[:DERIVED_FROM]->(e:Email) RETURN m, e LIMIT 10

// View full email graph
MATCH (m:Memory)-[r]-(n) 
WHERE (n:Email OR n:Concept OR n:Entity)
RETURN m, r, n LIMIT 50
```

### 5.3 Check Pinecone Vectors

```javascript
// Check vectors in Pinecone
// Look for vectors with metadata.source = 'gmail'
```

---

## 🎯 Step 6: Testing Email Classification

The AI classifies emails into three categories:

### Test Email Examples

#### 1. **IMPORTANT** Email (Action Required)
```
Subject: Meeting Tomorrow - Please Confirm
From: boss@company.com

Hi, please confirm your attendance for tomorrow's 2pm meeting about Q4 planning.
Need your confirmation by EOD today.
```
Expected: Category = IMPORTANT, High confidence

#### 2. **NOTE** Email (Knowledge/Learning)
```
Subject: Docker Best Practices Guide
From: tech-newsletter@example.com

Here are 10 best practices for Docker containers:
1. Use multi-stage builds
2. Minimize layer count
[... technical content ...]
```
Expected: Category = NOTE, Will be saved as memory

#### 3. **IGNORE** Email (Spam/Marketing)
```
Subject: 50% OFF Sale Ends Today!
From: marketing@store.com

Don't miss our biggest sale of the year!
```
Expected: Category = IGNORE, Won't be processed

---

## 🔄 Step 7: Test Auto-Sync (Optional)

1. **Enable Auto-Sync**: Toggle the switch for your connected account
2. **Send yourself a test email**
3. **Click "Sync Now"** or wait for periodic sync
4. **Check if new email appears** in Important Emails widget

---

## 🐛 Step 8: Troubleshooting

### Issue: "Failed to connect Gmail account"

**Check:**
1. OAuth credentials in `.env` match Google Cloud Console
2. Redirect URI is exactly: `http://localhost:5001/api/email/oauth/callback`
3. Gmail API is enabled in Google Cloud Console

### Issue: "Import job failed"

**Check:**
1. Redis is running: `redis-cli ping` should return `PONG`
2. Gemini API key is configured and working
3. Check backend logs for specific errors

### Issue: Emails not showing in Knowledge Graph

**Check:**
1. Emails were classified as NOTE or IMPORTANT (not IGNORE)
2. Neo4j is running and connected
3. Check `mail_chunks` collection has `neo4j_node_id` field

### Issue: OAuth redirect fails

**Check:**
1. Frontend URL in `.env` matches actual frontend URL
2. No trailing slashes in URLs
3. Cookies enabled in browser

---

## 📈 Step 9: Production Considerations

### Security
- ✅ Tokens are encrypted before storage
- ✅ Only read-only Gmail access requested
- ✅ User can disconnect accounts anytime
- ⚠️ Use HTTPS in production
- ⚠️ Implement rate limiting

### Scaling
- Use Redis Cluster for high volume
- Implement batching for large email imports
- Consider separate worker processes for email processing
- Add monitoring for job queue health

### Compliance
- Add privacy policy mentioning email processing
- Implement data retention policies
- Allow users to delete all email data
- Log all email access for audit trail

---

## ✅ Step 10: Success Checklist

After setup, verify:

- [ ] Google Cloud project created
- [ ] Gmail API enabled
- [ ] OAuth credentials configured
- [ ] Environment variables set
- [ ] Redis running
- [ ] Backend starts without errors
- [ ] Can connect Gmail account via OAuth
- [ ] Can import top 5 emails
- [ ] Emails appear in Important Emails widget
- [ ] Email nodes visible in Knowledge Graph
- [ ] Classifications working (Important/Note/Ignore)
- [ ] Embeddings stored in Pinecone
- [ ] Can disconnect account

---

## 🎉 Congratulations!

Your Gmail integration is now complete! You can:
- Connect multiple Gmail accounts
- Process emails into your knowledge vault
- View important emails on dashboard
- Search emails through Knowledge Graph
- Auto-sync new emails

### Next Steps:
1. Import more emails (up to 100)
2. Fine-tune classification prompts
3. Set up auto-sync schedules
4. Add email search functionality
5. Implement Gmail push notifications for real-time sync

---

## 📚 Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google OAuth2 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Redis Documentation](https://redis.io/documentation)

---

## 🆘 Need Help?

If you encounter issues:
1. Check backend logs: `npm run dev`
2. Check browser console for frontend errors
3. Verify all environment variables are set
4. Ensure all services are running (Redis, MongoDB, Neo4j)
5. Test with a different Gmail account

Happy emailing! 📧✨
