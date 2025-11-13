import { Router } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyFirebaseToken } from "../config/firebaseAdmin.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024, // 12MB cap for private sessions
  },
});

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

// Temporary in-memory session storage (cleared on server restart)
const sessionMemory = new Map();

function sanitizeContent(rawText) {
  if (!rawText) return "";
  return rawText.replace(/\s+/g, " ").trim();
}

async function extractTextFromFile(file) {
  if (!file) return "";

  const { buffer, mimetype = "", originalname = "" } = file;
  const normalizedType = mimetype.toLowerCase();
  const normalizedName = originalname.toLowerCase();

  if (normalizedType === "application/pdf" || normalizedName.endsWith(".pdf")) {
    try {
      const pdfData = await pdfParse(buffer);
      return pdfData.text || "";
    } catch (error) {
      console.warn("Failed to parse PDF in incognito mode:", error);
      const parseError = new Error("We couldn't read that PDF. Try a different file or convert it to text.");
      parseError.code = "parse-error";
      throw parseError;
    }
  }

  if (normalizedType === "text/plain" || normalizedName.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  if (
    normalizedType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    normalizedName.endsWith(".docx")
  ) {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      return value || "";
    } catch (error) {
      console.warn("Failed to parse DOCX in incognito mode:", error);
      const parseError = new Error("We couldn't read that DOCX file. Try a different file or convert it to text.");
      parseError.code = "parse-error";
      throw parseError;
    }
  }

  const unsupportedError = new Error("Unsupported file type. Use PDF, TXT, or DOCX.");
  unsupportedError.code = "unsupported-file";
  throw unsupportedError;
}

function buildFallbackTags(text, limit = 10) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4);

  const counts = new Map();

  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function buildWordCloud(text, limit = 20) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const counts = new Map();
  const maxCount = words.length;

  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const max = sorted[0]?.[1] || 1;

  return sorted.map(([word, count]) => ({
    text: word,
    weight: count / max,
  }));
}

function extractBasicEntities(text) {
  // Simple NER using patterns (fallback when AI is unavailable)
  const entities = [];
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const urlPattern = /https?:\/\/[^\s]+/g;
  const datePattern = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;

  const emails = text.match(emailPattern) || [];
  const urls = text.match(urlPattern) || [];
  const dates = text.match(datePattern) || [];

  emails.forEach((email) => {
    entities.push({ label: email, type: "EMAIL" });
  });

  urls.forEach((url) => {
    entities.push({ label: url, type: "URL" });
  });

  dates.forEach((date) => {
    entities.push({ label: date, type: "DATE" });
  });

  return entities.slice(0, 10);
}

function analyzeSentiment(text) {
  // Simple sentiment analysis (fallback)
  const positiveWords = ["good", "great", "excellent", "amazing", "wonderful", "positive", "happy", "success"];
  const negativeWords = ["bad", "terrible", "awful", "negative", "sad", "failure", "problem", "error"];

  const lowerText = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach((word) => {
    if (lowerText.includes(word)) positiveCount++;
  });

  negativeWords.forEach((word) => {
    if (lowerText.includes(word)) negativeCount++;
  });

  const total = positiveCount + negativeCount;
  if (total === 0) {
    return { label: "Neutral", score: 0.5 };
  }

  const score = positiveCount / total;
  let label = "Neutral";
  if (score > 0.6) label = "Positive";
  else if (score < 0.4) label = "Negative";

  return { label, score };
}

