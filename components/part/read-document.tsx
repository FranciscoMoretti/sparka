"use client";

import { memo } from "react";
import { FileIcon } from "../icons";

type ReadDocumentProps = {
  result?: {
    id: string;
    title: string;
    kind: string;
    content: string;
  };
};

function PureReadDocument({ result }: ReadDocumentProps) {
  if (!result) {
    return null;
  }

  return (
    <div className="flex w-fit items-center gap-3 rounded-xl px-3 py-2 text-muted-foreground">
      <FileIcon />
      <div className="flex items-center gap-1 text-left text-sm">
        <div className="">Read</div>
        <div className="">&ldquo;{result.title}&rdquo;</div>
      </div>
    </div>
  );
}

export const ReadDocument = memo(PureReadDocument, () => true);
