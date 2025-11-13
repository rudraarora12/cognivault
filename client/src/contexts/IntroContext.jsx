import { createContext, useContext, useState, useEffect } from 'react';

const IntroContext = createContext();

export function IntroProvider({ children }) {
  const [isIntroComplete, setIsIntroComplete] = useState(() => {
    // Check if intro was already shown
    return sessionStorage.getItem('cogniVaultIntroShown') === 'true';
  });

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