async function generateEnhancedAnalysis(content) {
  if (!genAI) {
    return {
      summary: "AI service is not configured. Please set GEMINI_API_KEY to enable full analysis.",
      tags: buildFallbackTags(content),
      entities: extractBasicEntities(content),
      topics: buildFallbackTags(content, 5),
      sentiment: analyzeSentiment(content),
      wordCloud: buildWordCloud(content),
      meta: { provider: "fallback" },
    };
  }

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `
You are assisting in a private, non-persistent AI session. Analyze the provided content comprehensively.

Return a JSON object with this exact structure:
{
  "summary": "<3-4 sentence summary>",
  "tags": ["keyword1", "keyword2", "keyword3", ...],
  "entities": [
    {"label": "Entity Name", "type": "PERSON|ORG|LOCATION|DATE|OTHER"}
  ],
  "topics": ["topic1", "topic2", "topic3", ...],
  "relations": [
    {"from": "Entity1", "to": "Entity2", "type": "relationship type"}
  ],
  "sentiment": {
    "label": "Positive|Negative|Neutral",
    "score": 0.0-1.0
  }
}

Content:
${content.slice(0, 15000)}
`.trim();

  try {
    const completion = await model.generateContent(prompt);
    const rawText = completion?.response?.text()?.trim() || "";

    const cleaned = rawText.replace(/```json|```/gi, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;

    try {
      const parsed = JSON.parse(jsonStr);

      return {
        summary: parsed.summary || "No summary generated.",
        tags: Array.isArray(parsed.tags) ? parsed.tags : buildFallbackTags(content),
        entities: Array.isArray(parsed.entities) ? parsed.entities : extractBasicEntities(content),
        topics: Array.isArray(parsed.topics) ? parsed.topics : buildFallbackTags(content, 5),
        relations: Array.isArray(parsed.relations) ? parsed.relations : [],
        sentiment: parsed.sentiment || analyzeSentiment(content),
        wordCloud: buildWordCloud(content),
        meta: { provider: "gemini" },
      };
    } catch (parseError) {
      console.warn("Failed to parse Gemini JSON, using fallback:", parseError);
      return {
        summary: cleaned || "No summary generated.",
        tags: buildFallbackTags(content),
        entities: extractBasicEntities(content),
        topics: buildFallbackTags(content, 5),
        relations: [],
        sentiment: analyzeSentiment(content),
        wordCloud: buildWordCloud(content),
        meta: { provider: "gemini", note: "JSON parse fallback" },
      };
    }
  } catch (error) {
    console.error("Gemini request failed; using fallback analysis.", error);
    return {
      summary:
        "Unable to contact the AI service right now. Here are the most frequent terms from your input.",
      tags: buildFallbackTags(content),
      entities: extractBasicEntities(content),
      topics: buildFallbackTags(content, 5),
      relations: [],
      sentiment: analyzeSentiment(content),
      wordCloud: buildWordCloud(content),
      meta: { provider: "fallback", reason: "gemini-error" },
    };
  }
}

router.post("/process", upload.single("file"), async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  try {
    const decoded = await verifyFirebaseToken(token);
    const userId = decoded.uid;

    try {
      const fileText = await extractTextFromFile(req.file);
      const inputText = sanitizeContent(req.body.textInput);

      const combined = sanitizeContent([fileText, inputText].filter(Boolean).join(" "));

      if (!combined) {
        return res.status(400).json({ error: "No file or text content provided." });
      }

      const trimmed = combined.length > 15000 ? combined.slice(0, 15000) : combined;

      const analysis = await generateEnhancedAnalysis(trimmed);

      // Store in temporary session memory (not persistent)
      const sessionId = `${userId}-${Date.now()}`;
      sessionMemory.set(sessionId, {
        content: trimmed,
        analysis,
        timestamp: Date.now(),
      });

      // Clean old sessions (older than 1 hour)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      for (const [key, value] of sessionMemory.entries()) {
        if (value.timestamp < oneHourAgo) {
          sessionMemory.delete(key);
        }
      }

      return res.json({
        ...analysis,
        sessionId,
      });
    } catch (error) {
      if (error.code === "unsupported-file" || error.code === "parse-error") {
        return res.status(400).json({ error: error.message });
      }

      console.error("Incognito processing error:", error);
      return res.status(500).json({ error: "Failed to process content with AI." });
    }
  } catch (error) {
    const statusCode = error.code === "auth/missing-token" ? 401 : 403;
    return res.status(statusCode).json({ error: error.message });
  }
});

router.post("/chat", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  try {
    const decoded = await verifyFirebaseToken(token);
    const { message, context } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    if (!context) {
      return res.status(400).json({ error: "No context available. Please process content first." });
    }

    if (!genAI) {
      return res.json({
        response:
          "AI chat is not configured. Please set GEMINI_API_KEY to enable chat functionality.",
      });
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Build context from session
    let contextText = "";
    if (context.file) {
      contextText += `File: ${context.file.name}\n`;
    }
    if (context.text) {
      contextText += `Text content: ${context.text.slice(0, 5000)}\n`;
    }

    const chatPrompt = `
You are an AI assistant in a private, temporary session. The user is asking about content they've uploaded.

Context:
${contextText}

User question: ${message}

Provide a helpful, concise response based on the context. Remember this is a temporary session - nothing is saved.
`.trim();

    try {
      const completion = await model.generateContent(chatPrompt);
      const response = completion?.response?.text()?.trim() || "I couldn't generate a response.";

      return res.json({ response });
    } catch (error) {
      console.error("Chat request failed:", error);
      return res.json({
        response:
          "I'm having trouble processing your request right now. Please try again in a moment.",
      });
    }
  } catch (error) {
    const statusCode = error.code === "auth/missing-token" ? 401 : 403;
    return res.status(statusCode).json({ error: error.message });
  }
});

export default router;
