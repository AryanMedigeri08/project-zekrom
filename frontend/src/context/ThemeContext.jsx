/**
 * ThemeContext.jsx — Light/Dark mode system with CSS variable injection.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const themes = {
  dark: {
    bg: '#000000',
    bgSecondary: '#0a0a0a',
    bgCard: '#111111',
    bgCardHover: '#1a1a1a',
    border: '#222222',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#475569',
    navBg: '#050505',
    panelBg: '#0d0d0d',
    inputBg: '#1a1a1a',
    scrollbar: '#333333',
  },
  light: {
    bg: '#f8fafc',
    bgSecondary: '#f1f5f9',
    bgCard: '#ffffff',
    bgCardHover: '#f8fafc',
    border: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    navBg: '#ffffff',
    panelBg: '#f8fafc',
    inputBg: '#ffffff',
    scrollbar: '#cbd5e1',
  },
};

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
  colors: themes.dark,
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('zekrom-theme') || 'dark'; } catch { return 'dark'; }
  });

  useEffect(() => {
    const root = document.documentElement;
    const t = themes[theme];
    Object.entries(t).forEach(([key, value]) => {
      // Convert camelCase to kebab-case for CSS variables
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      root.style.setProperty(`--color-${cssKey}`, value);
    });
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('zekrom-theme', theme); } catch {}
  }, [theme]);

  const value = {
    theme,
    colors: themes[theme],
    toggleTheme: () => setTheme(prev => prev === 'dark' ? 'light' : 'dark'),
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
