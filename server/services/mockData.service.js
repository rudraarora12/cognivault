import * as graphService from './graph.service.js';
import { v4 as uuidv4 } from 'uuid';

// Mock data for testing
const mockMemories = [
  {
    text: "Artificial Intelligence is transforming how we interact with technology. Machine learning models are becoming increasingly sophisticated, enabling applications that were once thought impossible. From natural language processing to computer vision, AI is reshaping industries.",
    summary: "AI and ML are revolutionizing technology interactions and reshaping industries.",
    tags: ["artificial-intelligence", "machine-learning", "technology", "innovation"],
    entities: [
      { name: "Artificial Intelligence", type: "TECHNOLOGY", confidence: 0.95 },
      { name: "Machine Learning", type: "TECHNOLOGY", confidence: 0.93 }
    ]
  },
  {
    text: "The human brain processes information through complex neural networks. Neurons communicate via synapses, creating patterns that form memories and thoughts. Understanding these mechanisms helps us build better artificial neural networks.",
    summary: "Brain neural networks inspire artificial neural network design through understanding synaptic communication.",
    tags: ["neuroscience", "brain", "neural-networks", "cognition"],
    entities: [
      { name: "Neural Networks", type: "CONCEPT", confidence: 0.9 },
      { name: "Neurons", type: "BIOLOGY", confidence: 0.88 }
    ]
  },
  {
    text: "Quantum computing promises to solve problems that are intractable for classical computers. By leveraging quantum superposition and entanglement, these machines can process vast amounts of information simultaneously.",
    summary: "Quantum computing leverages superposition and entanglement to solve complex problems.",
    tags: ["quantum-computing", "technology", "physics", "computation"],
    entities: [
      { name: "Quantum Computing", type: "TECHNOLOGY", confidence: 0.92 },
      { name: "Quantum Superposition", type: "CONCEPT", confidence: 0.87 }
    ]
  },
  {
    text: "Climate change is one of the most pressing challenges of our time. Rising global temperatures, melting ice caps, and extreme weather events are clear indicators. Sustainable technologies and renewable energy sources are crucial for mitigation.",
    summary: "Climate change requires urgent action through sustainable technologies and renewable energy.",
    tags: ["climate-change", "sustainability", "environment", "renewable-energy"],
    entities: [
      { name: "Climate Change", type: "PHENOMENON", confidence: 0.94 },
      { name: "Renewable Energy", type: "TECHNOLOGY", confidence: 0.89 }
    ]
  },
  {
    text: "The Renaissance was a period of cultural rebirth in Europe. Artists like Leonardo da Vinci and Michelangelo created masterpieces that still inspire today. This era saw advances in art, science, and philosophy.",
    summary: "Renaissance period marked cultural rebirth with advances in art, science, and philosophy.",
    tags: ["renaissance", "history", "art", "culture", "philosophy"],
    entities: [
      { name: "Leonardo da Vinci", type: "PERSON", confidence: 0.96 },
      { name: "Michelangelo", type: "PERSON", confidence: 0.95 },
      { name: "Renaissance", type: "PERIOD", confidence: 0.93 }
    ]
  },
  {
    text: "Blockchain technology provides a decentralized ledger system. Originally developed for Bitcoin, it now has applications in supply chain, healthcare, and digital identity. Smart contracts enable automated, trustless transactions.",
    summary: "Blockchain enables decentralized systems with applications beyond cryptocurrency.",
    tags: ["blockchain", "cryptocurrency", "decentralization", "smart-contracts"],
    entities: [
      { name: "Blockchain", type: "TECHNOLOGY", confidence: 0.94 },
      { name: "Bitcoin", type: "CRYPTOCURRENCY", confidence: 0.91 },
      { name: "Smart Contracts", type: "CONCEPT", confidence: 0.88 }
    ]
  },
  {
    text: "Space exploration continues to push the boundaries of human achievement. SpaceX and NASA are working on Mars colonization plans. The James Webb Space Telescope is revealing unprecedented details about distant galaxies.",
    summary: "Space exploration advances with Mars colonization plans and deep space observations.",
    tags: ["space", "exploration", "mars", "astronomy", "nasa"],
    entities: [
      { name: "SpaceX", type: "ORGANIZATION", confidence: 0.93 },
      { name: "NASA", type: "ORGANIZATION", confidence: 0.95 },
      { name: "Mars", type: "CELESTIAL_BODY", confidence: 0.92 },
      { name: "James Webb Space Telescope", type: "TECHNOLOGY", confidence: 0.90 }
    ]
  },
  {
    text: "Machine learning algorithms learn patterns from data without explicit programming. Deep learning, a subset of ML, uses multi-layered neural networks. These technologies power recommendation systems, voice assistants, and autonomous vehicles.",
    summary: "ML and deep learning algorithms power modern AI applications through pattern recognition.",
    tags: ["machine-learning", "deep-learning", "algorithms", "neural-networks"],
    entities: [
      { name: "Machine Learning", type: "TECHNOLOGY", confidence: 0.94 },
      { name: "Deep Learning", type: "TECHNOLOGY", confidence: 0.92 },
      { name: "Neural Networks", type: "CONCEPT", confidence: 0.89 }
    ]
  },
  {
    text: "The Internet of Things connects everyday devices to the internet. Smart homes, wearable technology, and industrial IoT are transforming how we live and work. Edge computing brings processing closer to data sources.",
    summary: "IoT connects devices globally while edge computing optimizes data processing.",
    tags: ["iot", "smart-home", "edge-computing", "connectivity"],
    entities: [
      { name: "Internet of Things", type: "TECHNOLOGY", confidence: 0.93 },
      { name: "Edge Computing", type: "TECHNOLOGY", confidence: 0.88 },
      { name: "Smart Homes", type: "CONCEPT", confidence: 0.86 }
    ]
  },
  {
    text: "Genetic engineering and CRISPR technology are revolutionizing medicine. Gene therapy offers potential cures for inherited diseases. Synthetic biology is creating new organisms with designed functions.",
    summary: "CRISPR and genetic engineering advance medicine through gene therapy and synthetic biology.",
    tags: ["genetics", "crispr", "biotechnology", "medicine"],
    entities: [
      { name: "CRISPR", type: "TECHNOLOGY", confidence: 0.95 },
      { name: "Gene Therapy", type: "MEDICAL_PROCEDURE", confidence: 0.91 },
      { name: "Synthetic Biology", type: "FIELD", confidence: 0.87 }
    ]
  }
];

