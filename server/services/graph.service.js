import { v4 as uuidv4 } from 'uuid';
import neo4j from 'neo4j-driver';
import { getDriver } from '../config/neo4j.js';
import { getDB } from '../config/mongodb.js';
import { getPineconeIndex } from '../config/pinecone.js';
import { generateMockEmbedding } from './embedding.service.js';

// Create a memory node and its relationships
export async function createMemoryNode({
  text,
  summary,
  tags = [],
  entities = [],
  user_id,
  source_file_id
}) {
  const driver = getDriver();
  const session = driver.session();
  const db = getDB();
  
  try {
    const memory_id = `mem_${uuidv4()}`;
    const timestamp = new Date().toISOString();
    
    // Start transaction
    const tx = session.beginTransaction();
    
    // 1. Create Memory node
    await tx.run(
      `CREATE (m:Memory {
        id: $id,
        summary: $summary,
        user_id: $user_id,
        created_at: $timestamp,
        char_count: $char_count
      })
      RETURN m`,
      {
        id: memory_id,
        summary,
        user_id,
        timestamp,
        char_count: text.length
      }
    );
    
    // 2. Create/Link Concept nodes (tags)
    for (const tag of tags) {
      await tx.run(
        `MERGE (c:Concept {name: $name, user_id: $user_id})
         WITH c
         MATCH (m:Memory {id: $memory_id})
         CREATE (m)-[:TAGGED_WITH]->(c)`,
        {
          name: tag.toLowerCase(),
          user_id,
          memory_id
        }
      );
    }
    
    // 3. Create/Link Entity nodes
    for (const entity of entities) {
      const entity_id = `ent_${uuidv4()}`;
      await tx.run(
        `MERGE (e:Entity {name: $name, type: $type, user_id: $user_id})
         ON CREATE SET e.id = $entity_id
         WITH e
         MATCH (m:Memory {id: $memory_id})
         CREATE (m)-[:MENTIONS {confidence: $confidence}]->(e)`,
        {
          entity_id,
          name: entity.name,
          type: entity.type || 'GENERAL',
          user_id,
          memory_id,
          confidence: entity.confidence || 0.9
        }
      );
    }
    
    // 4. Link to Source if provided
    if (source_file_id) {
      await tx.run(
        `MATCH (m:Memory {id: $memory_id})
         MERGE (s:Source {id: $source_id, user_id: $user_id})
         CREATE (m)-[:DERIVED_FROM]->(s)`,
        {
          memory_id,
          source_id: source_file_id,
          user_id
        }
      );
    }
    
    await tx.commit();
    
    // 5. Store in MongoDB
    const chunkDoc = {
      chunk_id: memory_id,
      file_id: source_file_id,
      user_id,
      chunk_text: text,
      summary,
      tags,
      entities,
      neo4j_node_id: memory_id,
      created_at: timestamp
    };
    
    await db.collection('chunks').insertOne(chunkDoc);
    
    // 6. Create embedding and store in Pinecone
    const embedding = await generateMockEmbedding(text);
    const index = getPineconeIndex();
    
    await index.upsert([{
      id: memory_id,
      values: embedding,
      metadata: {
        node_id: memory_id,
        chunk_summary: summary,
        user_id,
        source_file: source_file_id || 'direct_input'
      }
    }]);
    
    return {
      id: memory_id,
      summary,
      tags,
      entities,
      created_at: timestamp
    };
    
  } finally {
    await session.close();
  }
}

