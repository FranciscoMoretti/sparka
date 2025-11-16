// Utilities for client-side file preparation prior to upload

import imageCompression from "browser-image-compression";

const FILE_EXTENSION_REGEX = /\.[^.]+$/;

export async function compressImageIfNeeded(
  file: File,
  {
    maxBytes,
    maxDimension,
    minQuality = 0.5,
  }: {
    maxBytes: number;
    maxDimension: number;
    minQuality?: number;
  }
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }
  if (file.size <= maxBytes) {
    return file;
  }

  // Only compress JPEG/PNG. Leave others unchanged.
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    return file;
  }

  const outputMime = file.type;

  const options = {
    maxSizeMB: maxBytes / (1024 * 1024),
    maxWidthOrHeight: maxDimension,
    useWebWorker: true,
    fileType: outputMime,
    initialQuality: Math.min(0.9, Math.max(minQuality, 0.1)),
  } as const;

  try {
    const maybeResult = await imageCompression(file, options);
    const resultBlob =
      maybeResult instanceof File
        ? maybeResult
        : new File([maybeResult], file.name, {
            type: outputMime,
            lastModified: Date.now(),
          });
    if (resultBlob.size >= file.size) {
      return file;
    }

    const base = file.name.replace(FILE_EXTENSION_REGEX, "");
    let ext: string;
    if (outputMime === "image/jpeg") {
      ext = "jpg";
    } else if (outputMime === "image/png") {
      ext = "png";
    } else {
      ext = outputMime.split("/")[1] ?? "jpg";
    }
    return new File([resultBlob], `${base}.${ext}`, {
      type: outputMime,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export async function processFilesForUpload(
  files: File[],
  options: {
    maxBytes: number;
    maxDimension: number;
  }
): Promise<{
  processedImages: File[];
  pdfFiles: File[];
  stillOversized: File[];
  unsupportedFiles: File[];
}> {
  const processedImages: File[] = [];
  const pdfFiles: File[] = [];
  const stillOversized: File[] = [];
  const unsupportedFiles: File[] = [];
  const maxBytes = options.maxBytes;

  for (const file of files) {
    if (file.type.startsWith("image/")) {
      const maybeCompressed = await compressImageIfNeeded(file, options);
      if (maybeCompressed.size > maxBytes) {
        stillOversized.push(file);
        continue;
      }
      processedImages.push(maybeCompressed);
    } else if (file.type === "application/pdf") {
      if (file.size > maxBytes) {
        stillOversized.push(file);
        continue;
      }
      pdfFiles.push(file);
    } else {
      unsupportedFiles.push(file);
    }
  }

  return { processedImages, pdfFiles, stillOversized, unsupportedFiles };
}
