"use client";
import React, { useState, useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { Block } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

// Cyberpunk Editor Component
const CyberpunkBlockNoteEditor = () => {
  // Creates a new editor instance
  const editor = useCreateBlockNote({
    initialContent: [
      {
        type: "heading",
        content: "CYBERPUNK EDITOR v2.0.77",
      },
      {
        type: "paragraph",
        content: "Welcome to the future of text editing...",
      },
      {
        type: "paragraph",
        content: "Start typing to experience the neon glow of tomorrow.",
      },
    ],
  });

  // State for the document JSON
  const [blocks, setBlocks] = useState<Block[]>([]);

  // Custom CSS for cyberpunk theme
  const cyberpunkStyles = `
    /* Font Imports */
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&display=swap');
    
    /* Dark Theme Styles */
    .cyberpunk-dark h1, .cyberpunk-dark h2, .cyberpunk-dark h3, 
    .cyberpunk-dark h4, .cyberpunk-dark h5, .cyberpunk-dark h6 {
      color: #5eead4;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: bold;
      border-bottom: 1px solid #0f766e;
      padding-bottom: 0.3em;
    }
    
    .cyberpunk-dark h1 { font-size: 1.8em; color: #f472b6; }
    .cyberpunk-dark h2 { font-size: 1.5em; }
    .cyberpunk-dark h3 { font-size: 1.3em; }
    
    .cyberpunk-dark p {
      margin-bottom: 1em;
      line-height: 1.6;
    }
    
    .cyberpunk-dark ul, .cyberpunk-dark ol {
      margin-left: 1.5em;
      margin-bottom: 1em;
    }
    
    .cyberpunk-dark li {
      margin-bottom: 0.5em;
    }
    
    .cyberpunk-dark a {
      color: #f472b6;
      text-decoration: none;
      border-bottom: 1px dashed #f472b6;
    }
    
    .cyberpunk-dark code {
      background-color: #1f2937;
      color: #5eead4;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: monospace;
    }
    
    .cyberpunk-dark pre {
      background-color: #1f2937;
      padding: 1em;
      border-radius: 5px;
      overflow: auto;
      margin-bottom: 1em;
      border-left: 3px solid #f472b6;
    }
    
    /* Light Theme Styles */
    .cyberpunk-light h1, .cyberpunk-light h2, .cyberpunk-light h3, 
    .cyberpunk-light h4, .cyberpunk-light h5, .cyberpunk-light h6 {
      color: #7c3aed;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: bold;
      border-bottom: 1px solid #c4b5fd;
      padding-bottom: 0.3em;
    }
    
    .cyberpunk-light h1 { font-size: 1.8em; color: #3b82f6; }
    .cyberpunk-light h2 { font-size: 1.5em; }
    .cyberpunk-light h3 { font-size: 1.3em; }
    
    .cyberpunk-light p {
      margin-bottom: 1em;
      line-height: 1.6;
    }
    
    .cyberpunk-light ul, .cyberpunk-light ol {
      margin-left: 1.5em;
      margin-bottom: 1em;
    }
    
    .cyberpunk-light li {
      margin-bottom: 0.5em;
    }
    
    .cyberpunk-light a {
      color: #3b82f6;
      text-decoration: none;
      border-bottom: 1px dashed #3b82f6;
    }
    
    .cyberpunk-light code {
      background-color: #f3f4f6;
      color: #7c3aed;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: monospace;
    }
    
    .cyberpunk-light pre {
      background-color: #f3f4f6;
      padding: 1em;
      border-radius: 5px;
      overflow: auto;
      margin-bottom: 1em;
      border-left: 3px solid #3b82f6;
    }
    
    /* Global Cyberpunk Styling */
    body {
      font-family: 'Rajdhani', sans-serif;
    }
    
    /* Editor Container Styling */
    .cyberpunk-editor-container {
      position: relative;
      max-width: 1000px;
      margin: 40px auto;
      border: 1px solid #f472b6;
      box-shadow: 0 0 15px rgba(244, 114, 182, 0.3);
      border-radius: 4px;
      padding: 10px;
    }
    
    /* Dark mode specific container styling */
    .cyberpunk-dark .cyberpunk-editor-container {
      background-color: #0f172a;
      color: #e2e8f0;
    }
    
    /* Light mode specific container styling */
    .cyberpunk-light .cyberpunk-editor-container {
      background-color: #ffffff;
      color: #1e293b;
      border: 1px solid #3b82f6;
      box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
    }
    
    /* Glitch Effect Overlay - Only for dark theme */
    .cyberpunk-dark .glitch-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(45deg, rgba(244, 114, 182, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%);
      pointer-events: none;
      z-index: 10;
    }
    
    .cyberpunk-dark .glitch-lines {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255, 255, 255, 0.03) 2px,
        rgba(255, 255, 255, 0.03) 4px
      );
      pointer-events: none;
      z-index: 9;
    }
    
    /* Scanning Animation - Dark theme */
    .cyberpunk-dark .scan-line {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(
        to bottom,
        transparent,
        #5eead4 50%,
        transparent
      );
      box-shadow: 0 0 10px #5eead4;
      opacity: 0.3;
      z-index: 11;
      pointer-events: none;
      animation: scanAnimation 8s ease-in-out infinite;
    }
    
    @keyframes scanAnimation {
      0% { top: 0; }
      50% { top: 100%; }
      100% { top: 0; }
    }
    
    /* Editor Title Styling */
    .editor-title {
      font-family: 'Orbitron', sans-serif;
      font-weight: 700;
      font-size: 24px;
      padding-bottom: 15px;
      margin-bottom: 15px;
      text-align: center;
      letter-spacing: 1px;
    }
    
    .cyberpunk-dark .editor-title {
      color: #f472b6;
      text-shadow: 0 0 5px rgba(244, 114, 182, 0.5);
      border-bottom: 1px solid #0f766e;
    }
    
    .cyberpunk-light .editor-title {
      color: #3b82f6;
      border-bottom: 1px solid #c4b5fd;
    }
    
    /* BlockNote Editor Custom Styling */
    .bn-container {
      background-color: transparent !important;
      font-family: 'Rajdhani', sans-serif !important;
    }
    
    .cyberpunk-dark .bn-container {
      color: #e2e8f0 !important;
    }
    
    .cyberpunk-light .bn-container {
      color: #1e293b !important;
    }
    
    /* Block Styling */
    .bn-block {
      border-left: 2px solid transparent;
      transition: border-left-color 0.3s ease;
      padding-left: 8px;
    }
    
    .cyberpunk-dark .bn-block:hover {
      border-left-color: #f472b6;
    }
    
    .cyberpunk-light .bn-block:hover {
      border-left-color: #3b82f6;
    }
    
    .cyberpunk-dark .bn-block-selected {
      border-left: 2px solid #f472b6 !important;
      background-color: rgba(244, 114, 182, 0.1) !important;
    }
    
    .cyberpunk-light .bn-block-selected {
      border-left: 2px solid #3b82f6 !important;
      background-color: rgba(59, 130, 246, 0.1) !important;
    }
    
    /* Heading Block Styling */
    .bn-block[data-block-type="heading"] {
      font-family: 'Orbitron', sans-serif !important;
      font-weight: 600;
    }
    
    .cyberpunk-dark .bn-block[data-block-type="heading"] {
      color: #5eead4 !important;
    }
    
    .cyberpunk-light .bn-block[data-block-type="heading"] {
      color: #7c3aed !important;
    }
    
    /* BlockNote Toolbar Styling */
    .cyberpunk-dark .bn-toolbar {
      background-color: #1f2937 !important;
      border: 1px solid #5eead4 !important;
      box-shadow: 0 0 10px rgba(94, 234, 212, 0.3) !important;
    }
    
    .cyberpunk-light .bn-toolbar {
      background-color: #f3f4f6 !important;
      border: 1px solid #7c3aed !important;
      box-shadow: 0 0 10px rgba(124, 58, 237, 0.3) !important;
    }
    
    .bn-toolbar-button {
      border-radius: 2px !important;
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    
    .cyberpunk-dark .bn-toolbar-button {
      color: #e2e8f0 !important;
    }
    
    .cyberpunk-light .bn-toolbar-button {
      color: #1e293b !important;
    }
    
    .cyberpunk-dark .bn-toolbar-button:hover {
      background-color: rgba(94, 234, 212, 0.2) !important;
      color: #5eead4 !important;
    }
    
    .cyberpunk-light .bn-toolbar-button:hover {
      background-color: rgba(124, 58, 237, 0.2) !important;
      color: #7c3aed !important;
    }
    
    /* BlockNote Menu Styling */
    .cyberpunk-dark .bn-menu {
      background-color: #1f2937 !important;
      border: 1px solid #f472b6 !important;
      box-shadow: 0 0 10px rgba(244, 114, 182, 0.3) !important;
    }
    
    .cyberpunk-light .bn-menu {
      background-color: #f3f4f6 !important;
      border: 1px solid #3b82f6 !important;
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.3) !important;
    }
    
    .cyberpunk-dark .bn-menu-item {
      color: #e2e8f0 !important;
    }
    
    .cyberpunk-light .bn-menu-item {
      color: #1e293b !important;
    }
    
    .cyberpunk-dark .bn-menu-item:hover {
      background-color: rgba(244, 114, 182, 0.2) !important;
      color: #f472b6 !important;
    }
    
    .cyberpunk-light .bn-menu-item:hover {
      background-color: rgba(59, 130, 246, 0.2) !important;
      color: #3b82f6 !important;
    }
    
    /* Custom Selection Color */
    .cyberpunk-dark ::selection {
      background-color: rgba(244, 114, 182, 0.3);
      color: #5eead4;
    }
    
    .cyberpunk-light ::selection {
      background-color: rgba(59, 130, 246, 0.3);
      color: #7c3aed;
    }
    
    /* Cursor Color */
    .cyberpunk-dark .bn-inline-content {
      caret-color: #5eead4;
    }
    
    .cyberpunk-light .bn-inline-content {
      caret-color: #7c3aed;
    }
    
    /* JSON Display Styling */
    .json-display {
      margin-top: 30px;
      border-radius: 4px;
      padding: 15px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .cyberpunk-dark .json-display {
      background-color: #1f2937;
      border: 1px solid #5eead4;
      box-shadow: 0 0 10px rgba(94, 234, 212, 0.3);
      color: #5eead4;
    }
    
    .cyberpunk-light .json-display {
      background-color: #f3f4f6;
      border: 1px solid #7c3aed;
      box-shadow: 0 0 10px rgba(124, 58, 237, 0.3);
      color: #7c3aed;
    }
    
    .json-display-title {
      font-family: 'Orbitron', sans-serif;
      font-size: 16px;
      margin-bottom: 10px;
      text-align: center;
    }
    
    .cyberpunk-dark .json-display-title {
      color: #f472b6;
    }
    
    .cyberpunk-light .json-display-title {
      color: #3b82f6;
    }
    
    /* Status Bar */
    .status-bar {
      display: flex;
      justify-content: space-between;
      padding: 8px 15px;
      font-family: 'Orbitron', sans-serif;
      font-size: 12px;
      margin-top: 15px;
    }
    
    .cyberpunk-dark .status-bar {
      background-color: #1e293b;
      border-top: 1px solid #5eead4;
      color: #e2e8f0;
    }
    
    .cyberpunk-light .status-bar {
      background-color: #f1f5f9;
      border-top: 1px solid #7c3aed;
      color: #1e293b;
    }
    
    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 5px;
      animation: blink 2s infinite;
    }
    
    .cyberpunk-dark .status-indicator {
      background-color: #5eead4;
      box-shadow: 0 0 5px #5eead4;
    }
    
    .cyberpunk-light .status-indicator {
      background-color: #7c3aed;
      box-shadow: 0 0 5px #7c3aed;
    }
    
    @keyframes blink {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }
  `;

  // Custom dark theme configuration for BlockNote
  const darkTheme = {
    colors: {
      editor: {
        text: "#e2e8f0",
        background: "transparent",
      },
      menu: {
        text: "#e2e8f0",
        background: "#1f2937",
      },
      tooltip: {
        text: "#e2e8f0",
        background: "#1e293b",
      },
      highlights: {
        blue: {
          text: "#ffffff",
          background: "rgba(59, 130, 246, 0.3)",
        },
        red: {
          text: "#ffffff",
          background: "rgba(244, 114, 182, 0.3)",
        },
        green: {
          text: "#ffffff",
          background: "rgba(94, 234, 212, 0.3)",
        },
        yellow: {
          text: "#ffffff",
          background: "rgba(250, 204, 21, 0.3)",
        },
        gray: {
          text: "#ffffff",
          background: "rgba(156, 163, 175, 0.3)",
        },
        brown: {
          text: "#ffffff",
          background: "rgba(180, 83, 9, 0.3)",
        },
        orange: {
          text: "#ffffff",
          background: "rgba(249, 115, 22, 0.3)",
        },
        purple: {
          text: "#ffffff",
          background: "rgba(124, 58, 237, 0.3)",
        },
        pink: {
          text: "#ffffff",
          background: "rgba(236, 72, 153, 0.3)",
        },
      },
      sideMenu: "#1f2937",
    },
  };

  // Custom light theme configuration for BlockNote
  const lightTheme = {
    colors: {
      editor: {
        text: "#1e293b",
        background: "transparent",
      },
      menu: {
        text: "#1e293b",
        background: "#f3f4f6",
      },
      tooltip: {
        text: "#1e293b",
        background: "#f1f5f9",
      },
      highlights: {
        blue: {
          text: "#1e293b",
          background: "rgba(59, 130, 246, 0.2)",
        },
        red: {
          text: "#1e293b",
          background: "rgba(244, 114, 182, 0.2)",
        },
        green: {
          text: "#1e293b",
          background: "rgba(94, 234, 212, 0.2)",
        },
        yellow: {
          text: "#1e293b",
          background: "rgba(250, 204, 21, 0.2)",
        },
        gray: {
          text: "#1e293b",
          background: "rgba(156, 163, 175, 0.2)",
        },
        brown: {
          text: "#1e293b",
          background: "rgba(180, 83, 9, 0.2)",
        },
        orange: {
          text: "#1e293b",
          background: "rgba(249, 115, 22, 0.2)",
        },
        purple: {
          text: "#1e293b",
          background: "rgba(124, 58, 237, 0.2)",
        },
        pink: {
          text: "#1e293b",
          background: "rgba(236, 72, 153, 0.2)",
        },
      },
      sideMenu: "#f3f4f6",
    },
  };
  // Update blocks state when editor content changes
  useEffect(() => {
    const updateBlocks = () => {
      if (editor) {
        setBlocks(editor.document);
      }
    };

    if (editor) {
      // Initial update
      updateBlocks();

      // Subscribe to changes
      editor.onEditorContentChange(() => {
        updateBlocks();
      });
    }
  }, [editor]);

  // Get current date and time for the status bar
  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const [currentTime, setCurrentTime] = useState(getCurrentTime());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // State for theme mode (dark/light)
  const [themeMode, setThemeMode] = useState("dark");

  // Handle theme toggle
  const toggleTheme = () => {
    setThemeMode(themeMode === "dark" ? "light" : "dark");
  };

  return (
    <div className={`cyberpunk-${themeMode}`}>
      {/* Custom stylesheet */}
      <style>{cyberpunkStyles}</style>

      <div className="cyberpunk-editor-container">
        {/* Visual effects - only shown in dark mode */}
        {themeMode === "dark" && (
          <>
            <div className="glitch-overlay"></div>
            <div className="glitch-lines"></div>
            <div className="scan-line"></div>
          </>
        )}

        {/* Editor title */}
        <div className="editor-title">CYBERPUNK BLOCKNOTE TERMINAL</div>

        {/* Theme toggle button */}
        <div style={{ textAlign: "right", marginBottom: "10px" }}>
          <button
            onClick={toggleTheme}
            style={{
              background: "transparent",
              border:
                themeMode === "dark"
                  ? "1px solid #5eead4"
                  : "1px solid #7c3aed",
              color: themeMode === "dark" ? "#5eead4" : "#7c3aed",
              padding: "5px 10px",
              borderRadius: "4px",
              cursor: "pointer",
              fontFamily: "Orbitron, sans-serif",
              fontSize: "12px",
            }}
          >
            SWITCH TO {themeMode === "dark" ? "LIGHT" : "DARK"} MODE
          </button>
        </div>

        {/* The editor view */}
        <BlockNoteView
          editor={editor}
          theme={themeMode === "dark" ? darkTheme : lightTheme}
        />

        {/* Status bar */}
        <div className="status-bar">
          <div>
            <span className="status-indicator"></span>
            SYSTEM ACTIVE
          </div>
          <div>BLOCKS: {blocks.length}</div>
          <div>{currentTime} / NIGHT CITY</div>
        </div>
      </div>

      {/* Optional: JSON display */}
      <div className="json-display">
        <div className="json-display-title">DOCUMENT STRUCTURE</div>
        <pre>{JSON.stringify(blocks, null, 2)}</pre>
      </div>
    </div>
  );
};

export default CyberpunkBlockNoteEditor;
