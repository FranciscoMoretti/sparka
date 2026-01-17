"use client";
import { motion } from "motion/react";
import { useWindowSize } from "usehooks-ts";
import { useSaveDocument } from "@/hooks/chat-sync-hooks";
import { useArtifact } from "@/hooks/use-artifact";
import type { Document } from "@/lib/db/schema";
import { LoaderIcon } from "./icons";
import { Button } from "./ui/button";

type VersionFooterProps = {
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  documents: Document[] | undefined;
  currentVersionIndex: number;
};

export const VersionFooter = ({
  handleVersionChange,
  documents,
  currentVersionIndex,
}: VersionFooterProps) => {
  const { artifact } = useArtifact();

  const { width } = useWindowSize();
  const isMobile = width < 768;

  const saveDocumentMutation = useSaveDocument(artifact.messageId);

  if (!documents) {
    return;
  }

  return (
    <motion.div
      animate={{ y: 0 }}
      className="flex w-full flex-col justify-between gap-4 border-t bg-background p-4 lg:flex-row"
      exit={{ y: isMobile ? 200 : 77 }}
      initial={{ y: isMobile ? 200 : 77 }}
      transition={{ type: "spring", stiffness: 140, damping: 20 }}
    >
      <div>
        <div>You are viewing a previous version</div>
        <div className="text-muted-foreground text-sm">
          Restore this version to make edits
        </div>
      </div>

      <div className="flex flex-row gap-4">
        <Button
          disabled={saveDocumentMutation.isPending}
          onClick={() => {
            const versionToRestore = documents[currentVersionIndex];

            saveDocumentMutation.mutate({
              id: artifact.documentId,
              content: versionToRestore.content ?? "",
              title: versionToRestore.title,
              kind: versionToRestore.kind,
            });
          }}
        >
          <div>Restore this version</div>
          {saveDocumentMutation.isPending && (
            <div className="animate-spin">
              <LoaderIcon />
            </div>
          )}
        </Button>
        <Button
          onClick={() => {
            handleVersionChange("latest");
          }}
          variant="outline"
        >
          Back to latest version
        </Button>
      </div>
    </motion.div>
  );
};
