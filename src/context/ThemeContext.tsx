import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type AccentColor = 'teal' | 'blue' | 'indigo' | 'violet' | 'orange' | 'pink';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  isDark: boolean;
  effectiveTheme: Exclude<Theme, 'system'>; // The actual theme being applied
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('amber-theme') as Theme) || 'system';
    }
    return 'system';
  });

  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('amber-accent') as AccentColor) || 'teal';
    }
    return 'teal';
  });

  // Calculate effective theme (resolve 'system' to actual theme)
  const [effectiveTheme, setEffectiveTheme] = useState<Exclude<Theme, 'system'>>(() => {
    if (theme === 'system') {
      return getSystemTheme();
    }
    return theme as Exclude<Theme, 'system'>;
  });

  // Listen to system theme changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setEffectiveTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Update effective theme when theme changes
  useEffect(() => {
    if (theme === 'system') {
      setEffectiveTheme(getSystemTheme());
    } else {
      setEffectiveTheme(theme as Exclude<Theme, 'system'>);
    }
  }, [theme]);

  // Apply theme to DOM
  useEffect(() => {
    const root = window.document.documentElement;

    // Remove all theme classes
    root.classList.remove('light', 'dark');

    // Add effective theme class
    root.classList.add(effectiveTheme);

    // Set data-theme attribute for compatibility
    root.setAttribute('data-theme', effectiveTheme);

    // Persist selected theme (including 'system')
    localStorage.setItem('amber-theme', theme);
  }, [effectiveTheme, theme]);

  useEffect(() => {
    localStorage.setItem('amber-accent', accentColor);
  }, [accentColor]);

  const isDark = effectiveTheme === 'dark';

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, accentColor, setAccentColor, isDark, effectiveTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
