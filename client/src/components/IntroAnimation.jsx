import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import "../styles/intro.css";

export default function IntroAnimation({ onFinish }) {
  const vantaRef = useRef(null);
  const [vantaEffect, setVantaEffect] = useState(null);

  useEffect(() => {
    let threeScript, vantaScript;

    const loadScripts = async () => {
      // Load THREE.js
      if (!window.THREE) {
        threeScript = document.createElement("script");
        threeScript.src =
          "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
        threeScript.async = true;
        document.body.appendChild(threeScript);
        await new Promise((resolve) => (threeScript.onload = resolve));
      }

      // Load VANTA.NET
      if (!window.VANTA) {
        vantaScript = document.createElement("script");
        vantaScript.src =
          "https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.net.min.js";
        vantaScript.async = true;
        document.body.appendChild(vantaScript);
        await new Promise((resolve) => (vantaScript.onload = resolve));
      }

      // Now VANTA exists → Safe to init
      if (window.VANTA && vantaRef.current && !vantaEffect) {
        const isMobile = window.innerWidth < 768;

        const effect = window.VANTA.NET({
          el: vantaRef.current,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          color: 0x00ffff,
          backgroundColor: 0x0a0a0f,
          points: isMobile ? 8 : 12,
          maxDistance: isMobile ? 20 : 25,
          spacing: isMobile ? 20 : 18,
          showDots: true,
        });

        setVantaEffect(effect);
      }
    };

    loadScripts();

    // Auto-finish after 3.5s
    const timer = setTimeout(() => {
      onFinish && onFinish();
    }, 3500);

    return () => {
      clearTimeout(timer);

      // Clean Vanta instance
      if (vantaEffect) vantaEffect.destroy();

      // Clean added scripts
      if (threeScript) document.body.removeChild(threeScript);
      if (vantaScript) document.body.removeChild(vantaScript);
    };
  }, [vantaEffect, onFinish]);

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.3, delayChildren: 0.2 },
    },
  };

  const titleVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.8, ease: [0.6, 0.01, 0.05, 0.95] },
    },
  };

  const subtitleVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.6, 0.01, 0.05, 0.95] },
    },
  };

  const glowVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: [0, 1, 0.6, 1],
      transition: { duration: 2, repeat: Infinity, repeatType: "reverse" },
    },
  };

  return (
    <motion.div
      className="intro-container"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div ref={vantaRef} className="intro-background"></div>

      <motion.div
        className="intro-content"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="intro-title-wrapper">
          <motion.h1 className="intro-title" variants={titleVariants}>
            CogniVault
          </motion.h1>

          <motion.div className="intro-glow" variants={glowVariants} />
        </motion.div>

        <motion.p className="intro-subtitle" variants={subtitleVariants}>
          Your Mind. Remembered Forever.
        </motion.p>

        <motion.div
          className="intro-line"
          initial={{ width: 0 }}
          animate={{ width: "200px" }}
          transition={{ duration: 1, delay: 0.8 }}
        />
      </motion.div>

      <motion.div
        className="intro-loader"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="loader-bar"></div>
      </motion.div>
    </motion.div>
  );
}
