import { connectMongoDB } from '../config/mongodb.js';
import { connectNeo4j } from '../config/neo4j.js';
import { getPineconeIndex } from '../config/pinecone.js';
import geminiService from './gemini.service.js';
import { v4 as uuidv4 } from 'uuid';

class EmailProcessorService {
  constructor() {
    this.CHUNK_SIZE = 500;
    this.CHUNK_OVERLAP = 100;
  }

  // Process a single email message
  async processEmail(userId, email, message) {
    const db = await connectMongoDB();
    const messagesCollection = db.collection('mail_messages');
    
    try {
      // Check if message already exists
      const existingMessage = await messagesCollection.findOne({
        user_id: userId,
        message_id: message.message_id
      });
      
      if (existingMessage) {
        console.log(`Message ${message.message_id} already processed`);
        return existingMessage;
      }
      
      // Prepare raw text for processing
      const rawText = this.prepareRawText(message);
      
      // Save initial message record
      const messageDoc = {
        _id: uuidv4(),
        user_id: userId,
        email: email,
        message_id: message.message_id,
        thread_id: message.thread_id,
        subject: message.subject,
        from: message.from,
        to: message.to,
        date: message.date,
        labels: message.labels,
        raw_text: rawText,
        status: 'pending',
        created_at: new Date()
      };
      
      await messagesCollection.insertOne(messageDoc);
      
      // Classify the email
      const classification = await this.classifyEmail(rawText, message);
      
      // Update with classification
      await messagesCollection.updateOne(
        { _id: messageDoc._id },
        { $set: { 
          classification: classification,
          status: classification.category === 'IGNORE' && classification.confidence >= 0.85 
            ? 'ignored' 
            : 'processing'
        }}
      );
      
      // Skip further processing if ignored
      if (classification.category === 'IGNORE' && classification.confidence >= 0.85) {
        console.log(`Message ${message.message_id} classified as IGNORE`);
        return messageDoc;
      }
      
      // Process important or note emails
      await this.processImportantEmail(userId, email, messageDoc, classification);
      
      // Update status
      await messagesCollection.updateOne(
        { _id: messageDoc._id },
        { $set: { status: 'processed' }}
      );
      
      return messageDoc;
    } catch (error) {
      console.error('Error processing email:', error);
      await messagesCollection.updateOne(
        { message_id: message.message_id },
        { $set: { status: 'error', error: error.message }}
      );
      throw error;
    }
  }

  // Prepare raw text from message
  prepareRawText(message) {
    let text = `Subject: ${message.subject}\n`;
    text += `From: ${message.from}\n`;
    text += `Date: ${message.date}\n\n`;
    text += message.body || message.snippet || '';
    
    // Add attachment info
    if (message.attachments && message.attachments.length > 0) {
      text += '\n\nAttachments:\n';
      message.attachments.forEach(att => {
        text += `- ${att.filename} (${att.mimeType})\n`;
      });
    }
    
    return text;
  }

  // Classify email using Gemini
  async classifyEmail(rawText, message) {
    const prompt = `
You are an email classifier for a personal knowledge management system. 
Classify this email into exactly one of three categories:
- "NOTE": Contains useful information that should be saved as a memory (technical docs, important discussions, learning content)
- "IMPORTANT": Time-sensitive or action-required emails (meetings, deadlines, urgent requests)
- "IGNORE": Spam, marketing, notifications, social media, automated messages that have no lasting value

Provide output as JSON with these exact fields:
- category: "NOTE" | "IMPORTANT" | "IGNORE"
- confidence: number between 0 and 1
- reasons: array of short strings explaining the classification
- short_summary: 1-2 sentence summary of the email
- tags: array of relevant keywords (max 5)
- entities: array of named entities found (people, organizations, projects)

Email content:
${rawText}`;

    try {
      const result = await geminiService.generateText(prompt);
      return JSON.parse(result);
    } catch (error) {
      console.error('Classification error:', error);
      // Fallback classification
      return {
        category: 'NOTE',
        confidence: 0.5,
        reasons: ['Failed to classify, defaulting to NOTE'],
        short_summary: message.subject,
        tags: [],
        entities: []
      };
    }
  }

