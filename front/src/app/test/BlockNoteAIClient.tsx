"use client";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { BlockNoteEditor, filterSuggestionItems } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  FormattingToolbar,
  FormattingToolbarController,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  useCreateBlockNote,
} from "@blocknote/react";
import {
  AIMenuController,
  AIToolbarButton,
  createAIExtension,
  createBlockNoteAIClient,
  getAISlashMenuItems,
} from "@blocknote/xl-ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import "@blocknote/xl-ai/style.css";

// Create BlockNote AI client that uses our Next.js proxy
const client = createBlockNoteAIClient({
  apiKey: "test-token", // matches TOKEN in .env.local
  baseURL: "/api/ai",
});

// Use Google Gemini via our proxy client
const model = createGoogleGenerativeAI({
  // call via our proxy client
  ...client.getProviderSettings("google"),
})("gemini-2.5-flash-lite");

export default function BlockNoteAIClient() {
  // Creates a new editor instance with AI extension
  const editor = useCreateBlockNote({
    dictionary: {
      ...en,
      ai: aiEn, // add default translations for the AI extension
    } as any,
    // Register the AI extension
    _extensions: {
      ai: createAIExtension({
        model: model as any,
      }) as any,
    },
    // Initial content for demo
    initialContent: [
      {
        type: "heading",
        props: {
          level: 1,
        },
        content: "ハッカソンサポートエージェント",
      },
      {
        type: "paragraph",
        content:
          "このエディタではAI機能を使用できます。文章を選択してAIボタンを押すか、スラッシュ（/）を入力してAIコマンドを使用してください。",
      },
      {
        type: "paragraph",
        content:
          "AI機能には文章の改善、続きの生成、要約、翻訳などがあります。プロジェクトの企画書や技術仕様書の作成にお役立てください。",
      },
    ],
  });

  // Renders the editor instance using a React component
  return (
    <div>
      <BlockNoteView
        editor={editor}
        // We're disabling some default UI elements
        formattingToolbar={false}
        slashMenu={false}
      >
        {/* Add the AI Command menu to the editor */}
        <AIMenuController />

        {/* Custom formatting toolbar with AI button */}
        <FormattingToolbarWithAI />

        {/* Custom slash menu with AI options */}
        <SuggestionMenuWithAI editor={editor} />
      </BlockNoteView>
    </div>
  );
}

// Formatting toolbar with the `AIToolbarButton` added
function FormattingToolbarWithAI() {
  return (
    <FormattingToolbarController
      formattingToolbar={() => (
        <FormattingToolbar>
          {getFormattingToolbarItems()}
          {/* Add the AI button */}
          <AIToolbarButton />
        </FormattingToolbar>
      )}
    />
  );
}

// Slash menu with the AI option added
function SuggestionMenuWithAI(props: {
  editor: BlockNoteEditor<any, any, any>;
}) {
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={async (query) =>
        filterSuggestionItems(
          [
            ...getDefaultReactSlashMenuItems(props.editor),
            // add the default AI slash menu items
            ...getAISlashMenuItems(props.editor),
          ],
          query,
        )
      }
    />
  );
}
