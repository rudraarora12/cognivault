# 🔍 Smart Upload Debug Guide

## What Was Fixed:

### Added Comprehensive Logging
I've added detailed logging throughout the upload and graph retrieval process to identify exactly where the issue is occurring.

### Logging Points Added:

1. **Graph API (routes/graph.routes.js)**:
   - User ID being used for upload
   - Summary, tags, and entities extracted
   - Success/failure of memory creation

2. **Graph Service (services/graph.service.js)**:
   - Memory node creation start
   - Neo4j transaction commit
   - MongoDB storage
   - Pinecone vector storage
   - Final success confirmation
   - **Error handling** - will now show specific errors

3. **Graph Retrieval**:
   - User ID being queried
   - Number of nodes found
   - Details of what's being returned

## 🧪 Testing Instructions:

### Step 1: Restart Server
Stop your current server (Ctrl+C) and restart:
```bash
cd server
npm run dev
```

### Step 2: Upload a File
1. Go to Dashboard
2. Click "Smart Upload"
3. Upload a small text file (or type some text)
4. Click "Upload & Analyze"

### Step 3: Check Server Logs
Watch the terminal for these key messages:

**✅ Success Pattern:**
```
[Graph API] Creating memory node for user: demo_user
[Graph Service] Creating memory node for user: demo_user
[Graph Service] Creating Memory node: mem_xxxxx
[Graph Service] Memory node created successfully
[Graph Service] Committing Neo4j transaction...
[Graph Service] Neo4j transaction committed successfully
[Graph Service] MongoDB chunk stored successfully
[Graph Service] Pinecone vector stored successfully
[Graph Service] ✅ Memory node mem_xxxxx fully created for user demo_user
[Graph API] ✅ Memory created successfully: mem_xxxxx
```

**❌ Error Pattern (what to look for):**
```
[Graph Service] Error creating memory node: [ERROR MESSAGE]
[Graph API] ❌ Graph service error: [ERROR MESSAGE]
```

### Step 4: Check Graph Retrieval
When you navigate to Knowledge Graph:

**✅ Success Pattern:**
```
[Graph API] GET /full - Token present: true
[Graph API] Using demo user in mock mode
[Graph Service] Getting graph for user: demo_user
[Graph Service] Querying Neo4j for nodes with user_id: demo_user
[Graph Service] Found X nodes for user demo_user
```

If it shows "Found 0 nodes", the issue is clear.

## 🔍 Common Issues & Solutions:

### Issue 1: Neo4j Connection Failed
**Symptoms:**
```
[Graph Service] Error creating memory node: Could not connect to Neo4j
```

**Solution:**
- Check Neo4j is running (should show in server startup logs)
- Verify `NEO4J_URI` in `.env`

### Issue 2: MongoDB Connection Failed
**Symptoms:**
```
[Graph Service] Error creating memory node: Cannot read collection
```

**Solution:**
- Check MongoDB connection in startup logs
- Verify `MONGODB_URI` in `.env`

### Issue 3: User ID Mismatch
**Symptoms:**
```
[Graph API] Creating memory node for user: some_user
[Graph Service] Getting graph for user: different_user
[Graph Service] Found 0 nodes
```

**Solution:**
- Both should show `demo_user` in mock mode
- If different, check auth middleware

### Issue 4: Transaction Not Committed
**Symptoms:**
```
[Graph Service] Creating Memory node: mem_xxxxx
[Graph Service] Memory node created successfully
# No "transaction committed" message
```

**Solution:**
- Check for errors between these logs
- May be failing silently on tags/entities

## 📋 What to Send Me:

If the upload still doesn't work, send me:

1. **Server logs from upload** (everything from "POST /memory" until response)
2. **Server logs from graph load** (everything from "GET /full" until response)
3. **Any error messages** in red

This will help me pinpoint the exact issue!

## 🎯 Expected Behavior:

After uploading a file, you should see:
1. ✅ "File uploaded successfully" alert
2. Navigate to Knowledge Graph
3. See nodes and connections
4. Can click nodes to see details

If nodes don't appear immediately, try:
- Refresh the graph (circular arrow button)
- Wait 2-3 seconds and click "Load Full Graph"

## 🚀 Next Steps:

Upload a file and watch the server logs carefully. The new logging will tell us exactly where it's failing!
