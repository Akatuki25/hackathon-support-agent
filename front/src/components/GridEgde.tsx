import React from "react";

export default function GridEdge({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div
        className="min-h-screen font-mono transition-all duration-500 flex items-center justify-center bg-gray-100 dark:bg-gray-900 relative overflow-hidden"
      >
        {/* Animated background grid */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none opacity-10 dark:opacity-20"
        >
          {/* Light mode grid */}
          <div
            className="absolute inset-0 dark:hidden"
            style={{
              backgroundImage: `linear-gradient(#8a2be2 1px, transparent 1px),
                                linear-gradient(90deg, #8a2be2 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
              backgroundPosition: "-1px -1px",
            }}
          ></div>
          {/* Dark mode grid */}
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              backgroundImage: `linear-gradient(#00ffe1 1px, transparent 1px),
                                linear-gradient(90deg, #00ffe1 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
              backgroundPosition: "-1px -1px",
            }}
          ></div>
        </div>

        {/* Glowing edges */}
        <div className="fixed bottom-0 left-0 right-0 h-1 z-20">
          <div
            className="h-full bg-purple-500 dark:bg-cyan-500 animate-pulse"
          ></div>
        </div>
        <div className="fixed top-0 bottom-0 right-0 w-1 z-20">
          <div
            className="w-full bg-blue-500 dark:bg-pink-500 animate-pulse"
          ></div>
        </div>
        {children}
      </div>
    </>
  );
}
