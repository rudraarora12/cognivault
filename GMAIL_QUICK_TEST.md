# 🚀 Gmail Integration - Quick Test Guide

## ✅ What's Been Implemented

### Backend Services
- ✅ **Gmail Service** (`server/services/gmail.service.js`)
  - OAuth authentication flow
  - Token encryption/decryption
  - Message fetching from Gmail
  - Account management

- ✅ **Email Processor** (`server/services/emailProcessor.service.js`)
  - AI classification (Important/Note/Ignore)
  - Text chunking
  - Embedding generation
  - Neo4j graph integration
  - Pinecone vector storage

- ✅ **Email Routes** (`server/routes/email.routes.js`)
  - OAuth endpoints
  - Import/sync endpoints
  - Job queue integration
  - Message retrieval

### Frontend Components
- ✅ **Email Connect Modal** (`client/src/components/EmailIntegration/EmailConnect.jsx`)
  - Connect Gmail accounts
  - Import emails
  - Manage connections

- ✅ **Important Emails Widget** (`client/src/components/EmailIntegration/ImportantEmails.jsx`)
  - Display important emails on dashboard
  - Expandable email details
  - Classification confidence

### Integration Points
- ✅ Dashboard shows Email Intelligence section
- ✅ Emails processed into Knowledge Graph
- ✅ Vector embeddings stored in Pinecone
- ✅ Graph nodes created in Neo4j

---

## 🔑 Quick Setup (5 Minutes)

### 1. Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend (if needed)
cd ../client
npm install
```

### 2. Start Redis (REQUIRED)

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Docker (any OS)
docker run -d -p 6379:6379 redis:latest
```

### 3. Update Environment Variables

Add to `server/.env`:

```env
# Google OAuth (REPLACE WITH YOUR CREDENTIALS)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:5001/api/email/oauth/callback

# Redis
REDIS_URL=redis://localhost:6379

# Encryption (use this or generate your own)
ENCRYPTION_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# Frontend
FRONTEND_URL=http://localhost:5173

# Existing Gemini API key (you already have this)
GEMINI_API_KEY=AIzaSyBCUMFbxVUEDyBeDZtd0xZZKL-3uCeJiaI
```

### 4. Get Google Cloud Credentials

**Quick Option - Use Test Credentials (Limited)**
For immediate testing, you can use test credentials, but you'll need your own for production.

**Proper Setup - Get Your Own (Recommended)**
1. Go to https://console.cloud.google.com/
2. Create new project or select existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `http://localhost:5001/api/email/oauth/callback`
6. Copy Client ID and Client Secret

---

## 🧪 Test Flow (2 Minutes)

### Start Services

```bash
# Terminal 1 - Backend
cd server
npm run dev
# Should see: "Email queue initialized"

# Terminal 2 - Frontend  
cd client
npm run dev
```

### Test Gmail Connection

1. **Open Dashboard**: http://localhost:5173/dashboard
2. **Scroll down** to "Email Intelligence" section
3. **Click** "📧 Connect Email"
4. **Follow OAuth flow** (sign in with Gmail)
5. **Import emails**: Click "Import Top 5"
6. **View results**: Important emails appear in widget

---

## 🎯 What to Test

### Test 1: Basic Connection
```
✓ Connect Gmail account
✓ Account appears in modal
✓ Can disconnect account
```

### Test 2: Import Emails (Top 5)
```
✓ Click "Import Top 5"
✓ Status shows "Importing..."
✓ Emails processed and classified
✓ Important emails show in widget
```

### Test 3: Knowledge Graph Integration
```
✓ Go to Knowledge Graph
✓ See Email source nodes (purple)
✓ See Memory nodes from emails (green)
✓ Relationships created (DERIVED_FROM)
```

### Test 4: Classification
```
✓ Important emails marked with star
✓ Classification confidence shown
✓ Tags extracted from content
✓ Summaries generated
```

---

## 📝 Sample Test Emails

Send these to yourself to test classification:

### Email 1: IMPORTANT
```
Subject: Urgent: Meeting Tomorrow 2pm
Body: Please confirm your attendance for tomorrow's product review meeting at 2pm. 
We need to finalize the Q4 roadmap. Your input is critical.
```

### Email 2: NOTE (Technical)
```
Subject: React 19 Performance Tips
Body: Here are 5 ways to improve React performance:
1. Use React.memo for expensive components
2. Implement virtual scrolling for long lists
3. Lazy load components with Suspense
4. Optimize re-renders with useMemo
5. Use production builds for deployment
```

### Email 3: IGNORE
```
Subject: 50% OFF Everything!
Body: Limited time offer! Get 50% off all items in our store. 
Click here to shop now!
```

---

## 🔍 Verify Success

### Backend Logs Should Show:
```
✅ Email queue initialized
✅ Received OAuth callback for user: demo_user
✅ Saved email account: yourname@gmail.com
✅ Processing email: [subject]
✅ Email classified as: IMPORTANT/NOTE
✅ Created Memory node: memory_xxx
✅ Stored vector in Pinecone: mail_xxx_chunk_0
```

### MongoDB Collections:
```javascript
// Check imported emails
db.mail_messages.find().pretty()

// Check email chunks
db.mail_chunks.find().pretty()

// Check connected accounts
db.email_accounts.find().pretty()
```

### Neo4j Graph:
```cypher
// Find email nodes
MATCH (e:Email) RETURN e LIMIT 5

// Find memories from emails
MATCH (m:Memory)-[:DERIVED_FROM]->(e:Email) 
RETURN m.summary, e.subject
```

---

## ⚡ Quick Fixes

### "Failed to connect Gmail"
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Verify redirect URI matches exactly
echo $GOOGLE_REDIRECT_URI
# Must be: http://localhost:5001/api/email/oauth/callback
```

### "Import failed"
```bash
# Check Gemini API key
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_KEY" \
-H 'Content-Type: application/json' \
-d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

### "Emails not showing"
```javascript
// Check if classified correctly
db.mail_messages.find({"classification.category": "IMPORTANT"})

// Check Redis queue
redis-cli
> keys *
> llen bull:email-processing:wait
```

---

## 🎉 Success Metrics

After successful setup:
- ✅ 1+ Gmail account connected
- ✅ 5 emails imported
- ✅ 2-3 marked as Important/Notes
- ✅ Email nodes in Knowledge Graph
- ✅ Vectors in Pinecone with metadata.source = 'gmail'
- ✅ Important emails visible on dashboard

---

## 🚀 Next Steps

1. **Import more emails**: Change limit to 20, 50, or 100
2. **Test auto-sync**: Enable for real-time updates
3. **Customize classification**: Adjust prompts in emailProcessor.service.js
4. **Add email search**: Search emails in Knowledge Graph
5. **Set up production**: Use proper OAuth credentials

---

## 💡 Pro Tips

- Start with 5 emails for testing
- Check classification confidence scores
- Important emails should be >70% confidence
- Ignored emails won't create graph nodes
- Use "Sync Now" to check for new emails
- Disconnect/reconnect to reset and test again

---

**Ready to test? Start with Step 1 above!** 📧✨

Time needed: ~10 minutes total
- 5 min: Setup
- 2 min: Connect Gmail
- 3 min: Import & verify

**Questions? Check GMAIL_INTEGRATION_SETUP.md for detailed guide!**
