import React from "react";
import { useDarkMode } from "@/hooks/useDarkMode";

export default function HackthonSupportAgent() {
  const { darkMode } = useDarkMode();
  return (
    <div
      className={`text-xs text-center mt-4 mb-4 ${darkMode ? "text-gray-500" : "text-gray-600"}`}
    >
      <span
        className={`${darkMode ? "text-cyan-400" : "text-purple-600"} mr-1`}
      >
        Hackathon
      </span>
      <span className={`${darkMode ? "text-cyan-200" : "text-cyan-400"} mr-1`}>
        Suppport
      </span>
      <span className={darkMode ? "text-pink-500" : "text-blue-600"}>
        Agent
      </span>{" "}
      v2.00
    </div>
  );
}
