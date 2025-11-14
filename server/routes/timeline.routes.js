import { Router } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';
import { verifyFirebaseToken } from '../config/firebaseAdmin.js';
import { getDB } from '../config/mongodb.js';
import * as timelineService from '../services/timeline.service.js';
import * as graphService from '../services/graph.service.js';
import geminiService from '../services/gemini.service.js';

const router = Router();

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024, // 12MB cap
  },
});


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
  try {
    const metadata = await geminiService.generateMetadata(content.slice(0, 15000));
    return {
      summary: metadata.summary || 'No summary available',
      tags: metadata.tags || [],
      entities: metadata.entities || [],
      topics: metadata.tags || []
    };
  } catch (error) {
    console.error('AI analysis error:', error);
    // Fallback
    const words = content.split(/\s+/).filter(w => w.length > 3);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const firstFewSentences = sentences.slice(0, 3).join('. ').trim();
    
    const summary = firstFewSentences 
      ? `${firstFewSentences}${firstFewSentences.endsWith('.') ? '' : '.'}`
      : `This content has been processed successfully.`;
    
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
}

// Middleware to verify Firebase token
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  console.log(`[Timeline API] ${req.method} ${req.path} - Token present: ${!!token}`);

  try {
    if (!token) {
      console.warn('[Timeline API] No token provided');
      return res.status(401).json({ error: 'Authorization token missing.' });
    }

    const decoded = await verifyFirebaseToken(token);
    req.userId = decoded.uid;
    console.log(`[Timeline API] Authenticated user: ${req.userId}`);
    next();
  } catch (error) {
    console.error(`[Timeline API] Authentication failed:`, error.message);
    const statusCode = error.code === 'auth/missing-token' ? 401 : 403;
    return res.status(statusCode).json({ error: error.message });
  }
}

// POST /api/timeline/upload - Use Smart Upload pipeline (no duplication)
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    console.log(`[Timeline API] POST /upload for user: ${req.userId} - delegating to Smart Upload`);
    
    // Delegate to Smart Upload service (processUpload from upload.service.js)
    // This ensures all data goes through the same pipeline
    const { processUpload } = await import('../services/upload.service.js');
    
    if (!req.file && !req.body.textInput) {
      return res.status(400).json({ error: 'No file or text content provided.' });
    }
    
    // If text input only, create a temporary file-like object
    let fileToProcess = req.file;
    if (!fileToProcess && req.body.textInput) {
      fileToProcess = {
        buffer: Buffer.from(req.body.textInput, 'utf-8'),
        originalname: 'text_input.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(req.body.textInput, 'utf-8')
      };
    }
    
    if (!fileToProcess) {
      return res.status(400).json({ error: 'No file or text content provided.' });
    }
    
    // Process through Smart Upload pipeline
    const result = await processUpload(fileToProcess, req.userId);
    
    return res.json({
      success: true,
      message: 'Content uploaded and saved to timeline via Smart Upload',
      ...result
    });
  } catch (error) {
    console.error('[Timeline API] Upload error:', error.message);
    console.error('[Timeline API] Stack:', error.stack);
    
    if (error.message.includes('Unsupported file type') || error.message.includes('Failed to extract')) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Failed to upload content to timeline' });
  }
});

// GET /api/timeline/events - Get chronological learning events
router.get('/events', authenticate, async (req, res) => {
  try {
    console.log(`[Timeline API] GET /events for user: ${req.userId}`);
    const events = await timelineService.getTimelineEvents(req.userId);
    console.log(`[Timeline API] Returning ${events.length} events`);
    res.json(events);
  } catch (error) {
    console.error('[Timeline API] Error fetching timeline events:', error.message);
    console.error('[Timeline API] Stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch timeline events' });
  }
});

// GET /api/timeline/topic-spikes - Get topic spikes by month
router.get('/topic-spikes', authenticate, async (req, res) => {
  try {
    console.log(`[Timeline API] GET /topic-spikes for user: ${req.userId}`);
    const spikes = await timelineService.getTopicSpikes(req.userId);
    console.log(`[Timeline API] Returning topic spikes for ${Object.keys(spikes).length} months`);
    res.json(spikes);
  } catch (error) {
    console.error('[Timeline API] Error fetching topic spikes:', error.message);
    res.status(500).json({ error: 'Failed to fetch topic spikes' });
  }
});

// GET /api/timeline/emotion-trend - Get emotion/sentiment trend
router.get('/emotion-trend', authenticate, async (req, res) => {
  try {
    console.log(`[Timeline API] GET /emotion-trend for user: ${req.userId}`);
    const trend = await timelineService.getEmotionTrend(req.userId);
    console.log(`[Timeline API] Returning ${trend.length} emotion data points`);
    res.json(trend);
  } catch (error) {
    console.error('[Timeline API] Error fetching emotion trend:', error.message);
    res.status(500).json({ error: 'Failed to fetch emotion trend' });
  }
});

// GET /api/timeline/knowledge-evolution - Get knowledge evolution graph
router.get('/knowledge-evolution', authenticate, async (req, res) => {
  try {
    console.log(`[Timeline API] GET /knowledge-evolution for user: ${req.userId}`);
    const evolution = await timelineService.getKnowledgeEvolution(req.userId);
    console.log(`[Timeline API] Returning ${evolution.nodes.length} nodes, ${evolution.edges.length} edges`);
    res.json(evolution);
  } catch (error) {
    console.error('[Timeline API] Error fetching knowledge evolution:', error.message);
    res.status(500).json({ error: 'Failed to fetch knowledge evolution' });
  }
});

// GET /api/timeline/branch-triggers - Get branch triggers
router.get('/branch-triggers', authenticate, async (req, res) => {
  try {
    console.log(`[Timeline API] GET /branch-triggers for user: ${req.userId}`);
    const triggers = await timelineService.getBranchTriggers(req.userId);
    console.log(`[Timeline API] Returning ${triggers.length} branch triggers`);
    res.json(triggers);
  } catch (error) {
    console.error('[Timeline API] Error fetching branch triggers:', error.message);
    res.status(500).json({ error: 'Failed to fetch branch triggers' });
  }
});

// GET /api/timeline/insights - Get synthetic AI insights
router.get('/insights', authenticate, async (req, res) => {
  try {
    console.log(`[Timeline API] GET /insights for user: ${req.userId}`);
    const [events, topicSpikes, emotionTrend, knowledgeEvolution] = await Promise.all([
      timelineService.getTimelineEvents(req.userId),
      timelineService.getTopicSpikes(req.userId),
      timelineService.getEmotionTrend(req.userId),
      timelineService.getKnowledgeEvolution(req.userId)
    ]);
    
    console.log(`[Timeline API] Data collected: ${events.length} events, ${Object.keys(topicSpikes).length} months, ${emotionTrend.length} emotions, ${knowledgeEvolution.nodes.length} topics`);
    
    const insights = await timelineService.generateInsights(
      req.userId,
      events,
      topicSpikes,
      emotionTrend,
      knowledgeEvolution
    );
    
    console.log(`[Timeline API] Insights generated: ${insights.substring(0, 50)}...`);
    res.json({ insights });
  } catch (error) {
    console.error('[Timeline API] Error generating insights:', error.message);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

export default router;
