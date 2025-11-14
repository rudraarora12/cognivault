import { getDB } from '../config/mongodb.js';
import { getDriver } from '../config/neo4j.js';
import { getPineconeIndex } from '../config/pinecone.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// Get comprehensive dashboard overview
export async function getDashboardOverview(userId, userEmail, userName) {
  console.log(`[Dashboard] Fetching overview for user: ${userId}`);
  
  try {
    const db = getDB();
    
    if (!db) {
      console.warn('[Dashboard] MongoDB not connected');
      return getEmptyDashboard(userId, userEmail, userName);
    }
    
    // Fetch all data in parallel
    const [
      sourceFiles,
      chunks,
      graphStats,
      timelineEvents,
      topicSpikes,
      emotionTrend,
      branchTriggers
    ] = await Promise.all([
      getSourceFiles(userId),
      getChunks(userId),
      getGraphStats(userId),
      getTimelineEvents(userId),
      getTopicSpikes(userId),
      getEmotionTrend(userId),
      getBranchTriggers(userId)
    ]);
    
    // Compute metrics
    const totalUploads = sourceFiles.length;
    const recentUploads = sourceFiles
      .sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date))
      .slice(0, 5)
      .map(file => ({
        file_id: file.file_id,
        file_name: file.file_name,
        upload_date: file.upload_date,
        document_type: file.document_analysis?.document_type || 'general',
        main_topic: file.document_analysis?.main_topic || 'Unknown',
        total_chunks: file.total_chunks || 0,
        tags: extractTagsFromFile(file, chunks)
      }));
    
    // Topic stats
    const allTags = new Set();
    chunks.forEach(chunk => {
      if (chunk.tags && Array.isArray(chunk.tags)) {
        chunk.tags.forEach(tag => allTags.add(tag.toLowerCase().trim()));
      }
    });
    
    const topicCounts = {};
    chunks.forEach(chunk => {
      if (chunk.tags && Array.isArray(chunk.tags)) {
        chunk.tags.forEach(tag => {
          const normalized = tag.toLowerCase().trim();
          topicCounts[normalized] = (topicCounts[normalized] || 0) + 1;
        });
      }
    });
    
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));
    
    // Emotional trend (last 5)
    const emotionalTrendLast5 = emotionTrend
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    
    // Last uploaded file
    const lastUploadedFile = sourceFiles.length > 0
      ? sourceFiles.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date))[0]
      : null;
    
    // Knowledge graph preview
    const knowledgeGraphPreview = {
      totalNodes: graphStats.totalNodes || 0,
      totalEdges: graphStats.totalEdges || 0,
      topConcepts: graphStats.topConcepts || [],
      recentNodes: graphStats.recentNodes || []
    };
    
    // Timeline preview (last 5 events)
    const timelinePreview = timelineEvents
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);
    
    // Recent branch triggers
    const recentBranchTriggers = branchTriggers
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
    
    // Generate AI insights
    const aiInsights = await generateAIInsights(
      totalUploads,
      topTopics,
      emotionalTrendLast5,
      recentBranchTriggers,
      knowledgeGraphPreview
    );
    
    // Suggested next topics (based on top topics and recent branches)
    const suggestedNextTopics = generateSuggestedTopics(topTopics, recentBranchTriggers);
    
    return {
      userName: userName || userEmail?.split('@')[0] || 'User',
      userEmail: userEmail || '',
      totalUploads,
      totalTagsDetected: allTags.size,
      recentUploads,
      topicStats: {
        topTopics,
        totalUniqueTopics: allTags.size,
        mostRecentTopic: topTopics[0]?.topic || 'None'
      },
      emotionalTrend: emotionalTrendLast5,
      lastUploadedFile: lastUploadedFile ? {
        file_name: lastUploadedFile.file_name,
        upload_date: lastUploadedFile.upload_date,
        document_type: lastUploadedFile.document_analysis?.document_type || 'general'
      } : null,
      knowledgeGraphStats: knowledgeGraphPreview,
      timelinePreview,
      branchTriggers: recentBranchTriggers,
      suggestedNextTopics,
      aiInsights
    };
  } catch (error) {
    console.error('[Dashboard] Error fetching overview:', error.message);
    console.error('[Dashboard] Stack:', error.stack);
    return getEmptyDashboard(userId, userEmail, userName);
  }
}

// Helper: Get source files
async function getSourceFiles(userId) {
  const db = getDB();
  return await db.collection('source_files')
    .find({ user_id: userId })
    .sort({ upload_date: -1 })
    .toArray();
}

