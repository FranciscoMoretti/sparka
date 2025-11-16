import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { diffWords } from "diff";
import {
  $createParagraphNode,
  $getRoot,
  type EditorConfig,
  type LexicalEditor,
  TextNode,
} from "lexical";
import { useEffect } from "react";

import { createEditorConfig } from "@/lib/editor/config";

export const DiffType = {
  Unchanged: 0,
  Deleted: -1,
  Inserted: 1,
};

// Define diff types
type DiffTypeValue = (typeof DiffType)[keyof typeof DiffType];

// Custom diff text node that supports styling
class DiffTextNode extends TextNode {
  __diffType?: DiffTypeValue;

  static getType(): string {
    return "diff-text";
  }

  static clone(node: DiffTextNode): DiffTextNode {
    const newNode = new DiffTextNode(node.__text, node.__key);
    newNode.__diffType = node.__diffType;
    return newNode;
  }

  static importJSON(serializedNode: any): DiffTextNode {
    const { text, diffType } = serializedNode;
    const node = new DiffTextNode(text);
    if (diffType !== undefined) {
      node.setDiffType(diffType);
    }
    return node;
  }

  exportJSON(): any {
    return {
      ...super.exportJSON(),
      diffType: this.__diffType,
      type: "diff-text",
      version: 1,
    };
  }

  setDiffType(diffType: DiffTypeValue): void {
    const writable = this.getWritable();
    writable.__diffType = diffType;
  }

  getDiffType(): DiffTypeValue | undefined {
    return this.__diffType;
  }

  createDOM(config: EditorConfig, editor?: LexicalEditor): HTMLElement {
    const element = super.createDOM(config, editor);
    const diffType = this.getDiffType();

    if (diffType) {
      let className = "";
      switch (diffType) {
        case DiffType.Inserted:
          className =
            "bg-green-100 text-green-700 dark:bg-green-500/70 dark:text-green-300";
          break;
        case DiffType.Deleted:
          className =
            "bg-red-100 line-through text-red-600 dark:bg-red-500/70 dark:text-red-300";
          break;
        default:
          className = "";
      }
      element.className = className;
    }

    return element;
  }

  updateDOM(
    prevNode: DiffTextNode,
    dom: HTMLElement,
    config: EditorConfig
  ): boolean {
    const prevDiffType = prevNode.getDiffType();
    const currentDiffType = this.getDiffType();

    if (prevDiffType !== currentDiffType) {
      // Update classes if diff type changed
      return false; // Force recreation
    }

    return super.updateDOM(prevNode as this, dom, config);
  }
}

// Helper function to determine diff type from change object
function getDiffType(change: any): DiffTypeValue {
  if (change.added) {
    return DiffType.Inserted;
  }
  if (change.removed) {
    return DiffType.Deleted;
  }
  return DiffType.Unchanged;
}

// Proper diff computation using the diff library
function computeProperDiff(oldText: string, newText: string) {
  const changes = diffWords(oldText, newText);

  return changes.map((change) => ({
    text: change.value,
    type: getDiffType(change),
  }));
}

function DiffContentPlugin({
  oldContent,
  newContent,
}: {
  oldContent: string;
  newContent: string;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (oldContent && newContent) {
      editor.update(() => {
        const root = $getRoot();

        // Clear existing content
        const children = root.getChildren();
        for (const child of children) {
          child.remove();
        }

        // Compute proper diff using LCS algorithm
        const diffResult = computeProperDiff(oldContent, newContent);

        // Create a single paragraph with all diff nodes
        const paragraphNode = $createParagraphNode();

        for (const { text, type } of diffResult) {
          const textNode = new DiffTextNode(text);
          textNode.setDiffType(type);
          paragraphNode.append(textNode);
        }

        root.append(paragraphNode);
      });
    }
  }, [oldContent, newContent, editor]);

  return null;
}

type DiffEditorProps = {
  oldContent: string;
  newContent: string;
};

export const DiffView = ({ oldContent, newContent }: DiffEditorProps) => {
  const initialConfig = {
    ...createEditorConfig(),
    nodes: [DiffTextNode],
    editable: false,
  };

  return (
    <div className="prose dark:prose-invert relative w-full text-left">
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="lexical-editor text-left outline-hidden" />
          }
          ErrorBoundary={LexicalErrorBoundary}
          placeholder={null}
        />
        <DiffContentPlugin newContent={newContent} oldContent={oldContent} />
      </LexicalComposer>
    </div>
  );
};
