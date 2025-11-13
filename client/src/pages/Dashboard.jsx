import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "../styles/dashboard.css";

const sidebarItems = ["Memories", "Chat", "Graph", "Insights", "Incognito Vault"];

const cards = [
  { title: "Recent Notes", desc: "Upload files to populate your memories.", icon: "📝" },
  { title: "AI Insights", desc: "Summaries and connections appear here.", icon: "✨" },
  { title: "Knowledge Graph", desc: "Interactive nodes and relationships.", icon: "🕸️" },
  { title: "Chat with Vault", desc: "Converse with your memories in natural language.", icon: "💬" },
];

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("Memories");

  const handleSidebarClick = (item) => {
    setActiveItem(item);
    if (item === "Graph") {
      navigate("/knowledge-graph");
    } else if (item === "Incognito Vault") {
      navigate("/incognito");
    }
  };

  const handleCardClick = (cardTitle) => {
    if (cardTitle === "Knowledge Graph") {
      navigate("/knowledge-graph");
    }
  };

  return (
    <motion.main
      className="page container dashboard"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.5 }}
    >
      <motion.aside
        className="sidebar"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="side-card glass">
          <strong>Vault</strong>
          <div className="side-nav">
            {sidebarItems.map((item) => (
              <div
                key={item}
                className={`side-item ${activeItem === item ? "active" : ""}`}
                onClick={() => handleSidebarClick(item)}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </motion.aside>

      <section className="main-panel">
        <motion.div
          className="welcome-card glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h2 style={{ margin: 0 }}>
            Welcome back to your Vault{currentUser?.email ? `, ${currentUser.email.split('@')[0]}` : ''}.
          </h2>
          <p className="muted" style={{ marginTop: 8 }}>
            Your knowledge graph is updating in the background.
          </p>
        </motion.div>

        <div className="grid">
          {cards.map((card, index) => (
            <motion.div
              key={card.title}
              className="card glass card-tilt"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              onClick={() => handleCardClick(card.title)}
              style={{ cursor: card.title === "Knowledge Graph" ? "pointer" : "default" }}
            >
              <div className="card-icon">{card.icon}</div>
              <h4 className="card-title">{card.title}</h4>
              <p className="muted">{card.desc}</p>
              {card.title === "Knowledge Graph" && (
                <>
                  <div className="graph-preview">
                    {/* Replace with your graph preview: place file at /public/assets/graph-preview.png */}
                    {/* <img src="/assets/graph-preview.png" alt="Graph preview" /> */}
                    <div className="graph-placeholder">
                      <div className="graph-node"></div>
                      <div className="graph-node"></div>
                      <div className="graph-node"></div>
                    </div>
                  </div>
                  <button className="explore-btn">Explore Graph →</button>
                </>
              )}
            </motion.div>
          ))}
        </div>
      </section>
    </motion.main>
  );
}


