"use client";
import type { DataUIPart } from "ai";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { useSaveDocument } from "@/hooks/chat-sync-hooks";
import { useArtifact } from "@/hooks/use-artifact";
import type { CustomUIDataTypes, UiToolName } from "@/lib/ai/types";
import type { ArtifactInfo } from "@/lib/artifacts/types";
import { useChatId } from "@/providers/chat-id-provider";
import { useChatInput } from "@/providers/chat-input-provider";
import { useSession } from "@/providers/session-provider";
import { artifactDefinitions } from "./artifact-panel";
import { useDataStream } from "./data-stream-provider";

function handleResearchUpdate({
  delta,
  setSelectedTool,
}: {
  delta: DataUIPart<CustomUIDataTypes>;
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
  delta: DataUIPart<CustomUIDataTypes>;
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
  delta: DataUIPart<CustomUIDataTypes>;
  setArtifact: ReturnType<typeof useArtifact>["setArtifact"];
}): void {
  setArtifact((draftArtifact) => {
    switch (delta.type) {
      case "data-artifactInfo": {
        const info = delta.data as ArtifactInfo;
        return {
          ...draftArtifact,
          documentId: info.id,
          title: info.title,
          messageId: info.messageId,
          kind: info.kind,
          status: "streaming",
        };
      }

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
  delta: DataUIPart<CustomUIDataTypes>;
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

export function DataStreamHandler({ id }: { id: string }) {
  const { dataStream } = useDataStream();
  const { artifact, setArtifact, setMetadata } = useArtifact();
  const lastProcessedIndex = useRef(-1);
  const { data: session } = useSession();
  const { setSelectedTool } = useChatInput();

  const { confirmChatId } = useChatId();
  const saveDocumentMutation = useSaveDocument(artifact.messageId);
  const isAuthenticated = !!session;

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    for (const delta of newDeltas) {
      if (
        delta.type === "data-chatConfirmed" &&
        isAuthenticated &&
        id === delta.data.chatId
      ) {
        confirmChatId(delta.data.chatId);
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
    confirmChatId,
    id,
  ]);

  return null;
}
