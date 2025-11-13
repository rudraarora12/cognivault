import { useState, useEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { IntroProvider, useIntro } from "./contexts/IntroContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PageLoader from "./components/PageLoader";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthRedirect from "./components/AuthRedirect";

import Home from "./pages/Home";              // ⭐ ADDED
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import KnowledgeGraph from "./components/KnowledgeGraph";
import IncognitoVault from "./pages/IncognitoVault";
import CognitiveTimeline from "./pages/CognitiveTimeline";
import "./styles/global.css";


function AppContent() {
  const location = useLocation();
  const { isIntroComplete } = useIntro();
  const [isLoading, setIsLoading] = useState(true);
  const hasCompletedInitialLoad = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasCompletedInitialLoad.current) {
      hasCompletedInitialLoad.current = true;
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 1000);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Hide navbar during intro animation on home page
  const shouldShowNavbar = location.pathname !== '/' || isIntroComplete;

  return (
    <div className="app-shell">
      <PageLoader isLoading={isLoading} />
      {shouldShowNavbar && <Navbar />}

          <div className="route-container">
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                {/* Home route */}
                <Route path="/" element={<Home />} />

                <Route
                  path="/login"
                  element={
                    <AuthRedirect>
                      <Login />
                    </AuthRedirect>
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <AuthRedirect>
                      <Signup />
                    </AuthRedirect>
                  }
                />

                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/knowledge-graph"
                  element={
                    <ProtectedRoute>
                      <KnowledgeGraph />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/upload"
                  element={
                    <ProtectedRoute>
                      <UploadPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/incognito"
                  element={
                    <ProtectedRoute>
                      <IncognitoVault />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cognitive-timeline"
                  element={
                    <ProtectedRoute>
                      <CognitiveTimeline />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AnimatePresence>
          </div>

          <Footer />
        </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <IntroProvider>
          <AppContent />
        </IntroProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
