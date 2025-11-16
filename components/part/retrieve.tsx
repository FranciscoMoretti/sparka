"use client";

import { ChevronDown, ExternalLink, Globe, TextIcon } from "lucide-react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/lib/ai/types";

export type RetrieveTool = Extract<
  ChatMessage["parts"][number],
  { type: "tool-retrieve" }
>;

function LoadingState() {
  return (
    <div className="my-4 rounded-xl border border-neutral-200 bg-linear-to-b from-white to-neutral-50 p-4 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-900/90">
      <div className="flex items-center gap-4">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10" />
          <Globe className="absolute inset-0 m-auto h-5 w-5 text-primary/70" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
          <div className="space-y-1.5">
            <div className="h-3 w-full animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800/50" />
            <div className="h-3 w-2/3 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ errorMessage }: { errorMessage: string }) {
  return (
    <div className="my-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500 dark:bg-red-950/50">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
          <Globe className="h-4 w-4 text-red-600 dark:text-red-300" />
        </div>
        <div>
          <div className="font-medium text-red-700 text-sm dark:text-red-300">
            Error retrieving content
          </div>
          <div className="mt-1 text-red-600/80 text-xs dark:text-red-400/80">
            {errorMessage}
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessState({ firstItem }: { firstItem: unknown }) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-neutral-200 bg-linear-to-b from-white to-neutral-50 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-900/90">
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="relative h-10 w-10 shrink-0">
            <div className="absolute inset-0 rounded-lg bg-linear-to-br from-primary/10 to-transparent" />
            <Image
              alt=""
              className="absolute inset-0 m-auto"
              height={20}
              src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
                (firstItem && "url" in firstItem && firstItem.url) || ""
              )}`}
              width={20}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="truncate font-semibold text-lg text-neutral-900 tracking-tight dark:text-neutral-100">
              {(firstItem && "title" in firstItem && firstItem.title) ||
                "Retrieved Content"}
            </h2>
            <p className="line-clamp-2 text-neutral-600 text-sm dark:text-neutral-400">
              {(firstItem &&
                "description" in firstItem &&
                firstItem.description) ||
                "No description available"}
            </p>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
                {(firstItem &&
                  "language" in firstItem &&
                  (firstItem.language ?? "Unknown")) ||
                  "Unknown"}
              </span>
              <a
                className="inline-flex items-center gap-1.5 text-neutral-500 text-xs transition-colors hover:text-primary"
                href={
                  (firstItem && "url" in firstItem && (firstItem.url || "#")) ||
                  "#"
                }
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-3 w-3" />
                View source
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-neutral-200 border-t dark:border-neutral-800">
        <details className="group">
          <summary className="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-neutral-700 text-sm transition-colors hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/50">
            <div className="flex items-center gap-2">
              <TextIcon className="h-4 w-4 text-neutral-400" />
              <span>View content</span>
            </div>
            <ChevronDown className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="max-h-[50vh] overflow-y-auto bg-neutral-50/50 p-4 dark:bg-neutral-800/30">
            <div className="prose prose-neutral dark:prose-invert prose-sm max-w-none">
              <ReactMarkdown>
                {(firstItem &&
                  "content" in firstItem &&
                  (firstItem.content || "No content available")) ||
                  "No content available"}
              </ReactMarkdown>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

export function Retrieve({ tool }: { tool: RetrieveTool }) {
  if (tool.state === "input-available") {
    return <LoadingState />;
  }

  const { output: result } = tool;
  const topLevelError = result && "error" in result ? result.error : undefined;
  const firstItem =
    result && "results" in result && Array.isArray(result.results)
      ? result.results[0]
      : undefined;
  const firstItemError =
    firstItem && "error" in firstItem ? firstItem.error : undefined;

  if (topLevelError || firstItemError) {
    const errorMessage = topLevelError ?? firstItemError;
    return <ErrorState errorMessage={errorMessage} />;
  }

  return <SuccessState firstItem={firstItem} />;
}
