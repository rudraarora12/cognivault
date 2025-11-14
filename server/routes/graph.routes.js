import { Router } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { verifyFirebaseToken } from '../config/firebaseAdmin.js';
import { getDB } from '../config/mongodb.js';
import { v4 as uuidv4 } from 'uuid';
import * as graphService from '../services/graph.service.js';
import * as mockDataService from '../services/mockData.service.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024, // 12MB cap
  },
});

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// Helper function to extract text from files
async function extractTextFromFile(file) {
  if (!file) return '';

  const buffer = file.buffer;
  const mimetype = file.mimetype;

  try {
    if (mimetype === 'application/pdf') {
      const data = await pdfParse(buffer);
      return data.text;
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (mimetype === 'text/plain' || mimetype === 'text/markdown') {
      return buffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported file type: ${mimetype}`);
    }
  } catch (error) {
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

// Helper function to sanitize content
function sanitizeContent(rawText) {
  if (!rawText) return '';
  return rawText.replace(/\s+/g, ' ').trim();
}

// Helper function to generate AI analysis
async function generateEnhancedAnalysis(content) {
  if (!genAI) {
    // Fallback analysis
    const words = content.split(/\s+/).filter(w => w.length > 3);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const firstFewSentences = sentences.slice(0, 3).join('. ').trim();
    
    const summary = firstFewSentences 
      ? `${firstFewSentences}${firstFewSentences.endsWith('.') ? '' : '.'}`
      : `This content has been processed successfully.`;
    
    // Extract basic tags from content
    const commonWords = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const wordFreq = {};
    commonWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    const tags = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
    
    return {
      summary,
      tags: tags.length > 0 ? tags : ['general', 'content', 'learning'],
      entities: [],
      topics: tags
    };
  }

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `
You are assisting in a private, persistent AI session. Analyze the provided content comprehensively.

Return a JSON object with this exact structure:
{
  "summary": "<3-4 sentence summary>",
  "tags": ["keyword1", "keyword2", "keyword3", ...],
  "entities": [
    {"name": "Entity Name", "type": "PERSON|ORG|LOCATION|DATE|OTHER"}
  ],
  "topics": ["topic1", "topic2", "topic3", ...]
}

Content:
${content.slice(0, 15000)}
`.trim();

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || 'No summary available',
        tags: parsed.tags || [],
        entities: parsed.entities || [],
        topics: parsed.topics || parsed.tags || []
      };
    }
    
    throw new Error('Invalid JSON response from AI');
  } catch (error) {
    console.error('AI analysis error:', error);
    // Fallback
    return {
      summary: content.substring(0, 200) + '...',
      tags: ['general', 'content'],
      entities: [],
      topics: ['general']
    };
  }
}

// Middleware to verify Firebase token
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  console.log(`[Graph API] ${req.method} ${req.path} - Token present: ${!!token}`);

  // In development/mock mode, always allow with demo user
  if (!process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID === 'mock') {
    req.userId = 'demo_user';
    console.log(`[Graph API] Using demo user in mock mode`);
    return next();
  }

  try {
    if (!token) {
      console.warn('[Graph API] No token provided, using demo user');
      req.userId = 'demo_user';
      return next();
    }

    const decoded = await verifyFirebaseToken(token);
    req.userId = decoded.uid;
    console.log(`[Graph API] Authenticated user: ${req.userId}`);
    next();
  } catch (error) {
    console.error(`[Graph API] Authentication failed:`, error.message);
    // Fallback to demo user on any auth error
    req.userId = 'demo_user';
    console.log(`[Graph API] Auth failed, using demo user`);
    next();
  }
}

// Get subgraph for a specific node
router.get('/subgraph', authenticate, async (req, res) => {
  try {
    const { node_id, depth = 2 } = req.query;
    
    if (!node_id) {
      return res.status(400).json({ error: 'node_id is required' });
    }
    
    const subgraph = await graphService.getSubgraph(node_id, parseInt(depth), req.userId);
    res.json(subgraph);
  } catch (error) {
    console.error('Error fetching subgraph:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get full graph for a user
router.get('/full', authenticate, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const graph = await graphService.getUserGraph(req.userId, parseInt(limit));
    res.json(graph);
  } catch (error) {
    console.error('Error fetching full graph:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search nodes in the graph
router.get('/search', authenticate, async (req, res) => {
  try {
    const { query, type } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }
    
    const results = await graphService.searchNodes(query, req.userId, type);
    res.json(results);
  } catch (error) {
    console.error('Error searching nodes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new memory node (supports both file upload and JSON)
router.post('/memory', authenticate, upload.single('file'), async (req, res) => {
  try {
    console.log(`[Graph API] POST /memory for user: ${req.userId}`);
    
    let text = '';
    let summary = '';
    let tags = [];
    let entities = [];
    let source_file_id = null;

    // Check if file was uploaded
    if (req.file) {
      console.log('[Graph API] Processing file upload...');
      const fileText = await extractTextFromFile(req.file);
      const inputText = sanitizeContent(req.body.textInput || '');
      const combined = sanitizeContent([fileText, inputText].filter(Boolean).join(' '));
      
      if (!combined || combined.trim().length === 0) {
        return res.status(400).json({ error: 'No file or text content provided.' });
      }

      const trimmed = combined.length > 15000 ? combined.slice(0, 15000) : combined;
      text = trimmed;
      
      // Generate AI analysis
      console.log('[Graph API] Generating AI analysis...');
      const analysis = await generateEnhancedAnalysis(trimmed);
      summary = analysis.summary;
      tags = analysis.tags || analysis.topics || [];
      entities = analysis.entities || [];
      source_file_id = `file_${Date.now()}_${req.file.originalname}`;
    } else {
      // JSON mode (backward compatible)
      const { 
        text: bodyText, 
        summary: bodySummary, 
        tags: bodyTags = [], 
        entities: bodyEntities = [], 
        source_file_id: bodyFileId 
      } = req.body;
      
      if (!bodyText || !bodySummary) {
        return res.status(400).json({ error: 'text and summary are required (or upload a file)' });
      }
      
      text = bodyText;
      summary = bodySummary;
      tags = bodyTags;
      entities = bodyEntities;
      source_file_id = bodyFileId;
    }
    
    // Create memory node (stores in MongoDB, Neo4j, Pinecone)
    console.log(`[Graph API] Creating memory node for user: ${req.userId}`);
    console.log(`[Graph API] Summary: ${summary.substring(0, 100)}...`);
    console.log(`[Graph API] Tags: ${tags.join(', ')}`);
    console.log(`[Graph API] Entities: ${entities.map(e => e.name || e).join(', ')}`);
    
    let memory;
    try {
      memory = await graphService.createMemoryNode({
        text,
        summary,
        tags,
        entities,
        user_id: req.userId,
        source_file_id: source_file_id || 'direct_input'
      });
      console.log(`[Graph API] ✅ Memory created successfully: ${memory.id}`);
    } catch (graphError) {
      console.error('[Graph API] ❌ Graph service error:', graphError.message);
      console.error('[Graph API] Storing directly in MongoDB as fallback');
      // Fallback: Store directly in MongoDB if Neo4j/Pinecone fail
      const db = getDB();
      
      const chunkId = `chunk_${uuidv4()}`;
      const timestamp = new Date().toISOString();
      
      const chunkDoc = {
        chunk_id: chunkId,
        file_id: source_file_id || 'direct_input',
        user_id: req.userId,
        chunk_text: text,
        summary,
        tags,
        entities,
        created_at: timestamp
      };
      
      await db.collection('chunks').insertOne(chunkDoc);
      
      memory = {
        id: chunkId,
        summary,
        tags,
        created_at: timestamp
      };
      console.log(`[Graph API] Chunk stored directly in MongoDB: ${chunkId}`);
    }
    
    res.json({
      success: true,
      message: 'Memory node created and saved to knowledge graph',
      memory
    });
  } catch (error) {
    console.error('[Graph API] Error creating memory:', error.message);
    console.error('[Graph API] Stack:', error.stack);
    
    if (error.message.includes('Unsupported file type') || error.message.includes('Failed to extract')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: error.message || 'Failed to create memory node' });
  }
});

// Create semantic similarity edges
router.post('/edges/similarity', authenticate, async (req, res) => {
  try {
    const { memory_id } = req.body;
    
    if (!memory_id) {
      return res.status(400).json({ error: 'memory_id is required' });
    }
    
    const edges = await graphService.createSimilarityEdges(memory_id, req.userId);
    res.json({ created: edges.length, edges });
  } catch (error) {
    console.error('Error creating similarity edges:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize graph with mock data
router.post('/mock/initialize', authenticate, async (req, res) => {
  try {
    const { count = 5, clearExisting = true } = req.body;
    
    const result = await mockDataService.initializeMockData(req.userId, count, clearExisting);
    res.json(result);
  } catch (error) {
    console.error('Error initializing mock data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear all data for a user
router.delete('/clear', authenticate, async (req, res) => {
  try {
    const result = await graphService.clearUserData(req.userId);
    res.json(result);
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get graph statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await graphService.getGraphStats(req.userId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
