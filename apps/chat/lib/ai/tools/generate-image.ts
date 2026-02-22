import { type FileUIPart, generateImage, generateText, tool } from "ai";
import { z } from "zod";
import { type AppModelId, getAppModelDefinition } from "@/lib/ai/app-models";
import { getImageModel, getMultimodalImageModel } from "@/lib/ai/providers";
import { uploadFile } from "@/lib/blob";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { createModuleLogger } from "@/lib/logger";

type GenerateImageProps = {
  attachments?: FileUIPart[];
  lastGeneratedImage?: { imageUrl: string; name: string } | null;
  selectedModel?: string;
  costAccumulator?: CostAccumulator;
};

const log = createModuleLogger("ai.tools.generate-image");

type ImageMode = "edit" | "generate";

/**
 * Resolve which model to use for image generation and whether it's a
 * multimodal language model (uses generateText) or a dedicated image model
 * (uses generateImage). Uses the dynamic model registry so it works across
 * all gateways, not just the static models.generated snapshot.
 */
async function resolveImageModel(selectedModel?: string): Promise<{
  modelId: string;
  multimodal: boolean;
}> {
  // If the user's selected chat model can generate images, prefer it
  if (selectedModel) {
    try {
      const model = await getAppModelDefinition(selectedModel as AppModelId);
      if (model.output.image) {
        return { modelId: selectedModel, multimodal: true };
      }
    } catch {
      // Not in app models registry, fall through
    }
  }

  // Fall back to the configured default image model
  const defaultId = config.ai.tools.image.default;
  try {
    const model = await getAppModelDefinition(defaultId as AppModelId);
    // Default could be a multimodal language model (e.g. gemini-3-pro-image)
    if (model.output.image) {
      return { modelId: defaultId, multimodal: true };
    }
  } catch {
    // Not in app models registry → dedicated image model (e.g. dall-e-3)
  }

  return { modelId: defaultId, multimodal: false };
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function collectEditImages({
  imageParts,
  lastGeneratedImage,
}: {
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
}): Promise<Buffer[]> {
  return await Promise.all([
    ...(lastGeneratedImage
      ? [fetchImageBuffer(lastGeneratedImage.imageUrl)]
      : []),
    ...imageParts.map((p) => fetchImageBuffer(p.url)),
  ]);
}

function serializeError(err: unknown): {
  name?: string;
  message: string;
  stack?: string;
  raw?: unknown;
} {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }

  // Handle Promise-like objects (shouldn't happen but does sometimes)
  if (err && typeof err === "object" && "then" in err) {
    return { message: "Error was a Promise - check raw", raw: err };
  }

  // Handle objects with message property
  if (err && typeof err === "object" && "message" in err) {
    const e = err as { message: unknown; name?: unknown };
    return {
      message: String(e.message),
      name: e.name ? String(e.name) : undefined,
    };
  }

  return { message: String(err), raw: err };
}

async function resolveError(error: unknown): Promise<unknown> {
  if (error && typeof error === "object" && "then" in error) {
    return await (error as Promise<unknown>).catch((e) => e);
  }
  return error;
}

function getErrorDebugInfo(err: unknown) {
  return {
    errorType: typeof err,
    errorConstructor: (err as { constructor?: { name?: string } })?.constructor
      ?.name,
    errorKeys: err && typeof err === "object" ? Object.keys(err) : [],
  };
}

async function runGenerateImageTraditional({
  mode,
  prompt,
  imageParts,
  lastGeneratedImage,
  startMs,
  costAccumulator,
}: {
  mode: ImageMode;
  prompt: string;
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  startMs: number;
  costAccumulator?: CostAccumulator;
}): Promise<{ imageUrl: string; prompt: string }> {
  let promptInput:
    | string
    | {
        text: string;
        images: Buffer[];
      };

  if (mode === "edit") {
    log.debug(
      {
        note: "OpenAI edit mode",
        lastGeneratedCount: lastGeneratedImage ? 1 : 0,
        attachmentCount: imageParts.length,
      },
      "generateImage: preparing edit images"
    );

    const inputImages = await collectEditImages({
      imageParts,
      lastGeneratedImage,
    });
    promptInput = { text: prompt, images: inputImages };
  } else {
    promptInput = prompt;
  }

  const res = await generateImage({
    model: getImageModel(config.ai.tools.image.default),
    prompt: promptInput,
    n: 1,
    providerOptions: {
      telemetry: { isEnabled: true },
    },
  });

  log.debug(
    {
      mode,
      base64Length: res.images?.[0]?.base64?.length ?? 0,
    },
    "generateImage: provider response received"
  );

  const buffer = Buffer.from(res.images[0].base64, "base64");
  const timestamp = Date.now();
  const filename = `generated-image-${timestamp}.png`;
  const result = await uploadFile(filename, buffer);

  if (res.usage) {
    costAccumulator?.addLLMCost(
      config.ai.tools.image.default as AppModelId,
      {
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
      },
      "generateImage-traditional"
    );
  }

  log.info(
    {
      mode,
      ms: Date.now() - startMs,
      imageUrl: result.url,
      uploadedFilename: filename,
    },
    "generateImage: success"
  );

  return { imageUrl: result.url, prompt };
}