// Helper: Get chunks
async function getChunks(userId) {
  const db = getDB();
  return await db.collection('chunks')
    .find({ user_id: userId })
    .toArray();
}

// Helper: Get graph stats from Neo4j
async function getGraphStats(userId) {
  try {
    const driver = getDriver();
    if (!driver) {
      return { totalNodes: 0, totalEdges: 0, topConcepts: [], recentNodes: [] };
    }
    
    const session = driver.session();
    
    try {
      // Get total node counts
      const nodeCountResult = await session.run(
        `MATCH (n)
         WHERE n.user_id = $userId
         RETURN count(n) as totalNodes`,
        { userId }
      );
      const totalNodes = nodeCountResult.records[0]?.get('totalNodes').toNumber() || 0;
      
      // Get total edge counts
      const edgeCountResult = await session.run(
        `MATCH (m1:Memory)-[r]-(m2)
         WHERE m1.user_id = $userId
         RETURN count(DISTINCT r) as totalEdges`,
        { userId }
      );
      const totalEdges = edgeCountResult.records[0]?.get('totalEdges').toNumber() || 0;
      
      // Get top concepts
      const conceptResult = await session.run(
        `MATCH (m:Memory)-[:TAGGED_WITH]->(c:Concept)
         WHERE m.user_id = $userId
         WITH c, count(*) as frequency
         RETURN c.name as name, frequency
         ORDER BY frequency DESC
         LIMIT 10`,
        { userId }
      );
      
      const topConcepts = conceptResult.records.map(record => ({
        name: record.get('name'),
        frequency: record.get('frequency').toNumber()
      }));
      
      // Get recent nodes
      const recentNodesResult = await session.run(
        `MATCH (m:Memory)
         WHERE m.user_id = $userId
         RETURN m.id as id, m.summary as summary
         ORDER BY m.created_at DESC
         LIMIT 5`,
        { userId }
      );
      
      const recentNodes = recentNodesResult.records.map(record => ({
        id: record.get('id'),
        summary: record.get('summary')
      }));
      
      await session.close();
      
      return { totalNodes, totalEdges, topConcepts, recentNodes };
    } catch (error) {
      console.warn('[Dashboard] Neo4j query error:', error.message);
      await session.close();
      return { totalNodes: 0, totalEdges: 0, topConcepts: [], recentNodes: [] };
    }
  } catch (error) {
    console.warn('[Dashboard] Neo4j not available:', error.message);
    return { totalNodes: 0, totalEdges: 0, topConcepts: [], recentNodes: [] };
  }
}

// Helper: Get timeline events
async function getTimelineEvents(userId) {
  const db = getDB();
  const chunks = await db.collection('chunks')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(20)
    .toArray();
  
  return chunks.map(chunk => ({
    timestamp: chunk.created_at,
    summary: chunk.summary || '',
    tags: chunk.tags || [],
    chunk_id: chunk.chunk_id
  }));
}

// Helper: Get topic spikes
async function getTopicSpikes(userId) {
  const db = getDB();
  const chunks = await db.collection('chunks')
    .find({ user_id: userId })
    .toArray();
  
  const topicMap = {};
  chunks.forEach(chunk => {
    if (!chunk.created_at || !chunk.tags) return;
    const date = new Date(chunk.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!topicMap[monthKey]) {
      topicMap[monthKey] = {};
    }
    
    chunk.tags.forEach(tag => {
      const normalized = tag.toLowerCase().trim();
      topicMap[monthKey][normalized] = (topicMap[monthKey][normalized] || 0) + 1;
    });
  });
  
  return topicMap;
}

// Helper: Get emotion trend
async function getEmotionTrend(userId) {
  const db = getDB();
  const sourceFiles = await db.collection('source_files')
    .find({ 
      user_id: userId,
      'document_analysis.sentiment': { $exists: true }
    })
    .sort({ upload_date: -1 })
    .toArray();
  
  return sourceFiles.map(file => {
    const sentiment = file.document_analysis?.sentiment || 'neutral';
    let sentimentLabel = 'neutral';
    let score = 0.5;
    
    if (typeof sentiment === 'string') {
      const lower = sentiment.toLowerCase();
      if (lower.includes('positive') || lower.includes('analytical') || lower.includes('informative')) {
        sentimentLabel = 'positive';
        score = 0.7;
      } else if (lower.includes('negative')) {
        sentimentLabel = 'negative';
        score = 0.3;
      }
    }
    
    return {
      date: file.upload_date,
      sentiment: sentimentLabel,
      score
    };
  });
}