// Get subgraph around a node
export async function getSubgraph(nodeId, depth = 2, userId) {
  const driver = getDriver();
  const session = driver.session();
  
  try {
    // Get nodes and relationships within depth
    const result = await session.run(
      `MATCH path = (start {id: $nodeId, user_id: $userId})-[*0..${depth}]-(connected)
       WHERE connected.user_id = $userId OR connected.user_id IS NULL
       WITH start, connected, relationships(path) as rels
       RETURN 
         collect(DISTINCT start) + collect(DISTINCT connected) as nodes,
         collect(DISTINCT rels) as relationships`,
      { nodeId, userId }
    );
    
    if (result.records.length === 0) {
      return { nodes: [], edges: [] };
    }
    
    const record = result.records[0];
    const nodesSet = new Set();
    const edgesSet = new Set();
    
    // Process nodes
    const nodes = [];
    const nodeMap = new Map();
    
    record.get('nodes').forEach(nodeArr => {
      if (Array.isArray(nodeArr)) {
        nodeArr.forEach(node => processNode(node));
      } else if (nodeArr) {
        processNode(nodeArr);
      }
    });
    
    function processNode(node) {
      if (!node || !node.properties) return;
      
      const nodeId = node.properties.id || node.properties.name;
      if (!nodeId || nodesSet.has(nodeId)) return;
      
      nodesSet.add(nodeId);
      const labels = node.labels || [];
      const type = labels[0] || 'Unknown';
      
      const nodeData = {
        id: nodeId,
        type,
        label: node.properties.summary || node.properties.name || nodeId,
        ...node.properties
      };
      
      nodes.push(nodeData);
      nodeMap.set(nodeId, nodeData);
    }
    
    // Process edges
    const edges = [];
    record.get('relationships').forEach(relArr => {
      if (Array.isArray(relArr)) {
        relArr.forEach(rel => {
          if (Array.isArray(rel)) {
            rel.forEach(r => processRelationship(r));
          } else {
            processRelationship(rel);
          }
        });
      }
    });
    
    function processRelationship(rel) {
      if (!rel || !rel.start || !rel.end) return;
      
      // Get the actual node IDs
      const startNodeId = rel.start.low || rel.start;
      const endNodeId = rel.end.low || rel.end;
      
      // Find corresponding nodes
      let sourceId = null;
      let targetId = null;
      
      nodes.forEach(node => {
        if (node.identity?.low === startNodeId || node.identity === startNodeId) {
          sourceId = node.id;
        }
        if (node.identity?.low === endNodeId || node.identity === endNodeId) {
          targetId = node.id;
        }
      });
      
      if (sourceId && targetId) {
        const edgeId = `${sourceId}-${rel.type}-${targetId}`;
        if (!edgesSet.has(edgeId)) {
          edgesSet.add(edgeId);
          edges.push({
            id: edgeId,
            source: sourceId,
            target: targetId,
            type: rel.type,
            label: rel.type.replace(/_/g, ' '),
            ...rel.properties
          });
        }
      }
    }
    
    return { nodes, edges };
    
  } finally {
    await session.close();
  }
}

// Get full user graph
export async function getUserGraph(userId, limit = 100) {
  const driver = getDriver();
  const session = driver.session();
  
  // Ensure limit is a Neo4j integer type
  const intLimit = neo4j.int(parseInt(limit) || 100);
  
  try {
    // Get all nodes for user
    const nodesResult = await session.run(
      `MATCH (n)
       WHERE n.user_id = $userId
       RETURN n
       LIMIT $limit`,
      { userId, limit: intLimit }
    );
    
    const nodes = nodesResult.records.map(record => {
      const node = record.get('n');
      const labels = node.labels || [];
      return {
        id: node.properties.id || node.properties.name,
        type: labels[0] || 'Unknown',
        label: node.properties.summary || node.properties.name || node.properties.id,
        ...node.properties
      };
    });
    
    // Get all relationships
    const edgesResult = await session.run(
      `MATCH (a)-[r]-(b)
       WHERE a.user_id = $userId AND (b.user_id = $userId OR b.user_id IS NULL)
       RETURN a.id as source, b.id as target, type(r) as type, properties(r) as props
       LIMIT $limit`,
      { userId, limit: intLimit }
    );
    
    const edges = edgesResult.records.map(record => ({
      id: `${record.get('source')}-${record.get('type')}-${record.get('target')}`,
      source: record.get('source') || record.get('source'),
      target: record.get('target') || record.get('target'),
      type: record.get('type'),
      label: record.get('type').replace(/_/g, ' '),
      ...record.get('props')
    }));
    
    return { nodes, edges };
    
  } finally {
    await session.close();
  }
}

