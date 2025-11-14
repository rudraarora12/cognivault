import { createContext, useContext, useState } from 'react';

const IntroContext = createContext();

export function IntroProvider({ children }) {
  // Always start with intro not complete - let Home.jsx handle the session check
  const [isIntroComplete, setIsIntroComplete] = useState(false);

  const markIntroComplete = () => {
    setIsIntroComplete(true);
    sessionStorage.setItem('cogniVaultIntroShown', 'true');
  };

  return (
    <IntroContext.Provider value={{ isIntroComplete, markIntroComplete }}>
      {children}
    </IntroContext.Provider>
  );
}

export function useIntro() {
  const context = useContext(IntroContext);
  if (!context) {
    throw new Error('useIntro must be used within IntroProvider');
  }
  return context;
}
