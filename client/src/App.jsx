import { useState, useEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PageLoader from "./components/PageLoader";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthRedirect from "./components/AuthRedirect";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import KnowledgeGraph from "./components/KnowledgeGraph";
import IncognitoVault from "./pages/IncognitoVault";
import "./styles/global.css";

function App() {
  const location = useLocation();
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

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="app-shell">
          <PageLoader isLoading={isLoading} />
          <Navbar />

          <div className="route-container">
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<LandingPage />} />
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
                  path="/incognito"
                  element={
                    <ProtectedRoute>
                      <IncognitoVault />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AnimatePresence>
          </div>

          <Footer />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App
