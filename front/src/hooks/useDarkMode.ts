// hooks/useDarkMode.ts
'use client';

import { UnfoldHorizontal } from 'lucide-react';
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'

export function useDarkMode() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // マウントされるまでは何も返さない
  if (!mounted) {
    return {
      darkMode: undefined,
      toggleDarkMode: () => {},
    }
  }

  // resolvedThemeを使うことで "system" を自動判定
  const darkMode = resolvedTheme === 'dark'
   


  return { darkMode }
}
