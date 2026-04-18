/**
 * ThemeContext.jsx — Locked to Light Mode.
 * Dark mode has been permanently removed from Zekrom.
 */

import React, { createContext, useContext } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const value = {
    theme: 'light',
    toggleTheme: () => {}, // No-op — light mode only
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
