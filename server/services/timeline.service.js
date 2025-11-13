import { getDB } from '../config/mongodb.js';
import { getDriver } from '../config/neo4j.js';
import { getPineconeIndex } from '../config/pinecone.js';
import { generateEmbedding } from './gemini.service.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// Get chronological learning events from source_files and chunks
export async function getTimelineEvents(userId) {
  console.log(`[Timeline] Fetching events for user: ${userId}`);
  
  try {
    const db = getDB();
    
    if (!db) {
      console.warn('[Timeline] MongoDB not connected, returning empty events');
      return [];
    }
    
    // Get all chunks sorted by creation date
    const chunks = await db.collection('chunks')
      .find({ user_id: userId })
      .sort({ created_at: 1 })
      .toArray();
    
    // Get source files for additional metadata
    const sourceFiles = await db.collection('source_files')
      .find({ user_id: userId })
      .toArray();
    
    const fileMap = new Map();
    sourceFiles.forEach(file => {
      fileMap.set(file.file_id, file);
    });
    
    console.log(`[Timeline] Found ${chunks.length} chunks and ${sourceFiles.length} source files for user ${userId}`);
    
    const events = chunks.map(chunk => {
      const sourceFile = fileMap.get(chunk.file_id);
      return {
        file_id: chunk.file_id || 'direct_input',
        user_id: chunk.user_id,
        timestamp: chunk.created_at,
        tags: chunk.tags || [],
        summary: chunk.summary || '',
        text_snippet: chunk.chunk_text ? chunk.chunk_text.split('\n').slice(0, 2).join(' ').substring(0, 200) : '',
        chunk_id: chunk.chunk_id,
        file_name: sourceFile?.file_name || null,
        document_type: sourceFile?.document_analysis?.document_type || null
      };
    });
    
    return events.length > 0 ? events : [];
  } catch (error) {
    console.error('[Timeline] Error fetching timeline events:', error.message);
    console.error('[Timeline] Stack:', error.stack);
    return [];
  }
}

// Get topic spikes grouped by month
export async function getTopicSpikes(userId) {
  console.log(`[Timeline] Fetching topic spikes for user: ${userId}`);
  
  try {
    const db = getDB();
    
    if (!db) {
      console.warn('[Timeline] MongoDB not connected, returning empty topic spikes');
      return {};
    }
    
    const chunks = await db.collection('chunks')
      .find({ user_id: userId })
      .toArray();
    
    console.log(`[Timeline] Processing ${chunks.length} chunks for topic spikes`);
    
    const topicMap = {};
    
    chunks.forEach(chunk => {
      if (!chunk.created_at || !chunk.tags || !Array.isArray(chunk.tags)) return;
      
      const date = new Date(chunk.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!topicMap[monthKey]) {
        topicMap[monthKey] = {};
      }
      
      chunk.tags.forEach(tag => {
        const normalizedTag = tag.toLowerCase().trim();
        topicMap[monthKey][normalizedTag] = (topicMap[monthKey][normalizedTag] || 0) + 1;
      });
    });
    
    console.log(`[Timeline] Topic spikes calculated for ${Object.keys(topicMap).length} months`);
    return topicMap;
  } catch (error) {
    console.error('[Timeline] Error fetching topic spikes:', error.message);
    return {};
  }
}

