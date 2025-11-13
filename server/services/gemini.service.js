import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

let genAI;
let textModel;
let visionModel;
let embeddingModel;

// Initialize Gemini AI
export function initGemini() {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') {
      console.log('🔧 Running Gemini in mock mode');
      return initMockGemini();
    }

    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    textModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-latest" });
    visionModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-latest" });
    embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    console.log('✅ Gemini AI initialized');
    return true;
  } catch (error) {
    console.error('Gemini initialization error:', error);
    console.log('Falling back to mock mode');
    return initMockGemini();
  }
}

// Mock mode for development
function initMockGemini() {
  textModel = {
    generateContent: async (prompt) => ({
      response: {
        text: () => JSON.stringify({
          summary: "Mock summary of the content",
          tags: ["mock-tag1", "mock-tag2"],
          entities: [
            { name: "MockEntity", type: "ORGANIZATION" },
            { name: "John Doe", type: "PERSON" }
          ],
          relations: [
            { subject: "MockEntity", predicate: "employs", object: "John Doe" }
          ]
        })
      }
    })
  };

  visionModel = {
    generateContent: async (input) => ({
      response: {
        text: () => "Mock extracted text from image: This is sample text extracted from the uploaded image."
      }
    })
  };

  embeddingModel = {
    embedContent: async (content) => ({
      embedding: {
        values: Array(768).fill(0).map(() => Math.random())
      }
    })
  };

  return true;
}

// Generate metadata for a chunk of text
export async function generateMetadata(text) {
  try {
    const prompt = `Analyze the following text and provide structured metadata in JSON format.
    
    Text: """${text}"""
    
    Return a JSON object with:
    1. summary: A concise 1-2 sentence summary
    2. tags: An array of 3-5 relevant topic tags (lowercase, hyphenated)
    3. entities: An array of named entities with {name, type} where type is one of: PERSON, ORGANIZATION, LOCATION, TECHNOLOGY, CONCEPT
    4. relations: An array of semantic relations with {subject, predicate, object} format
    
    Example output:
    {
      "summary": "Discussion about AI ethics and its impact on society",
      "tags": ["artificial-intelligence", "ethics", "technology", "society"],
      "entities": [
        {"name": "OpenAI", "type": "ORGANIZATION"},
        {"name": "GPT-4", "type": "TECHNOLOGY"}
      ],
      "relations": [
        {"subject": "OpenAI", "predicate": "develops", "object": "GPT-4"},
        {"subject": "AI", "predicate": "impacts", "object": "society"}
      ]
    }
    
    Return ONLY the JSON object, no additional text.`;

    const result = await textModel.generateContent(prompt);
    const response = result.response.text();
    
    // Parse JSON from response
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
    }
    
    // Fallback response
    return {
      summary: text.substring(0, 100) + '...',
      tags: ['unprocessed'],
      entities: [],
      relations: []
    };
    
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      summary: text.substring(0, 100) + '...',
      tags: ['error-processing'],
      entities: [],
      relations: []
    };
  }
}

// Extract text from image using Gemini Vision
export async function extractTextFromImage(imageBuffer, mimeType) {
  try {
    const prompt = `Extract ALL text from this image. Include:
    - All visible text (typed, printed, or handwritten)
    - Text from tables, charts, or diagrams
    - Captions, labels, and annotations
    - Headers and footers
    
    If the image contains no text, say "No text found in image".
    Return ONLY the extracted text, maintaining the original structure and formatting where possible.`;

    const image = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType
      }
    };

    const result = await visionModel.generateContent([prompt, image]);
    const extractedText = result.response.text();
    
    if (extractedText === "No text found in image") {
      return null;
    }
    
    return extractedText;
    
  } catch (error) {
    console.error('Error extracting text from image:', error);
    return null;
  }
}

// Generate embedding for text
export async function generateEmbedding(text) {
  try {
    if (!embeddingModel) {
      // Mock mode
      return Array(768).fill(0).map(() => Math.random());
    }

    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
    
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Return mock embedding on error
    return Array(768).fill(0).map(() => Math.random());
  }
}

// Analyze document for comprehensive insights
export async function analyzeDocument(fullText, fileName) {
  try {
    const prompt = `Analyze this document and provide comprehensive insights.
    
    Document name: ${fileName}
    Content: """${fullText.substring(0, 3000)}..."""
    
    Provide a JSON response with:
    1. document_type: The type of document (e.g., "research_paper", "meeting_notes", "article", "code", "report")
    2. main_topic: The primary subject of the document
    3. key_points: Array of 3-5 main points or takeaways
    4. sentiment: Overall tone (positive, negative, neutral, informative, analytical)
    5. complexity: Document complexity (beginner, intermediate, advanced)
    6. suggested_categories: Array of 2-3 categories to classify this document
    
    Return ONLY the JSON object.`;

    const result = await textModel.generateContent(prompt);
    const response = result.response.text();
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing document analysis:', parseError);
    }
    
    return {
      document_type: "general",
      main_topic: "Unknown",
      key_points: [],
      sentiment: "neutral",
      complexity: "intermediate",
      suggested_categories: ["uncategorized"]
    };
    
  } catch (error) {
    console.error('Error analyzing document:', error);
    return null;
  }
}

// Initialize on import
initGemini();

export default {
  generateMetadata,
  extractTextFromImage,
  generateEmbedding,
  analyzeDocument
};
