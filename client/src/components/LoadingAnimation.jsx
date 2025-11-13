import { motion } from 'framer-motion';
import '../styles/loading.css';

const LoadingAnimation = ({ progress }) => {
  return (
    <motion.div
      className="loading-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Animated background particles */}
      <div className="loading-background">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1]
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          />
        ))}
      </div>

      {/* Main loading content */}
      <div className="loading-content">
        {/* Brain icon or logo */}
        <motion.div 
          className="loading-icon"
          animate={{
            rotateY: [0, 360],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
              fill="url(#gradient1)"
            />
            <path
              d="M12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6ZM12 16C9.79 16 8 14.21 8 12C8 9.79 9.79 8 12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16Z"
              fill="url(#gradient2)"
            />
            <defs>
              <linearGradient id="gradient1" x1="2" y1="2" x2="22" y2="22">
                <stop offset="0%" stopColor="#00ffff" />
                <stop offset="100%" stopColor="#0099ff" />
              </linearGradient>
              <linearGradient id="gradient2" x1="6" y1="6" x2="18" y2="18">
                <stop offset="0%" stopColor="#0099ff" />
                <stop offset="100%" stopColor="#00ffff" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        {/* Loading text */}
        <motion.h2
          className="loading-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Initializing CogniVault
        </motion.h2>

        <motion.p
          className="loading-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Preparing your second brain...
        </motion.p>

        {/* Progress bar */}
        <div className="progress-container">
          <motion.div
            className="progress-bar"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
          <div className="progress-glow" 
            style={{ 
              left: `${progress}%`,
              opacity: progress > 0 ? 1 : 0 
            }} 
          />
        </div>

        {/* Percentage */}
        <motion.div
          className="loading-percentage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {Math.round(progress)}%
        </motion.div>

        {/* Loading messages */}
        <motion.div
          className="loading-message"
          key={Math.floor(progress / 33)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.6, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {progress < 33 && "Connecting neural networks..."}
          {progress >= 33 && progress < 66 && "Loading knowledge graphs..."}
          {progress >= 66 && progress < 100 && "Finalizing experience..."}
          {progress >= 100 && "Ready!"}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LoadingAnimation;