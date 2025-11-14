import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

let client;
let textModel;
let visionModel;
let embeddingModel;

// Initialize Gemini AI (new API)
export function initGemini() {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "mock") {
      console.log("🔧 Running Gemini in mock mode");
      return initMockGemini();
    }

    client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    textModel = client.getGenerativeModel({
      model: process.env.GEMINI_MODEL, // gemini-1.5-flash
    });

    visionModel = client.getGenerativeModel({
      model: process.env.GEMINI_MODEL,
    });

    embeddingModel = client.getGenerativeModel({
      model: "text-embedding-004",
    });

    console.log("✅ Gemini 1.5 initialized");
    return true;
  } catch (err) {
    console.error("Gemini init error:", err);
    return initMockGemini();
  }
}

// Mock mode
function initMockGemini() {
  textModel = {
    generateContent: async () => ({
      response: {
        text: () =>
          JSON.stringify({
            summary: "Mock summary",
            tags: ["mock"],
            entities: [],
            relations: [],
          }),
      },
    }),
  };

  embeddingModel = {
    embedContent: async () => ({
      embedding: { values: Array(768).fill(0) },
    }),
  };

  visionModel = textModel;
  return true;
}

// --------------------------
// UPDATED GEMINI API METHODS
// --------------------------

export async function generateMetadata(text) {
  try {
    const prompt = `
Analyze this text and return JSON only.
Text: """${text}"""
Return:
{
  "summary": "...",
  "tags": [...],
  "entities": [...],
  "relations": [...]
}`;

    const result = await textModel.generateContent(prompt);
    const raw = result.response.text();

    return JSON.parse(raw);
  } catch (err) {
    console.error("Metadata Error:", err);
    return {
      summary: text.substring(0, 120) + "...",
      tags: ["error-processing"],
      entities: [],
      relations: [],
    };
  }
}

export async function analyzeDocument(fullText, fileName) {
  try {
    const prompt = `
Analyze document '${fileName}'. Return JSON only:
{
  "document_type": "...",
  "main_topic": "...",
  "key_points": [...],
  "sentiment": "...",
  "complexity": "...",
  "suggested_categories": [...]
}
Content: """${fullText.substring(0, 3000)}..."""
`;

    const result = await textModel.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (err) {
    console.error("Analyze Document Error:", err);
    return {
      document_type: "document",
      main_topic: fileName,
      key_points: [],
      sentiment: "neutral",
      complexity: "intermediate",
      suggested_categories: ["general"],
    };
  }
}

// Vision (works same in 1.5)
export async function extractTextFromImage(imageBuffer, mimeType) {
  try {
    const result = await visionModel.generateContent([
      "Extract all text from this image.",
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      },
    ]);

    return result.response.text();
  } catch (err) {
    console.error("Vision Error:", err);
    return null;
  }
}

// Embeddings
export async function generateEmbedding(text) {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    console.error("Embedding Error:", err);
    return Array(768).fill(0);
  }
}

// Simple text generation (for email classifier, etc.)
export async function generateText(prompt) {
  try {
    const result = await textModel.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error("Generate Text Error:", err);
    return "Error generating text";
  }
}

initGemini();

export default {
  generateMetadata,
  extractTextFromImage,
  generateEmbedding,
  analyzeDocument,
  generateText,
};