async function runGenerateImageMultimodal({
  modelId,
  mode,
  prompt,
  imageParts,
  lastGeneratedImage,
  startMs,
  costAccumulator,
}: {
  modelId: string;
  mode: ImageMode;
  prompt: string;
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  startMs: number;
  costAccumulator?: CostAccumulator;
}): Promise<{ imageUrl: string; prompt: string }> {
  // Build messages with image context if in edit mode
  type ImageContent = { type: "image"; image: URL };
  type TextContent = { type: "text"; text: string };
  const userContent: Array<TextContent | ImageContent> = [];

  // Add reference images if in edit mode
  if (mode === "edit") {
    if (lastGeneratedImage) {
      userContent.push({
        type: "image",
        image: new URL(lastGeneratedImage.imageUrl),
      });
    }
    for (const part of imageParts) {
      userContent.push({ type: "image", image: new URL(part.url) });
    }
  }

  // Add the prompt with instruction to generate image
  userContent.push({
    type: "text",
    text:
      mode === "edit"
        ? `Based on the provided image(s), ${prompt}`
        : `Generate an image: ${prompt}`,
  });

  log.debug(
    {
      modelId,
      mode,
      imageCount: userContent.filter((c) => c.type === "image").length,
    },
    "generateImage: using multimodal model"
  );

  const isGoogleModel =
    modelId.startsWith("google/") || modelId.includes("gemini");
  const isOpenAIModel = modelId.startsWith("openai/");

  const res = await generateText({
    model: getMultimodalImageModel(modelId),
    messages: [{ role: "user", content: userContent }],
    providerOptions: {
      ...(isGoogleModel && {
        google: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
      ...(isOpenAIModel && {
        openai: {
          modalities: ["text", "image"],
        },
      }),
    },
  });

  // Track LLM cost for multimodal image generation

  if (res.usage) {
    costAccumulator?.addLLMCost(
      modelId as AppModelId,
      res.usage,
      "generateImage-multimodal"
    );
  }

  // Find the first image in the response files
  const imageFile = res.files?.find((f) => f.mediaType.startsWith("image/"));
  if (!imageFile) {
    throw new Error("No image generated by multimodal model");
  }

  log.debug(
    {
      mode,
      mediaType: imageFile.mediaType,
      hasBase64: !!imageFile.base64,
    },
    "generateImage: multimodal response received"
  );

  const buffer = Buffer.from(imageFile.uint8Array);
  const timestamp = Date.now();
  const ext = imageFile.mediaType.split("/")[1] || "png";
  const filename = `generated-image-${timestamp}.${ext}`;
  const result = await uploadFile(filename, buffer);

  log.info(
    {
      mode,
      modelId,
      ms: Date.now() - startMs,
      imageUrl: result.url,
      uploadedFilename: filename,
    },
    "generateImage: multimodal success"
  );

  return { imageUrl: result.url, prompt };
}

export const generateImageTool = ({
  attachments = [],
  lastGeneratedImage = null,
  selectedModel,
  costAccumulator,
}: GenerateImageProps = {}) =>
  tool({
    description: `Generate an image from a user-provided prompt.

The assistant may make small, neutral adjustments to improve clarity, composition, or technical quality, while strictly preserving the user’s original intent, meaning, and message.

The assistant must not add new subjects, claims, branding, or alter the tone or intent of the prompt.
`,
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          "The user’s image prompt. The original intent, message, and meaning must remain unchanged. No new ideas, claims, or content may be introduced."
        ),
    }),
    execute: async ({ prompt }) => {
      const startMs = Date.now();
      const imageParts = attachments.filter(
        (part) => part.type === "file" && part.mediaType?.startsWith("image/")
      );

      const mode: ImageMode =
        imageParts.length > 0 || lastGeneratedImage !== null
          ? "edit"
          : "generate";

      log.info(
        {
          mode,
          selectedModel,
          attachmentCount: imageParts.length,
          hasLastGeneratedImage: lastGeneratedImage !== null,
          promptLength: prompt.length,
        },
        "generateImage: start"
      );

      try {
        const { modelId: effectiveModelId, multimodal } =
          await resolveImageModel(selectedModel);

        // Use multimodal path for language models with image generation
        if (multimodal) {
          return await runGenerateImageMultimodal({
            modelId: effectiveModelId,
            mode,
            prompt,
            imageParts,
            lastGeneratedImage,
            startMs,
            costAccumulator,
          });
        }

        // Traditional image generation for dedicated image models
        return await runGenerateImageTraditional({
          mode,
          prompt,
          imageParts,
          lastGeneratedImage,
          startMs,
          costAccumulator,
        });
      } catch (error) {
        const resolvedError = await resolveError(error);
        log.error(
          {
            mode,
            selectedModel,
            ms: Date.now() - startMs,
            error: serializeError(resolvedError),
            ...getErrorDebugInfo(resolvedError),
          },
          "generateImage: failure"
        );
        throw resolvedError;
      }
    },
  });
