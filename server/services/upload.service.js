import { v4 as uuidv4 } from 'uuid';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import { getDB } from '../config/mongodb.js';
import { getPineconeIndex } from '../config/pinecone.js';
import { getDriver } from '../config/neo4j.js';
import { 
  generateMetadata, 
  extractTextFromImage, 
  generateEmbedding,
  analyzeDocument 
} from './gemini.service.js';

// Supported file types
const SUPPORTED_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/bmp': 'image'
};

// Text extraction based on file type
export async function extractText(fileBuffer, mimeType, fileName) {
  const fileType = SUPPORTED_TYPES[mimeType];
  
  if (!fileType) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  let extractedText = '';
  
  switch (fileType) {
    case 'pdf':
      try {
        const pdfData = await pdf(fileBuffer);
        extractedText = pdfData.text;
      } catch (error) {
        console.error('PDF extraction error:', error);
        throw new Error('Failed to extract text from PDF');
      }
      break;
      
    case 'docx':
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value;
      } catch (error) {
        console.error('DOCX extraction error:', error);
        throw new Error('Failed to extract text from DOCX');
      }
      break;
      
    case 'doc':
      // For older .doc files, we'll try mammoth first
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value;
      } catch (error) {
        console.error('DOC extraction error, falling back to Gemini:', error);
        // Fall back to Gemini Vision for complex DOC files
        extractedText = await extractTextFromImage(fileBuffer, mimeType) || '';
      }
      break;
      
    case 'txt':
    case 'md':
      extractedText = fileBuffer.toString('utf-8');
      break;
      
    case 'image':
      extractedText = await extractTextFromImage(fileBuffer, mimeType) || '';
      if (!extractedText) {
        throw new Error('No text found in image');
      }
      break;
      
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
  
  return cleanText(extractedText);
}

// Clean and normalize extracted text
function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/\r\n/g, '\n')           // Normalize line breaks
    .replace(/[\t ]+/g, ' ')          // Collapse multiple spaces/tabs
    .replace(/\n{3,}/g, '\n\n')       // Collapse multiple blank lines
    .replace(/[^\S\r\n]+$/gm, '')     // Remove trailing whitespace
    .replace(/^\s+|\s+$/g, '')        // Trim start and end
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .trim();
}

// Create chunks from text with overlap
export function createChunks(text, chunkSize = 600, overlapSize = 120) {
  if (!text || text.length === 0) return [];
  
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentChunk = '';
  let overlapBuffer = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    if ((currentChunk + ' ' + trimmedSentence).length > chunkSize) {
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunks.length
        });
        
        // Keep last portion for overlap
        const words = currentChunk.split(' ');
        const overlapWords = Math.floor(overlapSize / 5); // Approximate words for overlap
        overlapBuffer = words.slice(-overlapWords).join(' ');
        currentChunk = overlapBuffer + ' ' + trimmedSentence;
      } else {
        // Single sentence exceeds chunk size
        currentChunk = trimmedSentence;
      }
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + trimmedSentence : trimmedSentence;
    }
  }
  
  // Add the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunks.length
    });
  }
  
  return chunks;
}

