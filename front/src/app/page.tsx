"use client";
import Image from "next/image";

import { useDarkMode } from "@/hooks/useDarkMode";



export default function Home() {
  const {darkMode, toggleDarkMode, mounted } = useDarkMode();
  if (!mounted) {
    return null;
  }
  

  return (
    <div className={`min-h-screen font-mono transition-all duration-500 flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} relative overflow-hidden`}>
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${darkMode ? 'opacity-20' : 'opacity-10'}`}>
        <div className="absolute inset-0" style={{ 
          backgroundImage: `linear-gradient(${darkMode ? '#00ffe1' : '#8a2be2'} 1px, transparent 1px), 
                            linear-gradient(90deg, ${darkMode ? '#00ffe1' : '#8a2be2'} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          backgroundPosition: '-1px -1px'
        }}></div>
      </div>
    </div>
  );
}