// Helper: Get branch triggers
async function getBranchTriggers(userId) {
  const db = getDB();
  const chunks = await db.collection('chunks')
    .find({ user_id: userId })
    .sort({ created_at: 1 })
    .toArray();
  
  if (chunks.length < 2) return [];
  
  const branchTriggers = [];
  const seenTags = new Set();
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.tags || chunk.tags.length === 0) continue;
    
    const newTags = chunk.tags
      .map(t => t.toLowerCase().trim())
      .filter(tag => !seenTags.has(tag));
    
    if (newTags.length > 0) {
      branchTriggers.push({
        date: chunk.created_at,
        trigger: newTags[0],
        ledTo: []
      });
    }
    
    chunk.tags.forEach(tag => seenTags.add(tag.toLowerCase().trim()));
  }
  
  return branchTriggers.slice(-5); // Last 5
}

// Helper: Extract tags from file and chunks
function extractTagsFromFile(file, chunks) {
  const fileChunks = chunks.filter(c => c.file_id === file.file_id);
  const tags = new Set();
  fileChunks.forEach(chunk => {
    if (chunk.tags && Array.isArray(chunk.tags)) {
      chunk.tags.forEach(tag => tags.add(tag));
    }
  });
  return Array.from(tags).slice(0, 5);
}

// Helper: Generate AI insights
async function generateAIInsights(totalUploads, topTopics, emotionalTrend, branchTriggers, graphStats) {
  if (!genAI) {
    // Fallback insights
    const topTopic = topTopics[0]?.topic || 'learning';
    const recentMood = emotionalTrend[0]?.sentiment || 'neutral';
    const branchCount = branchTriggers.length;
    
    return `You've uploaded ${totalUploads} documents. Your focus is on ${topTopic}. Recent mood: ${recentMood}. ${branchCount > 0 ? `${branchCount} new knowledge branches detected.` : ''} Keep exploring!`;
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const prompt = `Analyze this user's learning dashboard and provide a brief, encouraging insight (2-3 sentences).

Total Uploads: ${totalUploads}
Top Topics: ${topTopics.slice(0, 5).map(t => t.topic).join(', ')}
Recent Mood: ${emotionalTrend[0]?.sentiment || 'neutral'}
New Branches: ${branchTriggers.length}
Graph Nodes: ${graphStats.totalNodes}

Provide a friendly, personalized insight about their learning journey. Focus on patterns, growth, and encouragement. Return ONLY the insight text, no JSON or formatting.`;
    
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('[Dashboard] Error generating AI insights:', error.message);
    // Fallback
    const topTopic = topTopics[0]?.topic || 'learning';
    return `Your learning journey shows ${totalUploads} uploads with focus on ${topTopic}. Keep exploring new topics!`;
  }
}

// Helper: Generate suggested topics
function generateSuggestedTopics(topTopics, branchTriggers) {
  const suggestions = [];
  
  // Suggest related topics based on top topics
  if (topTopics.length > 0) {
    const topTopic = topTopics[0].topic;
    suggestions.push({
      topic: `Advanced ${topTopic}`,
      reason: 'You\'re already exploring this area'
    });
  }
  
  // Suggest based on recent branches
  if (branchTriggers.length > 0) {
    const recentBranch = branchTriggers[branchTriggers.length - 1];
    suggestions.push({
      topic: `Deep dive into ${recentBranch.trigger}`,
      reason: 'You recently started exploring this'
    });
  }
  
  return suggestions.slice(0, 3);
}

// Helper: Empty dashboard for new users
function getEmptyDashboard(userId, userEmail, userName) {
  return {
    userName: userName || userEmail?.split('@')[0] || 'User',
    userEmail: userEmail || '',
    totalUploads: 0,
    totalTagsDetected: 0,
    recentUploads: [],
    topicStats: {
      topTopics: [],
      totalUniqueTopics: 0,
      mostRecentTopic: 'None'
    },
    emotionalTrend: [],
    lastUploadedFile: null,
    knowledgeGraphStats: {
      totalNodes: 0,
      totalEdges: 0,
      topConcepts: [],
      recentNodes: []
    },
    timelinePreview: [],
    branchTriggers: [],
    suggestedNextTopics: [],
    aiInsights: 'Welcome to CogniVault! Start uploading documents to build your knowledge graph and see your learning journey unfold.'
  };
}

