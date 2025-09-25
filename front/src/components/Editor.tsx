"use client";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCallback, useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
interface InitialSummaryProps {
  initialSummary: string;
}

export default function Editor({ initialSummary }: InitialSummaryProps) {
  const editor = useCreateBlockNote();

  const onChange = async () => {
    const markdown = await editor.blocksToMarkdownLossy(editor.document);
    sessionStorage.setItem("specification", markdown);
  };

  const loadMarkdown = useCallback(async () => {
    const blocks = await editor.tryParseMarkdownToBlocks(initialSummary);
    editor.replaceBlocks(editor.document, blocks);
  }, [editor, initialSummary]);

  useEffect(() => {
    void loadMarkdown();
  }, [loadMarkdown]);

  return (
    <div>
      <BlockNoteView editor={editor} onChange={onChange} />
    </div>
  );
}
