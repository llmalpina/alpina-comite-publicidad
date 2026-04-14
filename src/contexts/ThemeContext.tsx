import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  dark: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ dark: false, toggleDark: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, toggleDark: () => setDark(v => !v) }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
