import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ShieldOff,
  Lock,
  FileText,
  X,
  Send,
  Sparkles,
  Tag,
  Users,
  Layers,
  TrendingUp,
  Heart,
  Cloud,
  RefreshCw,
  MessageSquare,
  FileUp,
  Loader2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import "../styles/incognito.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ACCEPTED_TYPES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".docx"];

const LOADER_MESSAGES = [
  "Understanding your document…",
  "Extracting concepts…",
  "Analyzing structure…",
  "Identifying key insights…",
  "Processing with AI…",
];

const SUGGESTIONS = [
  { id: "simplify", label: "Summarize again in simpler language", action: "simplify" },
  { id: "questions", label: "Create 5 key questions", action: "questions" },
  { id: "flashcards", label: "Make flashcards", action: "flashcards" },
  { id: "insights", label: "Extract actionable insights", action: "insights" },
];

export default function IncognitoVault() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState(LOADER_MESSAGES[0]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [sessionContent, setSessionContent] = useState(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const preview = text.slice(0, 500);
        setFilePreview({ name: selectedFile.name, size: selectedFile.size, preview: preview });
      };
      if (selectedFile.type === "text/plain" || selectedFile.name.endsWith(".txt")) {
        reader.readAsText(selectedFile);
      } else {
        setFilePreview({ name: selectedFile.name, size: selectedFile.size, preview: null });
      }
    } else {
      setFilePreview(null);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (isProcessing) {
      let index = 0;
      const interval = setInterval(() => {
        index = (index + 1) % LOADER_MESSAGES.length;
        setLoaderMessage(LOADER_MESSAGES[index]);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const resetSession = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setTextInput("");
    setResult(null);
    setError(null);
    setChatMessages([]);
    setChatInput("");
    setSessionContent(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const normalizedType = file.type?.toLowerCase() || "";
    const normalizedName = file.name?.toLowerCase() || "";
    const hasAllowedType = normalizedType ? ACCEPTED_TYPES.includes(normalizedType) : false;
    const hasAllowedExtension = ACCEPTED_EXTENSIONS.some((ext) => normalizedName.endsWith(ext));

    if (!hasAllowedType && !hasAllowedExtension) {
      setError("Only PDF, TXT, or DOCX files are allowed.");
      event.target.value = "";
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleProcess = async () => {
    if (!currentUser) {
      setError("You must be signed in to use Incognito Vault.");
      return;
    }

    if (!selectedFile && !textInput.trim()) {
      setError("Please upload a file or enter some text first.");
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      const token = await currentUser.getIdToken();
      const formData = new FormData();

      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      if (textInput.trim()) {
        formData.append("textInput", textInput.trim());
      }

      const response = await axios.post(`${API_URL}/incognito/process`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setResult(response.data);
      setSessionContent({
        file: selectedFile ? { name: selectedFile.name, size: selectedFile.size } : null,
        text: textInput.trim() || null,
      });
    } catch (err) {
      console.error("Incognito processing failed:", err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Unable to process content right now. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChat = async (message) => {
    if (!currentUser || !sessionContent) {
      setError("Please process content first before chatting.");
      return;
    }

    try {
      setIsChatting(true);
      setError(null);

      const token = await currentUser.getIdToken();
      const response = await axios.post(
        `${API_URL}/incognito/chat`,
        {
          message,
          context: sessionContent,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: message },
        { role: "assistant", content: response.data.response },
      ]);
      setChatInput("");
    } catch (err) {
      console.error("Chat failed:", err);
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Unable to chat right now. Please try again.");
      }
    } finally {
      setIsChatting(false);
    }
  };

  const handleSuggestion = async (action) => {
    if (!sessionContent) {
      setError("Please process content first.");
      return;
    }

    const prompts = {
      simplify: "Summarize this content again in simpler, more accessible language.",
      questions: "Create 5 key questions that someone should ask about this content.",
      flashcards: "Create flashcards format (question and answer pairs) from this content.",
      insights: "Extract actionable insights and key takeaways from this content.",
    };

    await handleChat(prompts[action]);
  };

  const handleEndSession = () => {
    resetSession();
    navigate("/dashboard", { replace: true });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <motion.main
      className="incognito-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="incognito-parallax-bg"></div>
      <div className="incognito-shell">
        <motion.header
          className="incognito-header"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="header-left">
            <div className="header-icons">
              <Lock size={20} />
              <ShieldOff size={20} />
            </div>
            <div>
              <h1 className="glow-text">Incognito Vault</h1>
              <p className="header-subtitle">AI Memory Disabled — Temporary Session Only</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="clear-session-btn" onClick={resetSession}>
              <RefreshCw size={16} />
              Clear Session
            </button>
            <button className="end-session" onClick={handleEndSession}>
              End Session
            </button>
          </div>
        </motion.header>

        <motion.div
          className="private-note"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Sparkles size={16} />
          <span>You're in Incognito Vault Mode — nothing you do here will be saved.</span>
        </motion.div>

        <AnimatePresence>
          {isProcessing && (
            <motion.div
              className="premium-loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="loader-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p className="loader-text">{loaderMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="incognito-body">
          <motion.div
            className="input-panel"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {filePreview && (
              <motion.div
                className="file-preview-card"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <div className="file-preview-header">
                  <FileText size={18} />
                  <span className="file-preview-name">{filePreview.name}</span>
                  <button
                    className="file-preview-remove"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="file-preview-details">
                  <span>{formatFileSize(filePreview.size)}</span>
                </div>
                {filePreview.preview && (
                  <div className="file-preview-extract">
                    <p>{filePreview.preview}...</p>
                  </div>
                )}
                <button
                  className="file-preview-replace"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace File
                </button>
              </motion.div>
            )}

            {!filePreview && (
              <div className="upload-zone">
                <label htmlFor="incognito-file" className="upload-label">
                  <FileUp size={32} />
                  <span className="glow-border">Upload a file</span>
                  <span className="upload-hint">Accepted: PDF, TXT, DOCX</span>
                </label>
                <input
                  ref={fileInputRef}
                  id="incognito-file"
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={handleFileChange}
                />
              </div>
            )}

            <div className="text-zone">
              <label htmlFor="incognito-text">Text Input</label>
              <textarea
                id="incognito-text"
                placeholder="Paste or type text to process privately..."
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
              />
            </div>

            {error && (
              <motion.div
                className="incognito-error"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {error}
              </motion.div>
            )}

            <button
              className="process-button"
              onClick={handleProcess}
              disabled={isProcessing || (!selectedFile && !textInput.trim())}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Process with AI
                </>
              )}
            </button>

            {result && (
              <motion.div
                className="suggestions-panel"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <h3>Quick Actions</h3>
                <div className="suggestions-grid">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      className="suggestion-btn"
                      onClick={() => handleSuggestion(suggestion.action)}
                      disabled={isChatting}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {result && (
              <motion.div
                className="chat-zone"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="chat-header">
                  <MessageSquare size={18} />
                  <span>AI Chat</span>
                </div>
                <div className="chat-messages">
                  {chatMessages.length === 0 ? (
                    <div className="chat-empty">
                      <p>Ask questions about your content</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div key={idx} className={`chat-message ${msg.role}`}>
                        <p>{msg.content}</p>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="chat-input-wrapper">
                  <input
                    type="text"
                    placeholder="Ask anything about your content..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && chatInput.trim()) {
                        handleChat(chatInput);
                      }
                    }}
                    disabled={isChatting}
                  />
                  <button
                    className="chat-send"
                    onClick={() => chatInput.trim() && handleChat(chatInput)}
                    disabled={isChatting || !chatInput.trim()}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>

          <motion.div
            className="results-panel"
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            {result ? (
              <div className="results-content">
                <motion.div
                  className="result-section summary-section"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="section-header">
                    <Sparkles size={18} />
                    <h2>Summary</h2>
                  </div>
                  <p className="summary-text">{result.summary}</p>
                </motion.div>

                {result.tags && result.tags.length > 0 && (
                  <motion.div
                    className="result-section tags-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="section-header">
                      <Tag size={18} />
                      <h2>Keywords & Tags</h2>
                    </div>
                    <div className="tag-list">
                      {result.tags.map((tag, idx) => (
                        <motion.span
                          key={idx}
                          className="tag-chip"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.3 + idx * 0.05 }}
                        >
                          {tag}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {result.entities && result.entities.length > 0 && (
                  <motion.div
                    className="result-section entities-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="section-header">
                      <Users size={18} />
                      <h2>Entities</h2>
                    </div>
                    <div className="entities-list">
                      {result.entities.map((entity, idx) => (
                        <div key={idx} className="entity-item">
                          <span className="entity-label">{entity.label}</span>
                          <span className="entity-type">{entity.type}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {result.topics && result.topics.length > 0 && (
                  <motion.div
                    className="result-section topics-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="section-header">
                      <Layers size={18} />
                      <h2>Topics</h2>
                    </div>
                    <div className="topics-list">
                      {result.topics.map((topic, idx) => (
                        <div key={idx} className="topic-item">{topic}</div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {result.relations && result.relations.length > 0 && (
                  <motion.div
                    className="result-section relations-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="section-header">
                      <TrendingUp size={18} />
                      <h2>Relations</h2>
                    </div>
                    <div className="relations-list">
                      {result.relations.map((rel, idx) => (
                        <div key={idx} className="relation-item">
                          <span className="relation-from">{rel.from}</span>
                          <span className="relation-arrow">→</span>
                          <span className="relation-to">{rel.to}</span>
                          <span className="relation-type">{rel.type}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {result.sentiment && (
                  <motion.div
                    className="result-section sentiment-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <div className="section-header">
                      <Heart size={18} />
                      <h2>Tone & Sentiment</h2>
                    </div>
                    <div className="sentiment-display">
                      <div className="sentiment-score">
                        <span className="sentiment-label">{result.sentiment.label}</span>
                        <div className="sentiment-bar">
                          <div
                            className="sentiment-fill"
                            style={{ width: `${result.sentiment.score * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {result.wordCloud && result.wordCloud.length > 0 && (
                  <motion.div
                    className="result-section wordcloud-section"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                  >
                    <div className="section-header">
                      <Cloud size={18} />
                      <h2>Word Cloud</h2>
                    </div>
                    <div className="wordcloud-visual">
                      {result.wordCloud.map((word, idx) => (
                        <span
                          key={idx}
                          className="wordcloud-word"
                          style={{
                            fontSize: `${12 + word.weight * 8}px`,
                            opacity: 0.7 + word.weight * 0.3,
                          }}
                        >
                          {word.text}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <Sparkles size={48} />
                <p>No AI response yet.</p>
                <p>Upload a file or add text, then tap "Process with AI".</p>
              </div>
            )}
          </motion.div>
        </section>
      </div>
    </motion.main>
  );
}