// Get emotion trend over time using stored sentiment from document_analysis
export async function getEmotionTrend(userId) {
  console.log(`[Timeline] Fetching emotion trend for user: ${userId}`);
  
  try {
    const db = getDB();
    
    if (!db) {
      console.warn('[Timeline] MongoDB not connected, returning empty emotion trend');
      return [];
    }
    
    // Get source files with document_analysis (contains sentiment)
    const sourceFiles = await db.collection('source_files')
      .find({ 
        user_id: userId,
        'document_analysis.sentiment': { $exists: true }
      })
      .sort({ upload_date: 1 })
      .toArray();
    
    console.log(`[Timeline] Found ${sourceFiles.length} source files with sentiment data`);
    
    const emotionData = [];
    
    // Use stored sentiment from document_analysis
    sourceFiles.forEach(file => {
      if (!file.upload_date || !file.document_analysis) return;
      
      const sentiment = file.document_analysis.sentiment || 'neutral';
      
      // Map sentiment to standard format
      let sentimentLabel = 'neutral';
      let sentimentScore = 0.5;
      
      if (typeof sentiment === 'string') {
        const lowerSentiment = sentiment.toLowerCase();
        if (lowerSentiment.includes('positive') || lowerSentiment.includes('analytical') || lowerSentiment.includes('informative')) {
          sentimentLabel = 'positive';
          sentimentScore = 0.7;
        } else if (lowerSentiment.includes('negative')) {
          sentimentLabel = 'negative';
          sentimentScore = 0.3;
        } else {
          sentimentLabel = 'neutral';
          sentimentScore = 0.5;
        }
      }
      
      emotionData.push({
        date: file.upload_date,
        sentiment: sentimentLabel,
        score: sentimentScore
      });
    });
    
    // If no source files with sentiment, try to get from chunks (fallback)
    if (emotionData.length === 0) {
      console.log('[Timeline] No source file sentiment, analyzing chunks as fallback');
      const chunks = await db.collection('chunks')
        .find({ user_id: userId })
        .sort({ created_at: 1 })
        .limit(50) // Limit to avoid too many API calls
        .toArray();
      
      for (const chunk of chunks) {
        if (!chunk.created_at || !chunk.chunk_text) continue;
        
        try {
          const sentiment = await analyzeSentiment(chunk.chunk_text, chunk.summary);
          emotionData.push({
            date: chunk.created_at,
            sentiment: sentiment.label,
            score: sentiment.score
          });
        } catch (error) {
          console.warn(`[Timeline] Error analyzing sentiment for chunk ${chunk.chunk_id}:`, error.message);
          emotionData.push({
            date: chunk.created_at,
            sentiment: 'neutral',
            score: 0.5
          });
        }
      }
    }
    
    console.log(`[Timeline] Generated ${emotionData.length} emotion data points`);
    return emotionData;
  } catch (error) {
    console.error('[Timeline] Error fetching emotion trend:', error.message);
    return [];
  }
}

// Analyze sentiment using LLM or fallback
async function analyzeSentiment(text, summary = '') {
  const content = summary || text.substring(0, 1000);
  
  if (!genAI) {
    // Fallback: simple keyword-based sentiment
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'positive', 'success', 'achievement', 'learn', 'understand', 'insight'];
    const negativeWords = ['bad', 'difficult', 'problem', 'challenge', 'stress', 'confusion', 'error', 'fail', 'hard'];
    
    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;
    
    if (positiveCount > negativeCount) {
      return { label: 'positive', score: Math.min(0.9, 0.5 + positiveCount * 0.1) };
    } else if (negativeCount > positiveCount) {
      return { label: 'negative', score: Math.max(0.1, 0.5 - negativeCount * 0.1) };
    } else {
      return { label: 'neutral', score: 0.5 };
    }
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const prompt = `Analyze the sentiment of this text. Return ONLY a JSON object with this exact structure:
{
  "label": "positive|negative|neutral",
  "score": 0.0-1.0
}

Text: ${content.substring(0, 500)}`;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        label: parsed.label || 'neutral',
        score: parsed.score || 0.5
      };
    }
    
    return { label: 'neutral', score: 0.5 };
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return { label: 'neutral', score: 0.5 };
  }
}

