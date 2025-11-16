import type {
  DataContent,
  FilePart,
  ImagePart,
  ModelMessage,
  TextPart,
} from "ai";

// Minimal utilities to download assets from URL-based parts and inline them.

export type DownloadResult = {
  mediaType: string | undefined;
  data: Uint8Array;
};

export type DownloadImplementation = (args: {
  url: URL;
}) => Promise<DownloadResult>;

async function defaultDownload({ url }: { url: URL }): Promise<DownloadResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download asset: ${url.toString()} (${response.status})`
    );
  }
  const contentType = response.headers.get("content-type") || undefined;
  const arrayBuffer = await response.arrayBuffer();
  return { mediaType: contentType, data: new Uint8Array(arrayBuffer) };
}

function toHttpUrl(value: unknown): URL | null {
  if (value instanceof URL) {
    return value.protocol.startsWith("http") ? value : null;
  }
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Collects all http(s) URLs from file/image parts in the provided messages and downloads them.
 * Returns a map keyed by the normalized URL string.
 */
export async function downloadAssetsFromModelMessages(
  messages: ModelMessage[],
  downloadImplementation: DownloadImplementation = defaultDownload
): Promise<Record<string, DownloadResult>> {
  const urlSet = new Set<string>();

  for (const message of messages) {
    if (typeof message.content === "string") {
      continue;
    }
    for (const part of message.content) {
      if (part.type !== "file" && part.type !== "image") {
        continue;
      }
      const dataOrUrl: DataContent | URL =
        part.type === "file"
          ? (part as FilePart).data
          : (part as ImagePart).image;
      const url = toHttpUrl(dataOrUrl);
      if (url) {
        urlSet.add(url.toString());
      }
    }
  }

  const urls = Array.from(urlSet).map((u) => new URL(u));
  const downloaded = await Promise.all(
    urls.map(async (url) => ({
      url,
      data: await downloadImplementation({ url }),
    }))
  );
  return Object.fromEntries(
    downloaded.map(({ url, data }) => [url.toString(), data])
  );
}

/**
 * Inlines any URL-based file/image parts within ModelMessage[] by replacing the URLs
 * with downloaded binary data. This ensures providers receive actual bytes.
 */
function processFilePart(
  part: FilePart,
  downloaded: Record<string, DownloadResult>
): FilePart {
  const url = toHttpUrl((part as FilePart).data);
  if (!url) {
    return part;
  }
  const found = downloaded[url.toString()];
  if (!found) {
    return part;
  }
  return {
    ...part,
    data: found.data,
    // keep existing mediaType; if missing, prefer detected content-type
    mediaType: part.mediaType ?? found.mediaType ?? part.mediaType,
  };
}

function processImagePart(
  part: ImagePart,
  downloaded: Record<string, DownloadResult>
): ImagePart {
  const url = toHttpUrl((part as ImagePart).image);
  if (!url) {
    return part;
  }
  const found = downloaded[url.toString()];
  if (!found) {
    return part;
  }
  return {
    ...part,
    image: found.data,
    mediaType: part.mediaType ?? found.mediaType ?? part.mediaType,
  };
}

export async function replaceFilePartUrlByBinaryDataInMessages(
  messages: ModelMessage[],
  downloadImplementation: DownloadImplementation = defaultDownload
): Promise<ModelMessage[]> {
  const downloaded = await downloadAssetsFromModelMessages(
    messages,
    downloadImplementation
  );

  const mapPart = (
    part: TextPart | ImagePart | FilePart | any
  ): TextPart | ImagePart | FilePart | any => {
    if (part.type === "file") {
      return processFilePart(part, downloaded);
    }
    if (part.type === "image") {
      return processImagePart(part, downloaded);
    }
    // pass-through for text/tool/reasoning/etc
    return part;
  };

  return messages.map((message) => {
    if (typeof message.content === "string") {
      return message;
    }
    return {
      ...message,
      content: (
        message.content as Array<TextPart | ImagePart | FilePart | any>
      ).map(mapPart),
    } as ModelMessage;
  });
}
