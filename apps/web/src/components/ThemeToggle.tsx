'use client';

import { useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';

type Theme = 'dark' | 'light';
const STORAGE_KEY = 'survey-guru:theme';

function preferredTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* Theme switching remains available when storage is blocked. */ }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const initial = preferredTheme();
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
    window.dispatchEvent(new CustomEvent('survey-guru-theme', { detail: initial }));
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Apply for this visit. */ }
    window.dispatchEvent(new CustomEvent('survey-guru-theme', { detail: next }));
  }

  const next = theme === 'dark' ? 'light' : 'dark';
  return <button className={styles.toggle} type="button" aria-label={`Use ${next} appearance`} title={`Use ${next} appearance`} onClick={() => choose(next)}>{theme === 'dark' ? '☀' : '☾'}</button>;
}
