import { experimental_generateVideo as generateVideo, tool } from "ai";
import { z } from "zod";
import { type AppModelId, getAppModelDefinition } from "@/lib/ai/app-models";
import { getVideoModel } from "@/lib/ai/providers";
import { uploadFile } from "@/lib/blob";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { createModuleLogger } from "@/lib/logger";
import { toolsDefinitions } from "./tools-definitions";

type GenerateVideoProps = {
  selectedModel?: string;
  costAccumulator?: CostAccumulator;
};

const log = createModuleLogger("ai.tools.generate-video");
const DEFAULT_ASPECT_RATIO = "16:9";
const DEFAULT_DURATION_SECONDS = 5;
const ALLOWED_EXTENSIONS = new Set(["mp4", "webm", "mov"]);

function resolveVideoExtension(mediaType?: string): string {
  if (!mediaType) {
    return "mp4";
  }

  const [, subtypeWithParams] = mediaType.split("/");
  if (!subtypeWithParams) {
    return "mp4";
  }

  const subtype = subtypeWithParams.split(";")[0]?.trim().toLowerCase();
  if (!subtype) {
    return "mp4";
  }

  const mappedSubtype = subtype === "quicktime" ? "mov" : subtype;
  return ALLOWED_EXTENSIONS.has(mappedSubtype) ? mappedSubtype : "mp4";
}

async function resolveVideoModel(selectedModel?: string): Promise<string> {
  if (selectedModel) {
    try {
      const model = await getAppModelDefinition(selectedModel as AppModelId);
      if (model.output.video) {
        return selectedModel;
      }
    } catch {
      // Not in app models registry, fall through
    }
  }
  return config.ai.tools.video.default;
}

export const generateVideoTool = ({
  selectedModel,
  costAccumulator,
}: GenerateVideoProps = {}) =>
  tool({
    description:
      "Generate a short video clip from a text prompt. Use this when the user asks to create, make, or generate a video.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe("A descriptive prompt for the video to generate."),
      aspectRatio: z
        .enum(["16:9", "9:16", "1:1"])
        .optional()
        .describe("Optional output aspect ratio. Defaults to 16:9."),
      durationSeconds: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Optional video duration in seconds. Defaults to 5."),
    }),
    execute: async ({ prompt, aspectRatio, durationSeconds }) => {
      const startMs = Date.now();
      const finalAspectRatio = aspectRatio ?? DEFAULT_ASPECT_RATIO;
      const finalDurationSeconds = durationSeconds ?? DEFAULT_DURATION_SECONDS;

      log.info(
        {
          promptLength: prompt.length,
          selectedModel,
          aspectRatio: finalAspectRatio,
          durationSeconds: finalDurationSeconds,
        },
        "generateVideo: start"
      );

      try {
        const modelId = await resolveVideoModel(selectedModel);
        const isGoogleModel =
          modelId.startsWith("google/") || modelId.includes("gemini");

        log.debug({ modelId }, "generateVideo: resolved model");

        const result = await generateVideo({
          model: getVideoModel(modelId),
          prompt,
          aspectRatio: finalAspectRatio,
          duration: finalDurationSeconds,
          providerOptions: {
            ...(isGoogleModel && {
              google: {
                aspectRatio: finalAspectRatio,
              },
            }),
          },
        });

        const video = result.video;
        if (!video) {
          throw new Error("No video generated");
        }

        const buffer = Buffer.from(video.uint8Array);
        const timestamp = Date.now();
        const ext = resolveVideoExtension(video.mediaType);
        const filename = `generated-video-${timestamp}.${ext}`;
        const uploaded = await uploadFile(filename, buffer);

        costAccumulator?.addAPICost(
          "generateVideo",
          toolsDefinitions.generateVideo.cost
        );

        log.info(
          {
            ms: Date.now() - startMs,
            modelId,
            videoUrl: uploaded.url,
          },
          "generateVideo: success"
        );

        return { videoUrl: uploaded.url, prompt };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "";
        const isUnsupportedVideoGateway = errorMessage.includes(
          "does not support video models"
        );

        log.error(
          {
            ms: Date.now() - startMs,
            selectedModel,
            error:
              error instanceof Error
                ? { message: error.message, name: error.name }
                : error,
          },
          "generateVideo: failure"
        );

        if (isUnsupportedVideoGateway) {
          throw new Error(
            "Video generation is not available for the active gateway."
          );
        }

        throw error;
      }
    },
  });
