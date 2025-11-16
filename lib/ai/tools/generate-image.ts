import { experimental_generateImage, type FileUIPart, tool } from "ai";
import OpenAI, { toFile } from "openai";
import { z } from "zod";
import { DEFAULT_IMAGE_MODEL } from "@/lib/ai/app-models";
import { getImageModel } from "@/lib/ai/providers";
import { uploadFile } from "@/lib/blob";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";

type GenerateImageProps = {
  attachments?: FileUIPart[];
  lastGeneratedImage?: { imageUrl: string; name: string } | null;
};

const openaiClient: OpenAI | null = env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    })
  : null;

const log = createModuleLogger("ai.tools.generate-image");

async function prepareEditImages(
  imageParts: FileUIPart[],
  lastGeneratedImage: { imageUrl: string; name: string } | null
): Promise<File[]> {
  const inputImages = [] as File[];

  // Add lastGeneratedImage first if it exists
  if (lastGeneratedImage) {
    const response = await fetch(lastGeneratedImage.imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const lastGenImage = await toFile(buffer, lastGeneratedImage.name, {
      type: "image/png",
    });
    inputImages.push(lastGenImage);
  }

  // Add user file parts
  const partImages = await Promise.all(
    imageParts.map(async (part) => {
      const response = await fetch(part.url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Use toFile to create the proper format for OpenAI
      return await toFile(buffer, part.filename || "image.png", {
        type: part.mediaType || "image/png",
      });
    })
  );

  inputImages.push(...partImages);
  return inputImages;
}

type EditModeOptions = {
  prompt: string;
  imageParts: FileUIPart[];
  hasLastGeneratedImage: boolean;
  startMs: number;
  lastGeneratedImage: { imageUrl: string; name: string } | null;
};

async function executeEditMode({
  prompt,
  imageParts,
  hasLastGeneratedImage,
  startMs,
  lastGeneratedImage,
}: EditModeOptions): Promise<{ imageUrl: string; prompt: string }> {
  log.debug(
    {
      note: "OpenAI edit mode",
      lastGeneratedCount: hasLastGeneratedImage ? 1 : 0,
      attachmentCount: imageParts.length,
    },
    "generateImage: preparing edit images"
  );

  const inputImages = await prepareEditImages(imageParts, lastGeneratedImage);

  if (!openaiClient) {
    log.warn(
      { missingKey: true },
      "generateImage: edit requested but OPENAI_API_KEY is not set"
    );
    throw new Error("OPENAI_API_KEY is required for image edits");
  }

  const rsp = await openaiClient.images.edit({
    model: "gpt-image-1",
    image: inputImages, // Pass all images to OpenAI
    prompt,
  });

  // Convert base64 to buffer and upload to blob storage
  const buffer = Buffer.from(rsp.data?.[0]?.b64_json || "", "base64");
  const timestamp = Date.now();
  const filename = `generated-image-${timestamp}.png`;

  const result = await uploadFile(filename, buffer);

  log.info(
    {
      mode: "edit",
      ms: Date.now() - startMs,
      imageUrl: result.url,
      uploadedFilename: filename,
    },
    "generateImage: success"
  );

  return {
    imageUrl: result.url,
    prompt,
  };
}

async function executeGenerateMode(
  prompt: string,
  startMs: number
): Promise<{ imageUrl: string; prompt: string }> {
  // Non-edit case: use experimental_generateImage
  const res = await experimental_generateImage({
    model: getImageModel(DEFAULT_IMAGE_MODEL),
    prompt,
    n: 1,
    providerOptions: {
      telemetry: { isEnabled: true },
    },
  });

  log.debug(
    {
      mode: "generate",
      base64Length: res.images?.[0]?.base64?.length ?? 0,
    },
    "generateImage: provider response received"
  );

  // Convert base64 to buffer and upload to blob storage
  const buffer = Buffer.from(res.images[0].base64, "base64");
  const timestamp = Date.now();
  const filename = `generated-image-${timestamp}.png`;

  const result = await uploadFile(filename, buffer);

  log.info(
    {
      mode: "generate",
      ms: Date.now() - startMs,
      imageUrl: result.url,
      uploadedFilename: filename,
    },
    "generateImage: success"
  );

  return {
    imageUrl: result.url,
    prompt,
  };
}

export const generateImage = ({
  attachments = [],
  lastGeneratedImage = null,
}: GenerateImageProps = {}) =>
  tool({
    description: `Generate images from text descriptions. Can optionally use attached images as reference.

Use for:
- Create images, artwork, illustrations from descriptive prompts
- Generate visual content based on user requests
- Support various art styles and subjects
- Be as detailed as possible in the description
- Use attached images as visual reference when available`,
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          "Detailed description of the image to generate. Include style, composition, colors, mood, and any other relevant details."
        ),
    }),
    execute: async ({ prompt }) => {
      const startMs = Date.now();
      // Filter only image file parts for reference
      const imageParts = attachments.filter(
        (part) => part.type === "file" && part.mediaType?.startsWith("image/")
      );

      const hasLastGeneratedImage = lastGeneratedImage !== null;
      const isEdit = imageParts.length > 0 || hasLastGeneratedImage;

      log.info(
        {
          mode: isEdit ? "edit" : "generate",
          attachmentCount: imageParts.length,
          hasLastGeneratedImage,
          promptLength: prompt.length,
        },
        "generateImage: start"
      );

      try {
        if (isEdit) {
          return await executeEditMode({
            prompt,
            imageParts,
            hasLastGeneratedImage,
            startMs,
            lastGeneratedImage,
          });
        }

        return await executeGenerateMode(prompt, startMs);
      } catch (error) {
        const err = error as unknown;
        log.error(
          {
            mode: isEdit ? "edit" : "generate",
            ms: Date.now() - startMs,
            error:
              err && typeof err === "object"
                ? {
                    name: (err as Error).name,
                    message: (err as Error).message,
                    stack: (err as Error).stack,
                  }
                : { message: String(err) },
          },
          "generateImage: failure"
        );
        throw error;
      }
    },
  });
