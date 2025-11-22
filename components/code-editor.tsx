"use client";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { EditorState, Transaction } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { memo, useEffect, useRef } from "react";
import type { Suggestion } from "@/lib/db/schema";

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Suggestion[];
  isReadonly?: boolean;
  language?: string;
};

function getLanguageExtension(language: string) {
  switch (language) {
    case "typescript":
      return javascript({ jsx: false, typescript: true });
    case "javascript":
      return javascript({ jsx: false, typescript: false });
    case "jsx":
      return javascript({ jsx: true, typescript: false });
    case "tsx":
      return javascript({ jsx: true, typescript: true });
    default:
      return python();
  }
}

function PureCodeEditor({
  content,
  onSaveContent,
  status,
  isReadonly,
  language = "python",
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const startState = EditorState.create({
        doc: content,
        extensions: [
          basicSetup,
          getLanguageExtension(language),
          oneDark,
          EditorView.editable.of(!isReadonly),
        ],
      });

      editorRef.current = new EditorView({
        state: startState,
        parent: containerRef.current,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // NOTE: we only want to run this effect once
    // eslint-disable-next-line
  }, [content, isReadonly, language]);

  useEffect(() => {
    if (editorRef.current) {
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && !isReadonly) {
          const transaction = update.transactions.find(
            (tr) => !tr.annotation(Transaction.remote)
          );

          if (transaction) {
            const newContent = update.state.doc.toString();
            onSaveContent(newContent, true);
          }
        }
      });

      const currentSelection = editorRef.current.state.selection;

      const newState = EditorState.create({
        doc: editorRef.current.state.doc,
        extensions: [
          basicSetup,
          getLanguageExtension(language),
          oneDark,
          updateListener,
          EditorView.editable.of(!isReadonly),
        ],
        selection: currentSelection,
      });

      editorRef.current.setState(newState);
    }
  }, [onSaveContent, isReadonly, language]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = editorRef.current.state.doc.toString();

      if (status === "streaming" || currentContent !== content) {
        const transaction = editorRef.current.state.update({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
          annotations: [Transaction.remote.of(true)],
        });

        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  return (
    <div className="not-prose relative w-full text-sm" ref={containerRef} />
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  if (prevProps.suggestions !== nextProps.suggestions) {
    return false;
  }
  if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex) {
    return false;
  }
  if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) {
    return false;
  }
  if (prevProps.status === "streaming" && nextProps.status === "streaming") {
    return false;
  }
  if (prevProps.content !== nextProps.content) {
    return false;
  }
  if (prevProps.isReadonly !== nextProps.isReadonly) {
    return false;
  }
  if (prevProps.language !== nextProps.language) {
    return false;
  }

  return true;
}

export const CodeEditor = memo(PureCodeEditor, areEqual);
