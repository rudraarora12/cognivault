import { Router } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { verifyFirebaseToken } from "../config/firebaseAdmin.js";
import geminiService from "../services/gemini.service.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024, // 12MB cap for private sessions
  },
});


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

function generateMockChatResponse(message, context) {
  // Generate helpful mock responses based on message content
  const lowerMessage = message.toLowerCase();
  const hasContext = context && (context.file || context.text);
  
  // Handle common question patterns
  if (lowerMessage.includes("question") || lowerMessage.includes("ask")) {
    if (hasContext) {
      return `Here are 5 key questions you should consider about your content:

1. What is the main purpose or objective of this content?
2. What are the key concepts or ideas being presented?
3. How does this information relate to your goals or interests?
4. What actions or next steps are suggested or implied?
5. What additional information would help you better understand this topic?

These questions can help you extract the most value from the content you've processed.`;
    }
    return `Here are 5 key questions you should consider:

1. What is the main purpose or objective of this content?
2. What are the key concepts or ideas being presented?
3. How does this information relate to your goals or interests?
4. What actions or next steps are suggested or implied?
5. What additional information would help you better understand this topic?

To get questions specific to your content, please process a file or text first using "Process with AI".`;
  }
  
  if (lowerMessage.includes("summar") || lowerMessage.includes("simpl")) {
    return `Based on the content you've provided, here's a simplified summary:

The content covers key concepts and information relevant to your query. The main points include important details that address your question. To get a more detailed summary, please ensure you've processed your content first using the "Process with AI" button above.

For a more comprehensive analysis, make sure to upload your file or enter text in the input area.`;
  }
  
  if (lowerMessage.includes("step") || lowerMessage.includes("break")) {
    return `Here's a step-by-step breakdown:

1. **Review the content** - Start by understanding the main topic
2. **Identify key points** - Look for important concepts or ideas
3. **Organize information** - Group related information together
4. **Apply insights** - Consider how this relates to your needs
5. **Take action** - Use the information to move forward

This structured approach can help you make the most of the processed content.`;
  }
  
  if (lowerMessage.includes("example") || lowerMessage.includes("illustrate")) {
    return `Here are some examples to illustrate the concept:

- **Example 1**: A practical application of this concept would be...
- **Example 2**: Another way to think about this is...
- **Example 3**: In real-world scenarios, this might look like...

These examples demonstrate how the concepts from your content can be applied in practice. For more specific examples, please ensure your content has been processed first.`;
  }
  
  if (lowerMessage.includes("clarif") || lowerMessage.includes("explain")) {
    return `Let me explain this in a clear and simple way:

The content you've processed contains information that addresses your question. The key points are presented in a way that should help you understand the topic better.

To get a more detailed explanation tailored to your specific content, make sure you've uploaded and processed your file or text using the "Process with AI" feature above.`;
  }
  
  if (lowerMessage.includes("flashcard")) {
    return `Here's a flashcard format based on your content:

**Question 1**: What is the main topic?
**Answer**: [Key concept from your content]

**Question 2**: What are the important details?
**Answer**: [Relevant information]

**Question 3**: How can this be applied?
**Answer**: [Practical application]

For more specific flashcards, please process your content first.`;
  }
  
  if (lowerMessage.includes("insight") || lowerMessage.includes("takeaway")) {
    return `Key insights and takeaways:

1. **Main Insight**: The content provides valuable information relevant to your query
2. **Actionable Point**: Consider how this relates to your specific needs
3. **Key Learning**: There are important concepts to understand here

For more detailed insights, make sure to process your content using the "Process with AI" button.`;
  }
  
  // Default helpful response
  return `I understand you're asking about: "${message}"

To provide you with the most accurate and helpful response, I'd need to analyze the content you've uploaded. Please make sure you've:

1. Uploaded a file (PDF, TXT, or DOCX) or entered text
2. Clicked "Process with AI" to analyze the content
3. Then ask your question again

Once your content is processed, I can give you detailed answers based on the specific information in your document.`;
}

async function generateEnhancedAnalysis(content) {
  try {
    const metadata = await geminiService.generateMetadata(content.slice(0, 15000));
    
    return {
      summary: metadata.summary || "No summary generated.",
      tags: Array.isArray(metadata.tags) ? metadata.tags : buildFallbackTags(content),
      entities: Array.isArray(metadata.entities) ? metadata.entities : extractBasicEntities(content),
      topics: Array.isArray(metadata.tags) ? metadata.tags : buildFallbackTags(content, 5),
      relations: Array.isArray(metadata.relations) ? metadata.relations : [],
      sentiment: analyzeSentiment(content),
      wordCloud: buildWordCloud(content),
      meta: { provider: "gemini" },
    };
  } catch (error) {
    console.error("Gemini request failed; using fallback analysis.", error);
    
    // Generate a helpful summary even when AI fails
    const words = content.split(/\s+/).filter(w => w.length > 3);
    const wordCount = words.length;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const firstFewSentences = sentences.slice(0, 3).join(". ").trim();
    
    const summary = firstFewSentences 
      ? `${firstFewSentences}${firstFewSentences.endsWith('.') ? '' : '.'} This content contains approximately ${wordCount} words and covers multiple topics.`
      : `Your content has been processed successfully. It contains approximately ${wordCount} words. Key terms and concepts have been extracted for your review.`;
    
    return {
      summary,
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

    const startTime = Date.now();
    
    // Build context from session if available
    let contextText = "";
    if (context) {
      if (context.file) {
        contextText += `File: ${context.file.name}\n`;
      }
      if (context.text) {
        contextText += `Text content: ${context.text.slice(0, 5000)}\n`;
      }
    }

    const chatPrompt = contextText
      ? `You are an AI assistant in a private, temporary session. The user is asking about content they've uploaded.\n\nContext:\n${contextText}\n\nUser question: ${message}\n\nProvide a helpful, concise response based on the context. Remember this is a temporary session - nothing is saved.`
      : `You are an AI assistant in a private, temporary session. The user is asking a question.\n\nUser question: ${message}\n\nProvide a helpful, concise response. Remember this is a temporary session - nothing is saved.`;

    try {
      const reply = await geminiService.generateText(chatPrompt);
      const duration_ms = Date.now() - startTime;

      return res.json({
        reply: reply || "I couldn't generate a response.",
        metadata: {
          model: "gemini",
          duration_ms,
        },
      });
    } catch (error) {
      console.error("Chat request failed, using fallback:", error);
      const duration_ms = Date.now() - startTime;
      
      // Fallback to mock response instead of error - graceful degradation
      const mockReply = generateMockChatResponse(message, context);
      
      return res.json({
        reply: mockReply,
        metadata: {
          model: "local",
          duration_ms,
        },
      });
    }
  } catch (error) {
    // Handle authentication errors
    if (error.code === "auth/missing-token" || error.code === "auth/invalid-token") {
      return res.status(401).json({ error: "Invalid or expired authorization token." });
    }
    return res.status(403).json({ error: error.message || "Authorization failed." });
  }
});

export default router;
