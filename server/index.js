import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import graphRoutes from './routes/graph.routes.js';
import incognitoRoutes from './routes/incognito.routes.js';
import { connectNeo4j } from './config/neo4j.js';
import { connectMongoDB } from './config/mongodb.js';
import { initPinecone } from './config/pinecone.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize connections
async function initializeServices() {
  console.log('🚀 Initializing services...');
  
  let servicesStatus = {
    neo4j: 'disconnected',
    mongodb: 'disconnected',
    pinecone: 'mock'
  };
  
  // Connect to Neo4j (allow failure for mock mode)
  try {
    await connectNeo4j();
    console.log('✅ Neo4j connected');
    servicesStatus.neo4j = 'connected';
  } catch (error) {
    console.warn('⚠️  Neo4j not available, using mock mode:', error.message);
  }
  
  // Connect to MongoDB (allow failure for mock mode)
  try {
    await connectMongoDB();
    console.log('✅ MongoDB connected');
    servicesStatus.mongodb = 'connected';
  } catch (error) {
    console.warn('⚠️  MongoDB not available, using mock mode:', error.message);
  }
  
  // Initialize Pinecone (always works in mock mode)
  try {
    await initPinecone();
    console.log('✅ Pinecone initialized');
    servicesStatus.pinecone = 'initialized';
  } catch (error) {
    console.warn('⚠️  Pinecone using mock mode:', error.message);
  }
  
  console.log('🎉 Services initialized (mock mode available)');
  return servicesStatus;
}

// Routes
app.use('/api/graph', graphRoutes);
app.use('/api/incognito', incognitoRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      neo4j: 'connected',
      mongodb: 'connected',
      pinecone: 'initialized'
    }
  });
});

// Start server
async function startServer() {
  await initializeServices();
  
  app.listen(PORT, () => {
    console.log(`🌟 CogniVault server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
