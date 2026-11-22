'use client';

import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';
const themeKey = 'mercaorden-theme';

export function ThemeSelect() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const saved = localStorage.getItem(themeKey);
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  function changeTheme(value: Theme) {
    setTheme(value);
    if (value === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
    localStorage.setItem(themeKey, value);
  }

  return (
    <select aria-label="Tema de color" className="theme" value={theme} onChange={(event) => changeTheme(event.target.value as Theme)}>
      <option value="system">Sistema</option>
      <option value="light">Claro</option>
      <option value="dark">Oscuro</option>
    </select>
  );
}
