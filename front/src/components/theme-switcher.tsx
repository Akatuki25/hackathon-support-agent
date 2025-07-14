// components/theme-switcher.tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted ] = useState(false);

  // hydration問題を避けるためマウント後にレンダリング
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
      <button 
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
        className={`absolute top-6 right-6 p-3 rounded-full transition-all z-100 ${
          theme === 'dark' 
            ? 'bg-gray-800 hover:bg-gray-700 text-yellow-300' 
            : 'bg-gray-200 hover:bg-gray-300 text-indigo-600'
        }`}
      >
        {theme === 'dark' ? <Sun/>: <Moon/>}
      </button>
  );
}