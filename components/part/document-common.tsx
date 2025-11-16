import { memo } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import type { ChatMessage } from "@/lib/ai/types";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
import { FileIcon, LoaderIcon, MessageIcon, PencilEditIcon } from "../icons";

export type CreateDocumentTool = Extract<
  ChatMessage["parts"][number],
  { type: "tool-createDocument" }
>;
export type UpdateDocumentTool = Extract<
  ChatMessage["parts"][number],
  { type: "tool-updateDocument" }
>;
export type RequestSuggestionsTool = Extract<
  ChatMessage["parts"][number],
  { type: "tool-requestSuggestions" }
>;

export const hasProp = <T extends string>(
  obj: unknown,
  prop: T
): obj is Record<T, unknown> =>
  typeof obj === "object" && obj !== null && prop in obj;

export const isArtifactToolResult = (
  o: unknown
): o is { id: string; title: string; kind: ArtifactKind } =>
  hasProp(o, "id") &&
  typeof o.id === "string" &&
  hasProp(o, "title") &&
  typeof o.title === "string" &&
  hasProp(o, "kind") &&
  typeof o.kind === "string";

const getActionText = (
  type: "create" | "update" | "request-suggestions",
  tense: "present" | "past"
) => {
  switch (type) {
    case "create":
      return tense === "present" ? "Creating" : "Created";
    case "update":
      return tense === "present" ? "Updating" : "Updated";
    case "request-suggestions":
      return tense === "present"
        ? "Adding suggestions"
        : "Added suggestions to";
    default:
      return null;
  }
};

const getIconForType = (type: "create" | "update" | "request-suggestions") => {
  if (type === "create") {
    return <FileIcon />;
  }
  if (type === "update") {
    return <PencilEditIcon />;
  }
  if (type === "request-suggestions") {
    return <MessageIcon />;
  }
  return null;
};

type DocumentToolResultProps = {
  type: "create" | "update" | "request-suggestions";
  result: {
    id: string;
    title: string;
    kind: ArtifactKind;
  };
  isReadonly: boolean;
  messageId: string;
};

function PureDocumentToolResult({
  type,
  result,
  isReadonly: _isReadonly,
  messageId,
}: DocumentToolResultProps) {
  const { setArtifact } = useArtifact();

  return (
    <button
      className="flex w-fit cursor-pointer flex-row items-start gap-3 rounded-xl border bg-background px-3 py-2"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();

        const boundingBox = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };

        setArtifact({
          documentId: result.id,
          kind: result.kind,
          content: "",
          title: result.title,
          messageId,
          isVisible: true,
          status: "idle",
          boundingBox,
        });
      }}
      type="button"
    >
      <div className="mt-1 text-muted-foreground">{getIconForType(type)}</div>
      <div className="text-left">
        {`${getActionText(type, "past")} "${result.title}"`}
      </div>
    </button>
  );
}

export const DocumentToolResult = memo(PureDocumentToolResult, () => true);

type DocumentToolCallProps = {
  type: "create" | "update" | "request-suggestions";
  args: { title?: string };
  isReadonly: boolean;
};

function PureDocumentToolCall({
  type,
  args,
  isReadonly: _isReadonly,
}: DocumentToolCallProps) {
  const { setArtifact } = useArtifact();

  return (
    <button
      className="cursor pointer flex w-fit flex-row items-start justify-between gap-3 rounded-xl border px-3 py-2"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();

        const boundingBox = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };

        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          isVisible: true,
          boundingBox,
        }));
      }}
      type="button"
    >
      <div className="flex flex-row items-start gap-3">
        <div className="mt-1 text-zinc-500">{getIconForType(type)}</div>

        <div className="text-left">
          {`${getActionText(type, "present")} ${args.title ? `"${args.title}"` : ""}`}
        </div>
      </div>

      <div className="mt-1 animate-spin">{<LoaderIcon />}</div>
    </button>
  );
}

export const DocumentToolCall = memo(PureDocumentToolCall, () => true);