// Get knowledge evolution graph using Neo4j relationships
export async function getKnowledgeEvolution(userId) {
  console.log(`[Timeline] Fetching knowledge evolution for user: ${userId}`);
  
  try {
    const db = getDB();
    const driver = getDriver();
    
    if (!db) {
      console.warn('[Timeline] MongoDB not connected, returning empty knowledge evolution');
      return { nodes: [], edges: [], newBranches: [] };
    }
    
    // Try to get data from Neo4j first (more accurate relationships)
    let nodes = [];
    let edges = [];
    let newBranches = [];
    
    if (driver) {
      try {
        const session = driver.session();
        
        // Get Concept nodes (topics) from Neo4j
        // Note: Concepts are shared but we filter by user's memories
        const conceptResult = await session.run(
          `MATCH (m:Memory)-[:TAGGED_WITH]->(c:Concept)
           WHERE m.user_id = $userId
           RETURN DISTINCT c.name as name, c.id as id
           ORDER BY c.name`,
          { userId }
        );
        
        const conceptMap = new Map();
        conceptResult.records.forEach((record, index) => {
          const name = record.get('name');
          const id = record.get('id') || `concept_${index}`;
          conceptMap.set(name.toLowerCase(), { id, name, index });
        });
        
        // Create nodes from concepts
        nodes = Array.from(conceptMap.values()).map((concept, idx) => ({
          id: concept.id || `topic_${idx}`,
          label: concept.name,
          type: 'topic',
          count: 1 // Will be updated from MongoDB if needed
        }));
        
        // Get relationships between concepts through memories
        const relationshipResult = await session.run(
          `MATCH (m1:Memory)-[:TAGGED_WITH]->(c1:Concept),
                 (m2:Memory)-[:TAGGED_WITH]->(c2:Concept)
           WHERE m1.user_id = $userId AND m2.user_id = $userId
             AND m1.id <> m2.id
             AND c1.name <> c2.name
           WITH c1, c2, count(*) as cooccurrence
           WHERE cooccurrence > 0
           RETURN c1.name as source, c2.name as target, cooccurrence
           ORDER BY cooccurrence DESC
           LIMIT 50`,
          { userId }
        );
        
        const edgeMap = new Map();
        relationshipResult.records.forEach(record => {
          const source = record.get('source');
          const target = record.get('target');
          const weight = record.get('cooccurrence').toNumber();
          const edgeKey = `${source.toLowerCase()}_${target.toLowerCase()}`;
          
          if (!edgeMap.has(edgeKey)) {
            const sourceConcept = conceptMap.get(source.toLowerCase());
            const targetConcept = conceptMap.get(target.toLowerCase());
            
            if (sourceConcept && targetConcept) {
              edges.push({
                id: `edge_${sourceConcept.id}_${targetConcept.id}`,
                source: sourceConcept.id,
                target: targetConcept.id,
                weight: weight,
                type: 'related'
              });
              edgeMap.set(edgeKey, true);
            }
          }
        });
        
        await session.close();
        console.log(`[Timeline] Neo4j: ${nodes.length} concepts, ${edges.length} relationships`);
      } catch (neo4jError) {
        console.warn('[Timeline] Neo4j query failed, falling back to MongoDB:', neo4jError.message);
      }
    }
    
    // Fallback to MongoDB if Neo4j data is insufficient
    if (nodes.length === 0) {
      console.log('[Timeline] Using MongoDB fallback for knowledge evolution');
      const chunks = await db.collection('chunks')
        .find({ user_id: userId })
        .sort({ created_at: 1 })
        .toArray();
      
      if (chunks.length === 0) {
        return { nodes: [], edges: [], newBranches: [] };
      }
      
      // Extract unique topics from tags
      const topicSet = new Set();
      const topicToChunks = new Map();
      
      chunks.forEach(chunk => {
        if (chunk.tags && Array.isArray(chunk.tags)) {
          chunk.tags.forEach(tag => {
            const normalizedTag = tag.toLowerCase().trim();
            topicSet.add(normalizedTag);
            
            if (!topicToChunks.has(normalizedTag)) {
              topicToChunks.set(normalizedTag, []);
            }
            topicToChunks.get(normalizedTag).push(chunk);
          });
        }
      });
      
      // Create nodes for topics
      nodes = Array.from(topicSet).map((topic, index) => ({
        id: `topic_${index}`,
        label: topic,
        type: 'topic',
        count: topicToChunks.get(topic).length,
        firstSeen: topicToChunks.get(topic)[0].created_at
      }));
      
      // Create edges based on co-occurrence
      const topicArray = Array.from(topicSet);
      
      for (let i = 0; i < topicArray.length; i++) {
        for (let j = i + 1; j < topicArray.length; j++) {
          const topic1 = topicArray[i];
          const topic2 = topicArray[j];
          
          const chunks1 = topicToChunks.get(topic1);
          const chunks2 = topicToChunks.get(topic2);
          const coOccurrence = chunks1.filter(c => 
            chunks2.some(c2 => c.chunk_id === c2.chunk_id)
          ).length;
          
          if (coOccurrence > 0) {
            edges.push({
              id: `edge_${i}_${j}`,
              source: `topic_${i}`,
              target: `topic_${j}`,
              weight: coOccurrence,
              type: 'related'
            });
          }
        }
      }
    }
    
    // Detect new branches from chunks
    const chunks = await db.collection('chunks')
      .find({ user_id: userId })
      .sort({ created_at: 1 })
      .toArray();
    
    const topicFirstSeen = new Map();
    chunks.forEach(chunk => {
      if (chunk.tags && Array.isArray(chunk.tags)) {
        chunk.tags.forEach(tag => {
          const normalizedTag = tag.toLowerCase().trim();
          if (!topicFirstSeen.has(normalizedTag)) {
            topicFirstSeen.set(normalizedTag, chunk.created_at);
          }
        });
      }
    });
    
    const sortedTopics = Array.from(topicFirstSeen.entries())
      .sort((a, b) => new Date(a[1]) - new Date(b[1]));
    
    if (sortedTopics.length > 3) {
      const earlyThreshold = sortedTopics[Math.floor(sortedTopics.length * 0.3)][1];
      
      sortedTopics.forEach(([topic, firstSeen]) => {
        if (new Date(firstSeen) > new Date(earlyThreshold)) {
          const relatedTopics = chunks
            .filter(c => c.tags && c.tags.map(t => t.toLowerCase().trim()).includes(topic))
            .flatMap(c => c.tags || [])
            .filter(t => t.toLowerCase().trim() !== topic)
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 3);
          
          newBranches.push({
            topic,
            date: firstSeen,
            relatedTopics
          });
        }
      });
    }
    
    console.log(`[Timeline] Knowledge evolution: ${nodes.length} nodes, ${edges.length} edges, ${newBranches.length} new branches`);
    return { nodes, edges, newBranches };
  } catch (error) {
    console.error('[Timeline] Error fetching knowledge evolution:', error.message);
    console.error('[Timeline] Stack:', error.stack);
    return { nodes: [], edges: [], newBranches: [] };
  }
}