// Create similarity edges based on vector similarity
export async function createSimilarityEdges(memoryId, userId) {
  const driver = getDriver();
  const session = driver.session();
  const index = getPineconeIndex();
  
  try {
    // Get embedding for this memory from MongoDB
    const db = getDB();
    const chunk = await db.collection('chunks').findOne({ chunk_id: memoryId });
    
    if (!chunk) {
      throw new Error('Memory chunk not found');
    }
    
    // Generate embedding
    const embedding = await generateMockEmbedding(chunk.chunk_text);
    
    // Query similar vectors
    const queryResult = await index.query({
      vector: embedding,
      topK: 10,
      filter: { user_id: userId }
    });
    
    const edges = [];
    
    for (const match of queryResult.matches) {
      if (match.id === memoryId) continue; // Skip self
      if (match.score < 0.75) continue; // Threshold for similarity
      
      // Create SIMILAR_TO edge
      await session.run(
        `MATCH (a:Memory {id: $source_id}), (b:Memory {id: $target_id})
         MERGE (a)-[r:SIMILAR_TO {score: $score}]-(b)
         RETURN r`,
        {
          source_id: memoryId,
          target_id: match.id,
          score: match.score
        }
      );
      
      edges.push({
        source: memoryId,
        target: match.id,
        type: 'SIMILAR_TO',
        score: match.score
      });
    }
    
    return edges;
    
  } finally {
    await session.close();
  }
}

// Search nodes
export async function searchNodes(query, userId, type = null) {
  const driver = getDriver();
  const session = driver.session();
  
  try {
    let cypher = `
      MATCH (n)
      WHERE n.user_id = $userId
      AND (
        toLower(n.summary) CONTAINS toLower($query)
        OR toLower(n.name) CONTAINS toLower($query)
        OR toLower(n.id) CONTAINS toLower($query)
      )
    `;
    
    if (type) {
      cypher += ` AND $type IN labels(n) `;
    }
    
    cypher += ` RETURN n LIMIT 20`;
    
    const result = await session.run(cypher, { userId, query, type });
    
    return result.records.map(record => {
      const node = record.get('n');
      return {
        id: node.properties.id || node.properties.name,
        type: node.labels[0],
        ...node.properties
      };
    });
    
  } finally {
    await session.close();
  }
}

// Get graph statistics
export async function getGraphStats(userId) {
  const driver = getDriver();
  const session = driver.session();
  
  try {
    const result = await session.run(
      `MATCH (n)
       WHERE n.user_id = $userId
       WITH labels(n)[0] as type, count(n) as count
       RETURN type, count
       ORDER BY count DESC`,
      { userId }
    );
    
    const nodeStats = {};
    result.records.forEach(record => {
      nodeStats[record.get('type')] = record.get('count').low || record.get('count');
    });
    
    const edgeResult = await session.run(
      `MATCH (a)-[r]-(b)
       WHERE a.user_id = $userId
       WITH type(r) as type, count(r) as count
       RETURN type, count
       ORDER BY count DESC`,
      { userId }
    );
    
    const edgeStats = {};
    edgeResult.records.forEach(record => {
      edgeStats[record.get('type')] = (record.get('count').low || record.get('count')) / 2;
    });
    
    return {
      nodes: nodeStats,
      edges: edgeStats,
      total_nodes: Object.values(nodeStats).reduce((a, b) => a + b, 0),
      total_edges: Object.values(edgeStats).reduce((a, b) => a + b, 0)
    };
    
  } finally {
    await session.close();
  }
}

// Clear all data for a user
export async function clearUserData(userId) {
  const driver = getDriver();
  const session = driver.session();
  
  try {
    console.log(`🗑️  Deleting all nodes and relationships for user: ${userId}`);
    
    // Delete all nodes and their relationships for the user
    const result = await session.run(
      `MATCH (n)
       WHERE n.user_id = $userId
       DETACH DELETE n
       RETURN count(n) as deletedCount`,
      { userId }
    );
    
    const deletedCount = result.records[0]?.get('deletedCount').toNumber() || 0;
    console.log(`✅ Deleted ${deletedCount} nodes and their relationships`);
    
    return { success: true, deletedCount };
    
  } catch (error) {
    console.error('Error clearing user data:', error);
    throw error;
  } finally {
    await session.close();
  }
}
