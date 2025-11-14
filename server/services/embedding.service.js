import geminiService from './gemini.service.js';
import dotenv from 'dotenv';

dotenv.config();

// Generate embedding for text
export async function generateEmbedding(text) {
  try {
    return await geminiService.generateEmbedding(text);
  } catch (error) {
    console.error('Error generating embedding:', error);
    return generateMockEmbedding(text);
  }
}

// Generate mock embedding for development
export function generateMockEmbedding(text) {
  // Create a deterministic mock embedding based on text
  const dimension = 768;
  const embedding = new Array(dimension);
  
  // Use text length and characters to create variation
  const seed = text.length % 100;
  const charSum = text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  
  for (let i = 0; i < dimension; i++) {
    // Generate pseudo-random values between -1 and 1
    const value = Math.sin(seed + i + charSum / 1000) * Math.cos(i / 10);
    embedding[i] = Math.max(-1, Math.min(1, value));
  }
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

// Process text with Gemini for extraction
export async function processTextWithAI(text, type = 'summary') {
  try {
    let prompt;
    switch (type) {
      case 'summary':
        prompt = `Summarize the following text in 2-3 sentences: ${text}`;
        break;
      case 'tags':
        prompt = `Extract 3-5 key concept tags from this text (return as comma-separated): ${text}`;
        break;
      case 'entities':
        prompt = `Extract named entities (people, organizations, technologies) from this text as JSON: ${text}`;
        break;
      default:
        prompt = text;
    }
    
    const response = await geminiService.generateText(prompt);
    
    if (type === 'tags') {
      return response.split(',').map(tag => tag.trim());
    } else if (type === 'entities') {
      try {
        return JSON.parse(response);
      } catch {
        return [];
      }
    }
    
    return response;
  } catch (error) {
    console.error('Error processing with AI:', error);
    return generateMockProcessing(text, type);
  }
}

// Generate mock AI processing for development
function generateMockProcessing(text, type) {
  const words = text.split(' ').slice(0, 20);
  
  switch (type) {
    case 'summary':
      return `This is a summary of content about ${words.slice(0, 5).join(' ')}...`;
      
    case 'tags':
      return ['knowledge', 'memory', 'ai', 'data', 'cognition'].slice(0, Math.floor(Math.random() * 3) + 3);
      
    case 'entities':
      return [
        { name: 'CogniVault', type: 'PRODUCT' },
        { name: 'AI System', type: 'TECHNOLOGY' },
        { name: 'User', type: 'PERSON' }
      ].slice(0, Math.floor(Math.random() * 2) + 1);
      
    default:
      return text.slice(0, 100);
  }
}
