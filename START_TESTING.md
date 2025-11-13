# 🚀 Quick Start - Testing Smart Upload + Knowledge Graph

## ✅ Issue Fixed
The CSS import error has been resolved. The system is ready to test!

---

## 🔥 Start Both Services

### **Terminal 1 - Backend**
```bash
cd /Users/rakshitjindal/Downloads/CogniVault/cognivault/server
npm run dev
```

**Expected output:**
```
⚠️  Firebase Admin not configured - using mock auth mode
🚀 Initializing services...
✅ Neo4j connected
✅ Successfully connected to MongoDB Atlas
✅ Database and collections initialized
✅ MongoDB connected
✅ Pinecone initialized
✅ Gemini AI initialized
🎉 Services initialized (mock mode available)
🌟 CogniVault server running on http://localhost:5001
```

### **Terminal 2 - Frontend**
```bash
cd /Users/rakshitjindal/Downloads/CogniVault/cognivault/client
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## 🧪 Test Flow (5 Minutes)

### **Step 1: Access the App (30 seconds)**
1. Open browser: http://localhost:5173
2. Click **"Get Started"** or **"Login"**
3. Sign up/Login with any email

### **Step 2: Go to Upload Page (10 seconds)**
1. From Dashboard, click **"Smart Upload"** card (📤)
2. Or directly visit: http://localhost:5173/upload

### **Step 3: Create Test File (1 minute)**
Create a file called `test.txt` with this content:
```
Artificial Intelligence and Machine Learning

AI is transforming technology. Companies like OpenAI, Google DeepMind, 
and Anthropic are developing advanced language models. GPT-4 demonstrates 
remarkable reasoning capabilities. Neural networks enable computers to 
learn from data. The field raises important questions about AI ethics, 
safety, and alignment with human values.
```

### **Step 4: Upload & Process (30 seconds)**
1. Drag `test.txt` onto the upload area
2. Click **"Upload & Process"**
3. Watch the processing (should take 2-5 seconds)
4. See success message with stats:
   - Chunks created
   - Tags extracted
   - Document type
   - Processing time

### **Step 5: View Knowledge Graph (2 minutes)**
1. Click **"View your knowledge graph now?"** (or navigate manually)
2. You should see:
   - 🟣 **1 Purple node** - Your uploaded file (source)
   - 🟢 **2-3 Green nodes** - Memory chunks from your file
   - 🔵 **4-5 Blue nodes** - Concepts (ai, machine-learning, ethics, etc.)
   - 🟠 **2-3 Orange nodes** - Entities (OpenAI, Google DeepMind, etc.)
   - **Lines connecting them all**

3. **Interact with the graph:**
   - Scroll to zoom
   - Drag to pan
   - Click nodes to see details
   - Search for "AI"
   - Try different layouts (Force, Circular, Grid)

### **Step 6: Upload More Files (Optional)**
Create `quantum.txt`:
```
Quantum Computing Revolution

Quantum computers use qubits to perform calculations. IBM and Google 
are leading quantum computing research. Quantum supremacy was achieved 
in 2019. These systems could revolutionize cryptography, drug discovery, 
and optimization problems. Companies like IonQ and Rigetti are building 
quantum processors.
```

Upload this second file and watch:
- New nodes appear
- **SIMILAR_TO edges** connect related memories
- Concepts cluster together
- Graph grows organically

---

## 🎯 What to Verify

### **✅ Upload System:**
- [ ] Drag-and-drop works
- [ ] File preview shows
- [ ] Processing completes without errors
- [ ] Success message displays with stats
- [ ] Upload history updates

### **✅ Knowledge Graph:**
- [ ] New nodes appear after upload
- [ ] Nodes are color-coded correctly
- [ ] Edges connect related content
- [ ] Click nodes to see details
- [ ] Search finds uploaded content
- [ ] Filter by node type works
- [ ] Layouts change smoothly

### **✅ Integration:**
- [ ] Upload → Graph flow is seamless
- [ ] Multiple uploads work
- [ ] Graph updates in real-time
- [ ] No console errors
- [ ] Backend logs show processing

---

## 📊 Expected Results

After uploading 2 test files:

**Graph Statistics:**
- **Nodes:** ~15-20 total
  - 2 Source (purple)
  - 4-6 Memory (green)
  - 6-8 Concept (blue)
  - 3-4 Entity (orange)
- **Edges:** ~15-20 connections
- **Processing:** 3-5 seconds per file

**Backend Logs:**
```
📤 Processing upload: test.txt for user: demo_user
📝 Extracted 523 characters
🔪 Created 2 chunks
✅ Upload processing completed in 2341ms
```

**Frontend:**
- Smooth animations
- No errors in console
- Graph renders beautifully
- All interactions work

---

## 🐛 Troubleshooting

### **Issue: Frontend won't start**
```bash
# Clear cache and reinstall
cd client
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### **Issue: Backend errors**
```bash
# Check .env file exists
cd server
cp .env.example .env
npm run dev
```

### **Issue: Graph doesn't update**
1. Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)
2. Check backend logs for errors
3. Try uploading again

### **Issue: Upload fails**
1. Check file size < 10MB
2. Check file type is supported
3. Look at backend console for specific error
4. Try with simple .txt file first

---

## 🎉 Success Indicators

You know it's working when:
1. ✅ Both servers start without errors
2. ✅ You can access the upload page
3. ✅ Files upload and process successfully
4. ✅ Graph shows your uploaded content
5. ✅ Nodes are clickable and show details
6. ✅ Search and filters work
7. ✅ Everything feels smooth and responsive

---

## 📸 What You Should See

### **Upload Page:**
- Clean interface with drag-and-drop area
- File preview when selected
- Processing animation
- Success card with stats
- Upload history list

### **Knowledge Graph:**
- Colorful nodes floating
- Lines connecting related content
- Smooth zoom/pan
- Node details panel on click
- Search highlighting
- Layout controls

### **Dashboard:**
- Smart Upload card (📤)
- Knowledge Graph card (🕸️)
- Both clickable and working

---

## 🚀 Next Steps After Testing

1. **Upload Real Documents**
   - PDFs from your research
   - Meeting notes
   - Articles you've saved
   - Code documentation

2. **Build Your Knowledge Base**
   - Upload 10-20 files
   - Watch connections emerge
   - Discover insights

3. **Explore the Graph**
   - Find unexpected connections
   - Track topics over time
   - Identify knowledge gaps

4. **Share Feedback**
   - What works well?
   - What could be improved?
   - What features would you like?

---

## 📝 Quick Commands

```bash
# Start backend
cd server && npm run dev

# Start frontend (new terminal)
cd client && npm run dev

# Check backend health
curl http://localhost:5001/api/health

# Check upload service
curl http://localhost:5001/api/upload/health

# View logs
# Just watch the terminal output
```

---

**Ready to test! Start both servers and upload your first file!** 🚀🧠✨

**Time to complete:** ~5 minutes
**Difficulty:** Easy
**Fun factor:** 🔥🔥🔥🔥🔥