// Process a single chunk
async function processChunk(chunk, fileId, userId, fileName, chunkIndex, totalChunks) {
  const chunkId = `chunk_${uuidv4()}`;
  
  // Generate metadata using Gemini with fallback
  let metadata;
  try {
    metadata = await generateMetadata(chunk.text);
  } catch (metaError) {
    console.warn(`Metadata generation failed for chunk ${chunkIndex}, using fallback:`, metaError.message);
    metadata = {
      summary: chunk.text.substring(0, 150) + '...',
      tags: ['document', 'uploaded'],
      entities: [],
      relations: []
    };
  }
  
  // Ensure metadata has all required fields
  metadata = {
    summary: metadata?.summary || chunk.text.substring(0, 150) + '...',
    tags: metadata?.tags || ['document'],
    entities: metadata?.entities || [],
    relations: metadata?.relations || []
  };
  
  // Generate embedding
  const embedding = await generateEmbedding(chunk.text);
  
  // Store in Pinecone
  const pineconeIndex = getPineconeIndex();
  const vectorId = `vec_${chunkId}`;
  
  if (pineconeIndex) {
    try {
      await pineconeIndex.upsert([{
        id: vectorId,
        values: embedding,
        metadata: {
          chunk_id: chunkId,
          file_id: fileId,
          user_id: userId,
          file_name: fileName,
          chunk_index: chunkIndex,
          summary: metadata.summary,
          timestamp: new Date().toISOString()
        }
      }]);
    } catch (pineconeError) {
      console.warn(`Pinecone storage failed for chunk ${chunkIndex}:`, pineconeError.message);
    }
  }
  
  // Store in MongoDB
  const db = getDB();
  const chunkDoc = {
    chunk_id: chunkId,
    file_id: fileId,
    user_id: userId,
    chunk_text: chunk.text,
    chunk_index: chunkIndex,
    total_chunks: totalChunks,
    summary: metadata.summary,
    tags: metadata.tags,
    entities: metadata.entities,
    relations: metadata.relations,
    pinecone_vector_id: vectorId,
    neo4j_node_id: null, // Will be updated after Neo4j creation
    char_count: chunk.text.length,
    created_at: new Date()
  };
  
  await db.collection('chunks').insertOne(chunkDoc);
  
  return {
    chunkId,
    metadata,
    vectorId
  };
}

