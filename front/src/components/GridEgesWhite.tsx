import React from "react";

const GridEdgesWhite = () => {
  return (
    <div
      className={`min-h-screen font-mono transition-all duration-500 flex items-center justify-center bg-gray-100 relative overflow-hidden`}
    >
      <div
        className={`absolute inset-0 overflow-hidden pointer-events-none opacity-20`}
      >
        <div
          className="absolute inset-0"
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
        <div className={`h-full bg-cyan-500 animate-pulse`}></div>
      </div>
      <div className="fixed top-0 bottom-0 right-0 w-1 z-20">
        <div className={`w-full bg-pink-500 animate-pulse`}></div>
      </div>
    </div>
  );
};

export default GridEdgesWhite;
