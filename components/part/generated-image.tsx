"use client";

import { toast } from "sonner";
import { CopyIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type GeneratedImageProps = {
  result?: {
    imageUrl: string;
    prompt: string;
  };
  args?: {
    prompt: string;
  };
  isLoading?: boolean;
};

export function GeneratedImage({
  result,
  args,
  isLoading,
}: GeneratedImageProps) {
  const handleCopyImage = async () => {
    if (!result?.imageUrl) {
      return;
    }

    try {
      const response = await fetch(result.imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      toast.success("Copied image to clipboard!");
    } catch (_error) {
      toast.error("Failed to copy image to clipboard");
    }
  };

  if (isLoading || !result) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-8">
        <div className="h-64 w-full animate-pulse rounded-lg bg-muted-foreground/20" />
        <div className="text-muted-foreground">
          Generating image: &quot;{args?.prompt}&quot;
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 overflow-hidden rounded-lg border">
      <div className="group relative">
        {/* biome-ignore lint/performance/noImgElement: Next/Image isn't desired for dynamic external URLs here */}
        <img
          alt={result.prompt}
          className="h-auto w-full max-w-full"
          src={result.imageUrl}
        />
        <button
          className={cn(
            "absolute top-2 right-2 rounded-lg bg-black/50 p-2 hover:bg-black/70",
            "opacity-0 transition-opacity group-hover:opacity-100",
            "flex items-center gap-2 text-white"
          )}
          onClick={handleCopyImage}
          type="button"
        >
          <CopyIcon size={16} />
        </button>
      </div>
      <div className="p-4 pt-0">
        <p className="text-muted-foreground text-sm">
          Generated from: &quot;{result.prompt}&quot;
        </p>
      </div>
    </div>
  );
}
