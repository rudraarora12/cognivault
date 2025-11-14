import { motion } from "framer-motion";
import HeroSection from "./HeroSection";
import ExperienceSection from "./ExperienceSection";
import HowItWorks from "./HowItWorks";
import FeatureGrid from "./FeatureGrid";
import TestimonialsCarousel from "./TestimonialsCarousel";
import heroImage from "../assets/home.jpeg";

const momentumStats = [
  { label: "Knowledge captured", value: "4.8M+" },
  { label: "Teams collaborating", value: "12K+" },
  { label: "Avg. recall time", value: "680ms" },
  { label: "Proactive insights", value: "97.2%" },
];

const spotlightFeatures = [
  "Secure by design",
  "Graph-powered memory",
  "AI copilots for every team",
];

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      
      {/* Vision Statement */}
      <section id="about" className="vision">
        <div className="container vision-wrap">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="h1" style={{ marginTop: 0, marginBottom: 16 }}>
              A second brain that learns and grows with you.
            </h2>
            <p className="subtitle" style={{ marginTop: 0, marginBottom: 28 }}>
              CogniVault is a living archive of your knowledge. It watches the threads between every
              note, voice memo, article, and meeting recap — then illuminates the moments you need in
              an instant.
            </p>
            <div className="vision-highlights">
              {[
                {
                  heading: "Remember the why",
                  body: "Map ideas to decisions, sources, and people so context is never lost.",
                },
                {
                  heading: "Surface hidden patterns",
                  body: "Our AI surfaces cross-topic insights and timelines you didn't know existed.",
                },
                {
                  heading: "Trust the vault",
                  body: "Zero-knowledge encryption keeps every memory private, synced across devices.",
                },
              ].map((item) => (
                <div key={item.heading} className="vision-card glass">
                  <span className="vision-dot" />
                  <div>
                    <h3>{item.heading}</h3>
                    <p>{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="vision-visual"
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.div
              className="vision-image-wrapper glass"
              whileHover={{ scale: 1.02, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <motion.img
                src={heroImage}
                alt="Knowledge graph visualization"
                className="vision-image"
                animate={{
                  y: [0, -10, 0],
                  rotate: [0, 1, -1, 0],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <div className="vision-image-glow" />
            </motion.div>

            <motion.div
              className="vision-metrics"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.3 }}
            >
              {[
                { label: "Files understood", value: "2.4M+" },
                { label: "Conversations answered", value: "89K" },
                { label: "Context retrieval speed", value: "0.6s" },
              ].map((metric) => (
                <div key={metric.label} className="metric-card neon glass">
                  <span className="metric-value">{metric.value}</span>
                  <span className="metric-label">{metric.label}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Incognito Search Section */}
      <section id="incognito" style={{
        padding: '6rem 1.5rem',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)'
      }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: window.innerWidth >= 1024 ? 'repeat(2, minmax(0, 1fr))' : '1fr',
            gap: '4rem', 
            alignItems: 'center' 
          }}>

            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '50%',
                  background: '#c084fc',
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }} />
                <span style={{ color: '#d8b4fe', fontSize: '0.875rem', fontWeight: 500 }}>
                  Privacy Layer
                </span>
              </div>

              <h2 style={{
                fontSize: 'clamp(3rem, 6vw, 3.75rem)',
                fontWeight: 700,
                lineHeight: 1.25,
                marginBottom: '1.5rem'
              }}>
                Search Anything in  
                <span style={{
                  backgroundImage: 'linear-gradient(to right, #c084fc, #ec4899)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent'
                }}>
                  {" "}Incognito Mode
                </span>
              </h2>

              <p style={{
                fontSize: '1.125rem',
                color: '#cbd5e1',
                lineHeight: 1.625,
                marginBottom: '2rem'
              }}>
                Use CogniVault's Incognito Search to look up anything without leaving a trace.  
                No history saved. No prompts recorded. No linking to your vault.  
                Pure privacy, powered by the same intelligence.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                <button style={{
                  padding: '1rem 2rem',
                  backgroundImage: 'linear-gradient(to right, #a855f7, #ec4899)',
                  borderRadius: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}>
                  Try Incognito Search
                </button>

                <button style={{
                  padding: '1rem 2rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.75rem',
                  fontWeight: 600,
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}>
                  Learn How It Works
                </button>
              </div>
            </motion.div>

            {/* Right Visual */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              style={{ position: 'relative' }}
            >
              <div style={{
                position: 'relative',
                background: 'rgba(15, 23, 42, 0.5)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(51, 65, 85, 0.4)',
                borderRadius: '1rem',
                padding: '2rem',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}>
                
                {/* Background Glow */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: 'linear-gradient(to bottom right, rgba(147, 51, 234, 0.1), rgba(236, 72, 153, 0.1))',
                  borderRadius: '1rem'
                }} />

                {/* Mock UI */}
                <div style={{ position: 'relative', display: 'grid', gap: '1.5rem' }}>
                  
                  {/* Incognito Bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(51, 65, 85, 0.4)',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 1rem'
                  }}>
                    <div style={{
                      width: '0.75rem',
                      height: '0.75rem',
                      background: '#c084fc',
                      borderRadius: '50%',
                      boxShadow: '0 4px 6px -1px rgba(168, 85, 247, 0.4)'
                    }} />
                    <input
                      disabled
                      placeholder="Search privately..."
                      style={{
                        background: 'transparent',
                        color: '#cbd5e1',
                        fontSize: '0.875rem',
                        width: '100%',
                        border: 'none',
                        outline: 'none'
                      }}
                    />
                    <div style={{
                      padding: '0.25rem 0.75rem',
                      background: 'rgba(147, 51, 234, 0.2)',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#d8b4fe',
                      fontSize: '0.75rem'
                    }}>
                      Incognito
                    </div>
                  </div>

                  {/* Result Blocks */}
                  <div style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    borderRadius: '0.5rem',
                    padding: '1rem'
                  }}>
                    <h4 style={{ color: '#d8b4fe', fontSize: '0.875rem', margin: '0 0 0.25rem 0' }}>
                      You Searched
                    </h4>
                    <p style={{ color: '#e2e8f0', margin: 0 }}>
                      "Best resources to learn AI agents privately"
                    </p>
                  </div>

                  <div style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    borderRadius: '0.5rem',
                    padding: '1rem'
                  }}>
                    <h4 style={{ color: '#d8b4fe', fontSize: '0.875rem', margin: '0 0 0.25rem 0' }}>
                      Visibility
                    </h4>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0.25rem 0' }}>
                      Not saved to history
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0.25rem 0' }}>
                      Not stored in your vault
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0.25rem 0' }}>
                      Not linked to timeline
                    </p>
                  </div>

                  <div style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    borderRadius: '0.5rem',
                    padding: '1rem'
                  }}>
                    <h4 style={{ color: '#d8b4fe', fontSize: '0.875rem', margin: '0 0 0.25rem 0' }}>
                      Summary (AI Generated)
                    </h4>
                    <p style={{ color: '#e2e8f0', margin: 0 }}>
                      Here are the top private-friendly AI learning sources and bootcamps...
                    </p>
                  </div>
                </div>
              </div>

              {/* Floating Badge */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: 'absolute',
                  top: '-1.5rem',
                  right: '-1.5rem',
                  backgroundImage: 'linear-gradient(to bottom right, #a855f7, #ec4899)',
                  borderRadius: '1rem',
                  padding: '1rem',
                  boxShadow: '0 10px 15px -3px rgba(168, 85, 247, 0.4)',
                  fontSize: '2rem'
                }}>
                🔒
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="momentum-band">
        <div className="container momentum-inner">
          <div className="momentum-title">
            We help high-output teams stay effortlessly in sync.
          </div>
          <div className="momentum-stats">
            {momentumStats.map((stat) => (
              <div key={stat.label} className="momentum-card glass">
                <span className="momentum-value">{stat.value}</span>
                <span className="momentum-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <ExperienceSection />
      <HowItWorks />
      <FeatureGrid />
      <TestimonialsCarousel />
      <section className="cta-section">
        <div className="container cta-inner glass">
          <div className="cta-copy">
            <p className="cta-kicker">Ready when you are</p>
            <h2>Launch a shared memory for your team in minutes.</h2>
            <p className="cta-subtitle">
              Build a living archive with automated syncs, AI copilots, and
              contextual insights. No more lost threads or forgotten decisions.
            </p>
            <div className="cta-actions">
              <a className="btn btn-primary btn-ripple" href="/signup">
                Start Free Trial
              </a>
              <a className="btn btn-ghost" href="/about">
                Explore the product
              </a>
            </div>
            <ul className="cta-highlights">
              {spotlightFeatures.map((item) => (
                <li key={item}>
                  <span className="cta-dot" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="cta-panel">
            <div className="cta-orb">
              <div className="cta-orb-core" />
            </div>
            <div className="cta-panel-copy">
              <p>
                "CogniVault is the connective tissue between every project
                decision and the context behind it."
              </p>
              <span className="cta-signature">— Olivia Mendes, Chief of Staff</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

