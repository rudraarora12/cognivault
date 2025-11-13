import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useIntro } from '../contexts/IntroContext';
import IntroAnimation from '../components/IntroAnimation';
import LoadingAnimation from '../components/LoadingAnimation';
import LandingPage from '../components/LandingPage';
import '../styles/landing.css';

// Transition phases enum for better type safety
const PHASES = {
  INTRO: 'intro',
  ZOOM_OUT: 'zoomOut',
  BLACKOUT: 'blackout',
  LOADING: 'loading',
  REVEAL: 'reveal',
  LANDING: 'landing'
};

// Timing constants for better maintainability
const TIMING = {
  ZOOM_OUT_DELAY: 400,
  BLACKOUT_DELAY: 1200,
  LOADING_DELAY: 1200,
  REVEAL_DELAY: 4200,
  LANDING_DELAY: 5400,
  LOADING_DURATION: 3000,
  LOADING_INTERVAL: 30
};

const Home = () => {
  const { markIntroComplete } = useIntro();
  const [transitionPhase, setTransitionPhase] = useState(PHASES.INTRO);
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Memoized computed states
  const shouldShowIntro = useMemo(
    () => transitionPhase === PHASES.INTRO,
    [transitionPhase]
  );

  const shouldShowLoading = useMemo(
    () => transitionPhase === PHASES.LOADING,
    [transitionPhase]
  );

  const shouldShowLanding = useMemo(
    () => [PHASES.REVEAL, PHASES.LANDING].includes(transitionPhase),
    [transitionPhase]
  );

  // Check if intro was already shown
  useEffect(() => {
    const introShown = sessionStorage.getItem('cogniVaultIntroShown');

    if (introShown === 'true') {
      setTransitionPhase(PHASES.LANDING);
      setIsIntroComplete(true);
      markIntroComplete();
    }
  }, [markIntroComplete]);

  // Smooth loading progress animation (0 → 100 over 3s)
  useEffect(() => {
    if (transitionPhase === PHASES.LOADING) {
      setLoadingProgress(0);

      const totalSteps = TIMING.LOADING_DURATION / TIMING.LOADING_INTERVAL;
      const increment = 100 / totalSteps;
      let progress = 0;

      const timer = setInterval(() => {
        progress += increment;
        if (progress >= 100) {
          setLoadingProgress(100);
          clearInterval(timer);
        } else {
          setLoadingProgress(progress);
        }
      }, TIMING.LOADING_INTERVAL);

      return () => clearInterval(timer);
    }
  }, [transitionPhase]);

  // Complete cinematic transition flow
  const handleIntroFinish = useCallback(() => {
    sessionStorage.setItem('cogniVaultIntroShown', 'true');
    setIsIntroComplete(true);

    // Orchestrate the entire transition sequence
    setTransitionPhase(PHASES.ZOOM_OUT);
    setTimeout(() => setTransitionPhase(PHASES.BLACKOUT), TIMING.ZOOM_OUT_DELAY);
    setTimeout(() => setTransitionPhase(PHASES.LOADING), TIMING.LOADING_DELAY);
    setTimeout(() => {
      setTransitionPhase(PHASES.REVEAL);
      markIntroComplete(); // Show navbar when loading completes (REVEAL phase)
    }, TIMING.REVEAL_DELAY);
    setTimeout(() => setTransitionPhase(PHASES.LANDING), TIMING.LANDING_DELAY);
  }, [markIntroComplete]);

  // ESC key to skip intro
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && transitionPhase === PHASES.INTRO) {
        handleIntroFinish();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transitionPhase, handleIntroFinish]);

  return (
    <div className="home-container">

      {/* INTRO ANIMATION */}
      <AnimatePresence mode="wait">
        {shouldShowIntro && (
          <motion.div
            key="intro-wrapper"
            initial={{ scale: 1, opacity: 1 }}
            exit={{
              scale: transitionPhase === PHASES.ZOOM_OUT ? 1.15 : 1,
              opacity: 0,
              filter: 'blur(10px)'
            }}
            transition={{
              duration: 0.8,
              ease: [0.43, 0.13, 0.23, 0.96]
            }}
          >
            <IntroAnimation onFinish={handleIntroFinish} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* BLACKOUT TRANSITION */}
      <AnimatePresence>
        {transitionPhase === PHASES.BLACKOUT && (
          <motion.div
            key="blackout"
            className="transition-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'radial-gradient(circle, #1a1a2e 0%, #000000 100%)',
              zIndex: 10000,
              pointerEvents: 'none'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>

      {/* LOADING ANIMATION */}
      <AnimatePresence>
        {shouldShowLoading && (
          <LoadingAnimation 
            key="loading"
            progress={loadingProgress}
          />
        )}
      </AnimatePresence>

      {/* LANDING PAGE */}
      <AnimatePresence>
        {shouldShowLanding && (
          <motion.div
            key="landing"
            className="landing-wrapper"
            initial={{
              opacity: 0,
              scale: transitionPhase === PHASES.REVEAL ? 0.95 : 1,
              y: transitionPhase === PHASES.REVEAL ? 20 : 0
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0
            }}
            transition={{
              duration: transitionPhase === PHASES.REVEAL ? 1.2 : 0.6,
              ease: [0.22, 1, 0.36, 1]
            }}
          >
            <LandingPage />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Home;