// Get branch triggers (when new knowledge branches appeared)
export async function getBranchTriggers(userId) {
  console.log(`[Timeline] Fetching branch triggers for user: ${userId}`);
  
  try {
    const db = getDB();
    
    if (!db) {
      console.warn('[Timeline] MongoDB not connected, returning empty branch triggers');
      return [];
    }
    
    let index;
    try {
      index = getPineconeIndex();
      console.log('[Timeline] Pinecone index available for similarity search');
    } catch (error) {
      console.warn('[Timeline] Pinecone not available, using mock embeddings');
    }
    
    const chunks = await db.collection('chunks')
      .find({ user_id: userId })
      .sort({ created_at: 1 })
      .toArray();
    
    console.log(`[Timeline] Processing ${chunks.length} chunks for branch triggers`);
    
    if (chunks.length < 2) {
      console.log('[Timeline] Not enough chunks for branch detection (need at least 2)');
      return [];
    }
    
    const branchTriggers = [];
    const processedChunks = [];
    
    // Track all seen tags for novelty detection
    const allSeenTags = new Set();
    
    for (let i = 0; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      
      if (!currentChunk.chunk_text || !currentChunk.tags || currentChunk.tags.length === 0) continue;
      
      try {
        let maxSimilarity = 0;
        const currentTags = currentChunk.tags.map(t => t.toLowerCase().trim());
        
        // Check tag novelty first (faster than embedding comparison)
        const newTags = currentTags.filter(tag => !allSeenTags.has(tag));
        
        // Use Pinecone for similarity search if available
        if (index && currentChunk.pinecone_vector_id) {
          try {
            // Fetch the vector from Pinecone
            const fetchResult = await index.fetch([currentChunk.pinecone_vector_id]);
            const currentVector = fetchResult.vectors[currentChunk.pinecone_vector_id]?.values;
            
            if (currentVector) {
              // Query Pinecone for similar chunks (only previous ones)
              const previousVectorIds = processedChunks
                .filter(pc => pc.pinecone_vector_id)
                .map(pc => pc.pinecone_vector_id);
              
              if (previousVectorIds.length > 0) {
                // Query for similar vectors
                const queryResult = await index.query({
                  vector: currentVector,
                  topK: Math.min(10, previousVectorIds.length),
                  filter: { 
                    user_id: userId,
                    chunk_id: { $in: previousVectorIds }
                  }
                });
                
                // Find max similarity from previous chunks
                for (const match of queryResult.matches || []) {
                  if (match.score) {
                    maxSimilarity = Math.max(maxSimilarity, match.score);
                  }
                }
              }
            }
          } catch (pineconeError) {
            console.warn(`[Timeline] Pinecone query failed:`, pineconeError.message);
            // Fallback: use tag-based similarity
            maxSimilarity = 0.5; // Default to medium similarity if Pinecone fails
          }
        } else {
          // Fallback: tag-based similarity
          const previousTags = new Set();
          processedChunks.forEach(pc => {
            if (pc.tags) {
              pc.tags.forEach(t => previousTags.add(t.toLowerCase().trim()));
            }
          });
          
          const commonTags = currentTags.filter(t => previousTags.has(t));
          maxSimilarity = commonTags.length > 0 ? 0.6 : 0.2; // Higher if tags overlap
        }
        
        // Check if this is a new branch (low similarity + new tags)
        // Threshold: similarity < 0.4 OR (similarity < 0.6 AND new tags present)
        const isNewBranch = (maxSimilarity < 0.4) || (maxSimilarity < 0.6 && newTags.length > 0);
        
        if (isNewBranch && newTags.length > 0) {
          // Find what this branch led to (future chunks with similar tags)
          const futureChunks = chunks.slice(i + 1).filter(c => 
            c.tags && c.tags.some(t => newTags.includes(t.toLowerCase().trim()))
          );
          
          const ledTo = futureChunks
            .flatMap(c => c.tags || [])
            .map(t => t.toLowerCase().trim())
            .filter(tag => !newTags.includes(tag) && !currentTags.includes(tag))
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 5);
          
          branchTriggers.push({
            date: currentChunk.created_at,
            trigger: newTags[0],
            ledTo: ledTo.slice(0, 3)
          });
          
          console.log(`[Timeline] Branch trigger detected: ${newTags[0]} at ${currentChunk.created_at}`);
        }
        
        // Update seen tags
        currentTags.forEach(tag => allSeenTags.add(tag));
        
        processedChunks.push({
          ...currentChunk,
          tags: currentTags
        });
      } catch (chunkError) {
        console.warn(`[Timeline] Error processing chunk ${currentChunk.chunk_id}:`, chunkError.message);
        continue;
      }
    }
    
    console.log(`[Timeline] Found ${branchTriggers.length} branch triggers`);
    return branchTriggers;
  } catch (error) {
    console.error('[Timeline] Error fetching branch triggers:', error.message);
    console.error('[Timeline] Stack:', error.stack);
    return [];
  }
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Generate synthetic insights using LLM
export async function generateInsights(userId, events, topicSpikes, emotionTrend, knowledgeEvolution) {
  console.log(`[Timeline] Generating insights for user: ${userId}`);
  
  if (!genAI) {
    console.log('[Timeline] Gemini not available, using fallback insights');
    // Fallback insights
    const totalEvents = events.length;
    const allTopics = Object.values(topicSpikes).reduce((acc, month) => {
      Object.entries(month).forEach(([topic, count]) => {
        acc[topic] = (acc[topic] || 0) + count;
      });
      return acc;
    }, {});
    
    const topTopics = Object.entries(allTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);
    
    const insight = totalEvents > 0 
      ? `You've created ${totalEvents} learning events. ${topTopics.length > 0 ? `Your top topics are: ${topTopics.join(', ')}. ` : ''}Keep exploring!`
      : 'Start uploading content to see your learning journey unfold!';
    
    return insight;
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    
    const prompt = `Analyze this user's learning timeline data and provide 2-3 insightful observations about their learning evolution. Be concise and encouraging.

Events: ${events.length} total learning events
Topic Spikes: ${JSON.stringify(topicSpikes).substring(0, 500)}
Emotion Trend: ${emotionTrend.length} sentiment data points
Knowledge Evolution: ${knowledgeEvolution.nodes.length} topics, ${knowledgeEvolution.newBranches.length} new branches

Provide insights in a friendly, encouraging tone. Focus on:
- Learning patterns
- Topic evolution
- Emotional journey
- Knowledge growth

Return ONLY the insights text, no JSON or formatting.`;
    
    const result = await model.generateContent(prompt);
    const insights = result.response.text().trim();
    console.log('[Timeline] AI insights generated successfully');
    return insights;
  } catch (error) {
    console.error('[Timeline] Error generating insights:', error.message);
    // Fallback
    const totalEvents = events.length;
    return totalEvents > 0 
      ? 'Your learning journey shows continuous growth. Keep exploring new topics!'
      : 'Start uploading content to see your learning journey unfold!';
  }
}

