import { Router } from 'express';
import * as graphService from '../services/graph.service.js';
import * as mockDataService from '../services/mockData.service.js';

const router = Router();

// Get subgraph for a specific node
router.get('/subgraph', async (req, res) => {
  try {
    const { node_id, depth = 2, user_id = 'demo_user' } = req.query;
    
    if (!node_id) {
      return res.status(400).json({ error: 'node_id is required' });
    }
    
    const subgraph = await graphService.getSubgraph(node_id, parseInt(depth), user_id);
    res.json(subgraph);
  } catch (error) {
    console.error('Error fetching subgraph:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get full graph for a user
router.get('/full', async (req, res) => {
  try {
    const { user_id = 'demo_user', limit = 100 } = req.query;
    
    const graph = await graphService.getUserGraph(user_id, parseInt(limit));
    res.json(graph);
  } catch (error) {
    console.error('Error fetching full graph:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search nodes in the graph
router.get('/search', async (req, res) => {
  try {
    const { query, user_id = 'demo_user', type } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }
    
    const results = await graphService.searchNodes(query, user_id, type);
    res.json(results);
  } catch (error) {
    console.error('Error searching nodes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new memory node
router.post('/memory', async (req, res) => {
  try {
    const { 
      text, 
      summary, 
      tags = [], 
      entities = [], 
      user_id = 'demo_user',
      source_file_id 
    } = req.body;
    
    if (!text || !summary) {
      return res.status(400).json({ error: 'text and summary are required' });
    }
    
    const memory = await graphService.createMemoryNode({
      text,
      summary,
      tags,
      entities,
      user_id,
      source_file_id
    });
    
    res.json(memory);
  } catch (error) {
    console.error('Error creating memory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create semantic similarity edges
router.post('/edges/similarity', async (req, res) => {
  try {
    const { memory_id, user_id = 'demo_user' } = req.body;
    
    if (!memory_id) {
      return res.status(400).json({ error: 'memory_id is required' });
    }
    
    const edges = await graphService.createSimilarityEdges(memory_id, user_id);
    res.json({ created: edges.length, edges });
  } catch (error) {
    console.error('Error creating similarity edges:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize graph with mock data
router.post('/mock/initialize', async (req, res) => {
  try {
    const { user_id = 'demo_user', count = 5, clearExisting = true } = req.body;
    
    const result = await mockDataService.initializeMockData(user_id, count, clearExisting);
    res.json(result);
  } catch (error) {
    console.error('Error initializing mock data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear all data for a user
router.delete('/clear', async (req, res) => {
  try {
    const { user_id = 'demo_user' } = req.query;
    
    const result = await graphService.clearUserData(user_id);
    res.json(result);
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get graph statistics
router.get('/stats', async (req, res) => {
  try {
    const { user_id = 'demo_user' } = req.query;
    
    const stats = await graphService.getGraphStats(user_id);
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
