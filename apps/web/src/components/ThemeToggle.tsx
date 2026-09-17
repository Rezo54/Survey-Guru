'use client';

import { useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';

type Theme = 'dark' | 'light';
const STORAGE_KEY = 'survey-guru:theme';

function preferredTheme(): Theme {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const initial = preferredTheme();
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent('survey-guru-theme', { detail: next }));
  }

  return <div className={styles.toggle} role="group" aria-label="Colour theme">
    <button type="button" aria-pressed={theme === 'light'} onClick={() => choose('light')}>☀ Light</button>
    <button type="button" aria-pressed={theme === 'dark'} onClick={() => choose('dark')}>☾ Dark</button>
  </div>;
}
