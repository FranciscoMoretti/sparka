import type { LexicalEditor } from "lexical";
import {
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
} from "lexical";
import { Suggestion as PreviewSuggestion } from "@/components/suggestion";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
import type { Suggestion } from "@/lib/db/schema";

export interface UISuggestion extends Suggestion {
  selectionStart: number;
  selectionEnd: number;
}

type Position = {
  start: number;
  end: number;
};

function findPositionsInEditor(
  editor: LexicalEditor,
  searchText: string
): Position | null {
  let positions: { start: number; end: number } | null = null;

  editor.getEditorState().read(() => {
    const root = $getRoot();
    let currentPos = 0;

    function checkTextNodeForMatch(node: LexicalNode): boolean {
      if (!$isTextNode(node)) {
        return false;
      }

      const text = node.getTextContent();
      if (!text.includes(searchText)) {
        return false;
      }

      const index = text.indexOf(searchText);
      if (index === -1) {
        return false;
      }

      positions = {
        start: currentPos + index,
        end: currentPos + index + searchText.length,
      };
      return true;
    }

    function traverseChildren(node: LexicalNode): void {
      if (!$isElementNode(node)) {
        return;
      }

      const children = node.getChildren();
      for (const child of children) {
        traverse(child);
        if (positions) {
          return;
        }
      }
    }

    function traverse(node: LexicalNode): void {
      if (checkTextNodeForMatch(node)) {
        return;
      }

      if ($isTextNode(node)) {
        currentPos += node.getTextContent().length;
      }

      traverseChildren(node);
    }

    traverse(root);
  });

  return positions;
}

export function projectWithPositions(
  editor: LexicalEditor,
  suggestions: Suggestion[]
): UISuggestion[] {
  return suggestions.map((suggestion) => {
    const positions = findPositionsInEditor(editor, suggestion.originalText);

    if (!positions) {
      return {
        ...suggestion,
        selectionStart: 0,
        selectionEnd: 0,
      };
    }

    return {
      ...suggestion,
      selectionStart: positions.start,
      selectionEnd: positions.end,
    };
  });
}

// Lexical Decorator Node for suggestions
export class SuggestionNode extends DecoratorNode<React.ReactElement> {
  __suggestion: UISuggestion;
  __editor: LexicalEditor;
  __artifactKind: ArtifactKind;

  static getType(): string {
    return "suggestion";
  }

  static clone(node: SuggestionNode): SuggestionNode {
    return new SuggestionNode(
      node.__suggestion,
      node.__editor,
      node.__artifactKind,
      node.__key
    );
  }

  constructor(
    suggestion: UISuggestion,
    editor: LexicalEditor,
    artifactKind: ArtifactKind = "text",
    key?: NodeKey
  ) {
    super(key);
    this.__suggestion = suggestion;
    this.__editor = editor;
    this.__artifactKind = artifactKind;
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("span");
    dom.className = "suggestion-highlight";
    return dom;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): React.ReactElement {
    const onApply = () => {
      this.__editor.update(() => {
        // Find and replace the text
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const node = selection.anchor.getNode();
          if ($isTextNode(node)) {
            const textContent = node.getTextContent();
            const newText = textContent.replace(
              this.__suggestion.originalText,
              this.__suggestion.suggestedText
            );
            node.setTextContent(newText);
          }
        }

        // Remove this suggestion node
        this.remove();
      });
    };

    return (
      <PreviewSuggestion
        artifactKind={this.__artifactKind}
        onApply={onApply}
        suggestion={this.__suggestion}
      />
    );
  }
}

export function createSuggestionDecorator(
  suggestion: UISuggestion,
  editor: LexicalEditor,
  artifactKind: ArtifactKind = "text"
): SuggestionNode {
  return new SuggestionNode(suggestion, editor, artifactKind);
}

// Plugin-like function to register suggestions
export function registerSuggestions(
  editor: LexicalEditor,
  suggestions: UISuggestion[]
): void {
  editor.update(() => {
    // Clear existing suggestion nodes
    const root = $getRoot();
    const children = root.getChildren();

    for (const child of children) {
      if (child instanceof SuggestionNode) {
        child.remove();
      }
    }

    // Add new suggestion nodes
    for (const suggestion of suggestions) {
      if (suggestion.selectionStart && suggestion.selectionEnd) {
        const suggestionNode = createSuggestionDecorator(suggestion, editor);
        // Insert at the end for now - proper positioning would need more work
        root.append(suggestionNode);
      }
    }
  });
}