  // Process important/note emails
  async processImportantEmail(userId, email, messageDoc, classification) {
    const db = await connectMongoDB();
    const chunksCollection = db.collection('mail_chunks');
    
    // Chunk the email if needed
    const chunks = this.chunkText(messageDoc.raw_text);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkDoc = {
        _id: uuidv4(),
        message_id: messageDoc._id,
        user_id: userId,
        email: email,
        chunk_index: i,
        chunk_text: chunks[i],
        summary: classification.short_summary,
        tags: classification.tags,
        entities: classification.entities,
        created_at: new Date()
      };
      
      // Generate embedding with error handling
      let embedding = null;
      try {
        embedding = await geminiService.generateEmbedding(chunks[i]);
      } catch (embeddingError) {
        console.warn(`Failed to generate embedding for chunk ${i}:`, embeddingError.message);
        // Use a mock embedding as fallback (768 dimensions of random values)
        embedding = new Array(768).fill(0).map(() => Math.random() * 0.1);
      }
      
      // Store in Pinecone if we have an embedding
      if (embedding) {
        const pineconeId = `mail_${messageDoc.message_id}_chunk_${i}`;
        const index = getPineconeIndex();
        
        if (index) {
          try {
            await index.upsert([{
              id: pineconeId,
              values: embedding,
              metadata: {
                message_id: messageDoc._id,
                chunk_index: i,
                user_id: userId,
                email: email,
                summary: classification.short_summary,
                subject: messageDoc.subject,
                category: classification.category,
                source: 'gmail',
                type: 'email'
              }
            }]);
            
            chunkDoc.pinecone_id = pineconeId;
          } catch (pineconeError) {
            console.warn(`Failed to store in Pinecone:`, pineconeError.message);
          }
        }
      }
      
      // Create Neo4j nodes and relationships
      const neo4jNodeId = await this.createGraphNodes(
        userId,
        messageDoc,
        chunkDoc,
        classification
      );
      
      chunkDoc.neo4j_node_id = neo4jNodeId;
      
      // Save chunk
      await chunksCollection.insertOne(chunkDoc);
    }
  }

  // Chunk text
  chunkText(text) {
    if (!text || text.length < this.CHUNK_SIZE) {
      return [text];
    }
    
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > this.CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          // Add overlap
          const overlapStart = Math.max(0, currentChunk.length - this.CHUNK_OVERLAP);
          currentChunk = currentChunk.substring(overlapStart) + sentence;
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk += sentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Create Neo4j graph nodes
  async createGraphNodes(userId, messageDoc, chunkDoc, classification) {
    const driver = await connectNeo4j();
    const session = driver.session();
    
    try {
      // Create Email Source node
      const sourceNodeId = `email_${messageDoc.message_id}`;
      await session.run(
        `MERGE (s:Source:Email {id: $id})
         ON CREATE SET 
           s.message_id = $messageId,
           s.subject = $subject,
           s.from = $from,
           s.date = $date,
           s.user_id = $userId,
           s.category = $category,
           s.created_at = datetime()
         RETURN s`,
        {
          id: sourceNodeId,
          messageId: messageDoc.message_id,
          subject: messageDoc.subject,
          from: messageDoc.from,
          date: messageDoc.date,
          userId: userId,
          category: classification.category
        }
      );
      
      // Create Memory node for chunk
      const memoryNodeId = `memory_${chunkDoc._id}`;
      await session.run(
        `MERGE (m:Memory {id: $id})
         ON CREATE SET 
           m.user_id = $userId,
           m.summary = $summary,
           m.chunk_id = $chunkId,
           m.source_type = 'email',
           m.created_at = datetime()
         RETURN m`,
        {
          id: memoryNodeId,
          userId: userId,
          summary: chunkDoc.summary,
          chunkId: chunkDoc._id
        }
      );
      
      // Create DERIVED_FROM relationship
      await session.run(
        `MATCH (m:Memory {id: $memoryId}), (s:Source {id: $sourceId})
         MERGE (m)-[:DERIVED_FROM]->(s)`,
        {
          memoryId: memoryNodeId,
          sourceId: sourceNodeId
        }
      );
      
      // Create Concept nodes for tags
      for (const tag of chunkDoc.tags || []) {
        const normalizedTag = tag.toLowerCase().trim();
        
        await session.run(
          `MERGE (c:Concept {name: $name})
           ON CREATE SET c.user_id = $userId, c.created_at = datetime()
           ON MATCH SET c.user_id = COALESCE(c.user_id, $userId)`,
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
      
      // Create Entity nodes
      for (const entity of chunkDoc.entities || []) {
        const entityId = `entity_${entity.toLowerCase().replace(/\s+/g, '_')}`;
        
        await session.run(
          `MERGE (e:Entity {id: $id})
           ON CREATE SET 
             e.name = $name,
             e.type = 'PERSON',
             e.user_id = $userId,
             e.created_at = datetime()`,
          {
            id: entityId,
            name: entity,
            userId: userId
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
      
      // Find similar memories and create SIMILAR_TO edges
      const index = getPineconeIndex();
      if (index && chunkDoc.pinecone_id) {
        try {
          const embedding = await geminiService.generateEmbedding(chunkDoc.chunk_text);
          const similar = await index.query({
            vector: embedding,
            topK: 5,
            filter: {
              user_id: userId
            },
            includeMetadata: true
          });
          
          for (const match of similar.matches || []) {
            if (match.id !== chunkDoc.pinecone_id && match.score > 0.8) {
            // Find the Memory node for this vector
            const relatedMemory = await session.run(
              `MATCH (m:Memory {chunk_id: $chunkId})
               RETURN m.id as id`,
              { chunkId: match.metadata.chunk_index }
            );
            
            if (relatedMemory.records.length > 0) {
              const relatedId = relatedMemory.records[0].get('id');
              await session.run(
                `MATCH (m1:Memory {id: $id1}), (m2:Memory {id: $id2})
                 MERGE (m1)-[r:SIMILAR_TO]-(m2)
                 SET r.similarity = $score`,
                {
                  id1: memoryNodeId,
                  id2: relatedId,
                  score: match.score
                }
              );
            }
          }
        }
        } catch (embeddingError) {
          console.warn(`Failed to find similar memories:`, embeddingError.message);
        }
      }
      
      return memoryNodeId;
    } finally {
      await session.close();
    }
  }

  // Process batch of emails
  async processBatch(userId, email, messages) {
    const results = [];
    
    for (const message of messages) {
      try {
        const result = await this.processEmail(userId, email, message);
        results.push(result);
      } catch (error) {
        console.error(`Error processing message ${message.message_id}:`, error);
        results.push({ 
          message_id: message.message_id, 
          error: error.message 
        });
      }
    }
    
    return results;
  }

  // Get important emails for user
  async getImportantEmails(userId, limit = 10) {
    const db = await connectMongoDB();
    const messages = await db.collection('mail_messages')
      .find({
        user_id: userId,
        'classification.category': 'IMPORTANT',
        status: 'processed'
      })
      .sort({ date: -1 })
      .limit(limit)
      .toArray();
    
    return messages;
  }

  // Get email notes for user
  async getEmailNotes(userId, limit = 20) {
    const db = await connectMongoDB();
    const messages = await db.collection('mail_messages')
      .find({
        user_id: userId,
        'classification.category': 'NOTE',
        status: 'processed'
      })
      .sort({ date: -1 })
      .limit(limit)
      .toArray();
    
    return messages;
  }
}

export default new EmailProcessorService();