// Create graph nodes and relationships in Neo4j
async function createGraphNodes(processedChunks, fileId, fileName, userId, documentAnalysis) {
  const driver = getDriver();
  const session = driver.session();
  
  console.log(`[Upload Service] Creating Neo4j nodes for user: ${userId}, file: ${fileName}`);
  
  try {
    // Create Source node for the file
    const sourceNodeId = `source_${fileId}`;
    console.log(`[Upload Service] Creating Source node: ${sourceNodeId}`);
    await session.run(
      `MERGE (s:Source {id: $id})
       ON CREATE SET s.filename = $filename,
                     s.file_id = $fileId,
                     s.user_id = $userId,
                     s.document_type = $documentType,
                     s.main_topic = $mainTopic,
                     s.created_at = datetime()
       RETURN s`,
      {
        id: sourceNodeId,
        filename: fileName,
        fileId: fileId,
        userId: userId,
        documentType: documentAnalysis?.document_type || 'general',
        mainTopic: documentAnalysis?.main_topic || 'Unknown'
      }
    );
    console.log(`[Upload Service] ✅ Source node created`);
    
    // Process each chunk
    let createdNodes = 0;
    for (const chunkData of processedChunks) {
      const memoryNodeId = `mem_${chunkData.chunkId}`;
      
      // Create Memory node
      await session.run(
        `MERGE (m:Memory {id: $id})
         ON CREATE SET m.user_id = $userId,
                       m.summary = $summary,
                       m.chunk_id = $chunkId,
                       m.file_id = $fileId,
                       m.created_at = datetime()
         RETURN m`,
        {
          id: memoryNodeId,
          userId: userId,
          summary: chunkData.metadata?.summary || 'No summary',
          chunkId: chunkData.chunkId,
          fileId: fileId
        }
      );
      
      // Update MongoDB with Neo4j node ID
      const db = getDB();
      await db.collection('chunks').updateOne(
        { chunk_id: chunkData.chunkId },
        { $set: { neo4j_node_id: memoryNodeId } }
      );
      
      // Create DERIVED_FROM relationship to source
      await session.run(
        `MATCH (m:Memory {id: $memoryId}), (s:Source {id: $sourceId})
         CREATE (m)-[:DERIVED_FROM]->(s)`,
        {
          memoryId: memoryNodeId,
          sourceId: sourceNodeId
        }
      );
      
      createdNodes++;
      
      // Create Concept nodes and TAGGED_WITH relationships
      const tags = chunkData.metadata?.tags || [];
      for (const tag of tags) {
        const normalizedTag = tag.toLowerCase().trim();
        
        // Create or merge concept node based on name (which has unique constraint)
        await session.run(
          `MERGE (c:Concept {name: $name})
           ON CREATE SET c.user_id = $userId, c.created_at = datetime()
           ON MATCH SET c.user_id = COALESCE(c.user_id, $userId)
           RETURN c`,
          {
            name: normalizedTag,
            userId: userId
          }
        );
        
        // Create TAGGED_WITH relationship
        await session.run(
          `MATCH (m:Memory {id: $memoryId}), (c:Concept {name: $name})
           MERGE (m)-[:TAGGED_WITH]->(c)`,
          {
            memoryId: memoryNodeId,
            name: normalizedTag
          }
        );
      }
      
      // Create Entity nodes and MENTIONS relationships
      const entities = chunkData.metadata?.entities || [];
      for (const entity of entities) {
        if (!entity.name) continue;
        
        const entityId = `${entity.type || 'GENERAL'}_${entity.name.toLowerCase().replace(/\s+/g, '-')}`;
        
        // Create or merge entity node
        await session.run(
          `MERGE (e:Entity {id: $id, user_id: $userId})
           ON CREATE SET e.name = $name, e.entity_type = $type
           RETURN e`,
          {
            id: entityId,
            userId: userId,
            name: entity.name,
            type: entity.type || 'GENERAL'
          }
        );
        
        // Create MENTIONS relationship
        await session.run(
          `MATCH (m:Memory {id: $memoryId}), (e:Entity {id: $entityId})
           MERGE (m)-[:MENTIONS]->(e)`,
          {
            memoryId: memoryNodeId,
            entityId: entityId
          }
        );
      }
      
      // Create relation-based edges
      const relations = chunkData.metadata?.relations || [];
      for (const relation of relations) {
        if (!relation.subject || !relation.predicate || !relation.object) continue;
        
        // This creates custom relationships based on extracted relations
        // For simplicity, we'll store them as properties on a RELATED_TO edge
        await session.run(
          `MATCH (m:Memory {id: $memoryId})
           CREATE (m)-[:RELATED_TO {
             subject: $subject,
             predicate: $predicate,
             object: $object
           }]->(m)`,
          {
            memoryId: memoryNodeId,
            subject: relation.subject,
            predicate: relation.predicate,
            object: relation.object
          }
        );
      }
    }
    
    console.log(`[Upload Service] ✅ Created ${createdNodes} Memory nodes in Neo4j for user ${userId}`);
    
    // Create SIMILAR_TO edges based on vector similarity
    console.log(`[Upload Service] Creating similarity edges...`);
    await createSimilarityEdges(processedChunks, userId, session);
    console.log(`[Upload Service] ✅ Graph creation completed for ${fileName}`);
    
  } catch (error) {
    console.error('[Upload Service] ❌ Error creating graph nodes:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Create similarity edges between memories
async function createSimilarityEdges(processedChunks, userId, session) {
  const pineconeIndex = getPineconeIndex();
  
  for (const chunkData of processedChunks) {
    // Query Pinecone for similar vectors
    const embedding = await generateEmbedding(chunkData.metadata.summary);
    
    const queryResponse = await pineconeIndex.query({
      vector: embedding,
      topK: 5,
      filter: { user_id: userId },
      includeMetadata: true
    });
    
    // Create SIMILAR_TO edges for high-similarity matches
    for (const match of queryResponse.matches) {
      if (match.score > 0.75 && match.id !== chunkData.vectorId) {
        // Get the memory node ID from MongoDB
        const db = getDB();
        const similarChunk = await db.collection('chunks').findOne({
          pinecone_vector_id: match.id
        });
        
        if (similarChunk && similarChunk.neo4j_node_id) {
          const sourceMemoryId = `mem_${chunkData.chunkId}`;
          const targetMemoryId = similarChunk.neo4j_node_id;
          
          // Create bidirectional SIMILAR_TO relationship
          await session.run(
            `MATCH (m1:Memory {id: $sourceId}), (m2:Memory {id: $targetId})
             WHERE NOT (m1)-[:SIMILAR_TO]-(m2)
             CREATE (m1)-[:SIMILAR_TO {score: $score}]->(m2)`,
            {
              sourceId: sourceMemoryId,
              targetId: targetMemoryId,
              score: match.score
            }
          );
        }
      }
    }
  }
}

// Main upload processing function
export async function processUpload(file, userId) {
  const fileId = uuidv4();
  const startTime = Date.now();
  
  try {
    console.log(`📤 Processing upload: ${file.originalname} for user: ${userId}`);
    
    // Step 1: Extract text from file
    const extractedText = await extractText(file.buffer, file.mimetype, file.originalname);
    
    if (!extractedText || extractedText.length === 0) {
      throw new Error('No text content found in the uploaded file');
    }
    
    console.log(`📝 Extracted ${extractedText.length} characters`);
    
    // Step 2: Analyze document
    let documentAnalysis;
    try {
      documentAnalysis = await analyzeDocument(extractedText, file.originalname);
      console.log(`📊 Document analysis completed`);
    } catch (analysisError) {
      console.warn(`Document analysis failed, using fallback:`, analysisError.message);
      documentAnalysis = {
        document_type: "document",
        main_topic: file.originalname,
        key_points: ["Uploaded document"],
        sentiment: "neutral",
        complexity: "intermediate",
        suggested_categories: ["general"]
      };
    }
    
    // Step 3: Create chunks
    const chunks = createChunks(extractedText);
    console.log(`🔪 Created ${chunks.length} chunks`);
    
    // Step 4: Store file metadata in MongoDB
    const db = getDB();
    await db.collection('source_files').insertOne({
      file_id: fileId,
      user_id: userId,
      file_name: file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      total_chunks: chunks.length,
      total_characters: extractedText.length,
      document_analysis: documentAnalysis,
      upload_date: new Date(),
      processing_status: 'processing'
    });
    
    // Step 5: Process each chunk
    const processedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkData = await processChunk(
        chunks[i],
        fileId,
        userId,
        file.originalname,
        i,
        chunks.length
      );
      processedChunks.push(chunkData);
      
      // Log progress for large files
      if (i % 10 === 0 && i > 0) {
        console.log(`⏳ Processed ${i}/${chunks.length} chunks`);
      }
    }
    
    // Step 6: Create graph nodes and relationships
    await createGraphNodes(processedChunks, fileId, file.originalname, userId, documentAnalysis);
    
    // Step 7: Update file status
    await db.collection('source_files').updateOne(
      { file_id: fileId },
      { 
        $set: { 
          processing_status: 'completed',
          processing_time_ms: Date.now() - startTime
        } 
      }
    );
    
    // Step 8: Calculate statistics
    const uniqueTags = new Set();
    const uniqueEntities = new Set();
    
    processedChunks.forEach(chunk => {
      chunk.metadata.tags.forEach(tag => uniqueTags.add(tag));
      chunk.metadata.entities.forEach(entity => uniqueEntities.add(entity.name));
    });
    
    const result = {
      success: true,
      file_id: fileId,
      file_name: file.originalname,
      file_type: file.mimetype,
      total_chunks: chunks.length,
      total_characters: extractedText.length,
      total_tags: uniqueTags.size,
      total_entities: uniqueEntities.size,
      document_type: documentAnalysis?.document_type || 'general',
      main_topic: documentAnalysis?.main_topic || 'Unknown',
      processing_time_ms: Date.now() - startTime,
      graph_updated: true,
      message: `Successfully processed ${file.originalname} and added to your knowledge vault`
    };
    
    console.log(`✅ Upload processing completed in ${result.processing_time_ms}ms`);
    return result;
    
  } catch (error) {
    console.error('Upload processing error:', error);
    
    // Update file status to failed
    const db = getDB();
    await db.collection('source_files').updateOne(
      { file_id: fileId },
      { 
        $set: { 
          processing_status: 'failed',
          error_message: error.message,
          processing_time_ms: Date.now() - startTime
        } 
      }
    );
    
    throw error;
  }
}

// Get upload history for a user
export async function getUploadHistory(userId, limit = 10) {
  const db = getDB();
  
  const files = await db.collection('source_files')
    .find({ user_id: userId })
    .sort({ upload_date: -1 })
    .limit(limit)
    .toArray();
    
  return files;
}

// Get file details with chunks
export async function getFileDetails(fileId, userId) {
  const db = getDB();
  
  const file = await db.collection('source_files').findOne({
    file_id: fileId,
    user_id: userId
  });
  
  if (!file) {
    throw new Error('File not found');
  }
  
  const chunks = await db.collection('chunks')
    .find({ file_id: fileId })
    .sort({ chunk_index: 1 })
    .toArray();
    
  return {
    file,
    chunks
  };
}
