"use client";

import {
  type InitialConfigType,
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  COMMAND_PRIORITY_HIGH,
  type EditorState,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
} from "lexical";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Plugin to handle Enter key submissions
function EnterKeySubmitPlugin({
  onEnterSubmit,
}: {
  onEnterSubmit?: (event: KeyboardEvent) => boolean;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        // Call the custom handler if provided
        if (onEnterSubmit) {
          const handled = onEnterSubmit(event);
          if (handled) {
            // Prevent the default Enter behavior immediately
            event.preventDefault();
            // Prevent default Enter behavior (adding newline)
            return true;
          }
        }
        // Allow default behavior for non-submit cases (Shift+Enter, etc.)
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, onEnterSubmit]);

  return null;
}

// Plugin to get editor instance for imperative ref
function EditorRefPlugin({
  setEditor,
}: {
  setEditor: (editor: LexicalEditor) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    setEditor(editor);
  }, [editor, setEditor]);

  return null;
}

type LexicalChatInputRef = {
  focus: () => void;
  clear: () => void;
  getValue: () => string;
};

type LexicalChatInputProps = {
  initialValue?: string;
  onInputChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void;
  onEnterSubmit?: (event: KeyboardEvent) => boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  maxRows?: number;
  "data-testid"?: string;
};

const theme = {
  root: "lexical-root",
  ltr: "ltr",
  rtl: "rtl",
  placeholder: "editor-placeholder",
  paragraph: "editor-paragraph",
};

function onError(error: Error) {
  console.error("Lexical error:", error);
}

export const LexicalChatInput = ({
  initialValue = "",
  onInputChange,
  onKeyDown,
  onPaste,
  onEnterSubmit,
  placeholder = "Type a message...",
  autoFocus = false,
  className,
  "data-testid": testId,
  ref,
  ..._props
}: LexicalChatInputProps & {
  ref?: RefObject<LexicalChatInputRef | null>;
}) => {
  const [editor, setEditor] = useState<LexicalEditor | null>(null);

  const initialConfig: InitialConfigType = {
    namespace: "LexicalChatInput",
    theme,
    onError,
    nodes: [],
  };

  const handleChange = useCallback(
    (editorState: EditorState) => {
      if (onInputChange) {
        editorState.read(() => {
          const root = $getRoot();
          const textContent = root.getTextContent();
          onInputChange(textContent);
        });
      }
    },
    [onInputChange]
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (editor) {
          editor.focus();
        }
      },
      clear: () => {
        if (editor) {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
          });
        }
      },
      getValue: () => {
        if (editor) {
          return editor.getEditorState().read(() => {
            const root = $getRoot();
            return root.getTextContent();
          });
        }
        return "";
      },
    }),
    [editor]
  );

  // Initialize editor with initialValue on mount only
  // Note: We only initialize once. For editing different messages,
  // a new component instance is created with a different key prop.
  useEffect(() => {
    if (editor && initialValue !== undefined) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        if (initialValue) {
          const textNode = $createTextNode(initialValue);
          paragraph.append(textNode);
        }
        root.append(paragraph);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]); // Only run on mount when editor is created

  const PlaceholderComponent = useCallback(
    () => (
      <div className="lexical-placeholder pointer-events-none absolute pt-2 pl-3 text-muted-foreground">
        {placeholder}
      </div>
    ),
    [placeholder]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className="lexical-editor-container"
        style={{
          borderTop: "0px",
        }}
      >
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              className={cn(
                "focus:outline-hidden focus-visible:outline-hidden",
                "[&>.lexical-root]:min-h-[20px] [&>.lexical-root]:outline-hidden",
                "lexical-content-editable",
                "editor-input",
                className
              )}
              data-testid={testId}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              spellCheck={true}
              style={{
                WebkitBoxShadow: "none",
                MozBoxShadow: "none",
                boxShadow: "none",
              }}
              // aria-placeholder={placeholder}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
          placeholder={<PlaceholderComponent />}
        />
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        {/* {autoFocus && <AutoFocusPlugin />} */}
        <EditorRefPlugin setEditor={setEditor} />
        <EnterKeySubmitPlugin onEnterSubmit={onEnterSubmit} />
      </div>
    </LexicalComposer>
  );
};

LexicalChatInput.displayName = "LexicalChatInput";

export type { LexicalChatInputRef };
