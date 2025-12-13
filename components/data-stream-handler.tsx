"use client";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { useSaveDocument } from "@/hooks/chat-sync-hooks";
import { useArtifact } from "@/hooks/use-artifact";
import type { UiToolName } from "@/lib/ai/types";
import type { Suggestion } from "@/lib/db/schema";
import { useChatInput } from "@/providers/chat-input-provider";
import { useSession } from "@/providers/session-provider";
import { artifactDefinitions } from "./artifact-panel";
import { useDataStream } from "./data-stream-provider";

export type DataStreamDelta = {
  type:
    | "text-delta"
    | "code-delta"
    | "sheet-delta"
    | "image-delta"
    | "title"
    | "id"
    | "message-id"
    | "suggestion"
    | "clear"
    | "finish"
    | "kind";
  content: string | Suggestion;
};

function handleResearchUpdate({
  delta,
  setSelectedTool,
}: {
  delta: any;
  setSelectedTool: Dispatch<SetStateAction<UiToolName | null>>;
}): void {
  if (delta.type === "data-researchUpdate") {
    const update: any = (delta as any).data;
    if (update?.type === "completed") {
      setSelectedTool((current) =>
        current === "deepResearch" ? null : current
      );
    }
  }
}

function processArtifactStreamPart({
  delta,
  artifact,
  setArtifact,
  setMetadata,
}: {
  delta: any;
  artifact: ReturnType<typeof useArtifact>["artifact"];
  setArtifact: ReturnType<typeof useArtifact>["setArtifact"];
  setMetadata: ReturnType<typeof useArtifact>["setMetadata"];
}): void {
  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind
  );

  if (artifactDefinition?.onStreamPart) {
    artifactDefinition.onStreamPart({
      streamPart: delta,
      setArtifact,
      setMetadata,
    });
  }
}

function updateArtifactState({
  delta,
  setArtifact,
}: {
  delta: any;
  setArtifact: ReturnType<typeof useArtifact>["setArtifact"];
}): void {
  setArtifact((draftArtifact) => {
    switch (delta.type) {
      case "data-id":
        return {
          ...draftArtifact,
          documentId: delta.data,
          status: "streaming",
        };

      case "data-messageId":
        return {
          ...draftArtifact,
          messageId: delta.data,
          status: "streaming",
        };

      case "data-title":
        return {
          ...draftArtifact,
          title: delta.data,
          status: "streaming",
        };

      case "data-kind":
        return {
          ...draftArtifact,
          kind: delta.data,
          status: "streaming",
        };

      case "data-clear":
        return {
          ...draftArtifact,
          content: "",
          status: "streaming",
        };

      case "data-finish":
        return {
          ...draftArtifact,
          status: "idle",
        };

      default:
        return draftArtifact;
    }
  });
}

function saveArtifactForAnonymousUser({
  delta,
  artifact,
  saveDocumentMutation,
  isAuthenticated,
}: {
  delta: any;
  artifact: ReturnType<typeof useArtifact>["artifact"];
  saveDocumentMutation: ReturnType<typeof useSaveDocument>;
  isAuthenticated: boolean;
}): void {
  if (delta.type === "data-finish" && !isAuthenticated) {
    saveDocumentMutation.mutate({
      id: artifact.documentId,
      title: artifact.title,
      content: artifact.content,
      kind: artifact.kind,
    });
  }
}

export function DataStreamHandler({ id: _id }: { id: string }) {
  const { dataStream } = useDataStream();
  const { artifact, setArtifact, setMetadata } = useArtifact();
  const lastProcessedIndex = useRef(-1);
  const { data: session } = useSession();
  const { setSelectedTool } = useChatInput();
  // const { confirmChatId } = useChatId();
  const saveDocumentMutation = useSaveDocument(
    artifact.documentId,
    artifact.messageId
  );
  const isAuthenticated = !!session;

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    for (const delta of newDeltas) {
      if (delta.type === "data-chatConfirmed" && isAuthenticated) {
        // TODO: Reenable once chat threads are independent of getChatById query cache
        // confirmChatId(delta.data.chatId);
      }

      handleResearchUpdate({ delta, setSelectedTool });

      processArtifactStreamPart({
        delta,
        artifact,
        setArtifact,
        setMetadata,
      });

      updateArtifactState({ delta, setArtifact });

      saveArtifactForAnonymousUser({
        delta,
        artifact,
        saveDocumentMutation,
        isAuthenticated,
      });
    }
  }, [
    dataStream,
    setArtifact,
    setMetadata,
    artifact,
    saveDocumentMutation,
    isAuthenticated,
    setSelectedTool,
    // confirmChatId,
  ]);

  return null;
}