// Initialize mock data in the graph
export async function initializeMockData(userId = 'demo_user', count = 5, clearExisting = true) {
  try {
    console.log('🎭 Initializing mock data for user:', userId);
    console.log(`📊 Creating ${count} memories (clearExisting: ${clearExisting})`);
    
    // Clear existing data if requested
    if (clearExisting) {
      console.log('🧹 Clearing existing data...');
      await graphService.clearUserData(userId);
      console.log('✅ Existing data cleared');
    }
    
    // Limit count to available mock memories
    const memoryCount = Math.min(count, mockMemories.length);
    
    // Create source files
    const sourceFileId = `source_${uuidv4()}`;
    const memories = [];
    
    // Create memory nodes
    for (let i = 0; i < memoryCount; i++) {
      const mockData = mockMemories[i];
      
      const memory = await graphService.createMemoryNode({
        text: mockData.text,
        summary: mockData.summary,
        tags: mockData.tags,
        entities: mockData.entities,
        user_id: userId,
        source_file_id: i < 5 ? sourceFileId : `source_${uuidv4()}`
      });
      
      memories.push(memory);
      console.log(`Created memory ${i + 1}/${memoryCount}: ${memory.id}`);
    }
    
    // Create similarity edges for some memories
    console.log('Creating similarity edges...');
    for (let i = 0; i < Math.min(3, memories.length); i++) {
      await graphService.createSimilarityEdges(memories[i].id, userId);
    }
    
    // Get statistics
    const stats = await graphService.getGraphStats(userId);
    
    return {
      success: true,
      message: `Initialized ${memories.length} mock memories (cleared existing: ${clearExisting})`,
      stats
    };
    
  } catch (error) {
    console.error('Error initializing mock data:', error);
    throw error;
  }
}

// Generate random mock data
export function generateRandomMemory() {
  const topics = [
    'artificial intelligence', 'quantum physics', 'biotechnology',
    'space exploration', 'climate science', 'neuroscience',
    'blockchain', 'renewable energy', 'robotics', 'nanotechnology'
  ];
  
  const entities = [
    { name: 'OpenAI', type: 'ORGANIZATION' },
    { name: 'MIT', type: 'ORGANIZATION' },
    { name: 'Stanford', type: 'ORGANIZATION' },
    { name: 'Google', type: 'ORGANIZATION' },
    { name: 'NASA', type: 'ORGANIZATION' },
    { name: 'Elon Musk', type: 'PERSON' },
    { name: 'Alan Turing', type: 'PERSON' }
  ];
  
  const selectedTopics = topics
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(Math.random() * 3) + 2);
  
  const selectedEntities = entities
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(Math.random() * 2) + 1)
    .map(e => ({ ...e, confidence: Math.random() * 0.3 + 0.7 }));
  
  const text = `This is a generated memory about ${selectedTopics.join(' and ')}. 
    It contains information that connects various concepts and ideas. 
    The relationships between these topics are complex and interconnected.`;
  
  return {
    text,
    summary: `Generated content about ${selectedTopics[0]} and related topics.`,
    tags: selectedTopics,
    entities: selectedEntities
  };
}
