import { motion } from 'framer-motion';
import './LoadingScreen.css';

export default function LoadingScreen() {
  return (
    <motion.div 
      className="loading-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="loading-content">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <svg 
            className="loading-logo"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="50%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#14B8A6" />
              </linearGradient>
            </defs>
            
            {/* Brain icon */}
            <motion.path
              d="M100 50 C 70 50, 50 70, 50 100 C 50 130, 70 150, 100 150 C 130 150, 150 130, 150 100 C 150 70, 130 50, 100 50"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="3"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ 
                duration: 2, 
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "reverse"
              }}
            />
            
            {/* Neural connections */}
            <motion.circle
              cx="100"
              cy="100"
              r="5"
              fill="url(#gradient)"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.5, 1] }}
              transition={{ 
                duration: 1, 
                repeat: Infinity,
                repeatDelay: 1
              }}
            />
          </svg>
        </motion.div>
        
        <motion.h1 
          className="loading-title"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          CogniVault
        </motion.h1>
        
        <motion.p 
          className="loading-subtitle"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          Building your knowledge universe
        </motion.p>
        
        <motion.div 
          className="loading-dots"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <span className="loading-dot"></span>
          <span className="loading-dot"></span>
          <span className="loading-dot"></span>
        </motion.div>
      </div>
    </motion.div>
  );
}
