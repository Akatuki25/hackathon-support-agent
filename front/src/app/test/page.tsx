import React from "react";
import BlockNoteClient  from "./BlockNoteAIClient";

export default function Page() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">BlockNote + Gemini</h1>
      <BlockNoteClient />
    </main>
  );
}
