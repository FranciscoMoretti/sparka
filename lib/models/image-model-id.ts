import { models } from "@/lib/ai/models.generated";

/**
 * Image model IDs use the same "{provider}/{model-name}" format.
 * Gateway-agnostic string type.
 */
export type ImageModelId = string;

// Helper: check if tuple T contains element E
type TupleIncludes<T extends readonly unknown[], E> = T extends readonly [
  infer H,
  ...infer R,
]
  ? H extends E
    ? true
    : TupleIncludes<R, E>
  : false;

// Extract language models with "image-generation" tag
type MultimodalImageModel =
  Extract<
    (typeof models)[number],
    { type: "language"; tags: readonly string[] }
  > extends infer M
    ? M extends { id: infer Id; tags: infer Tags extends readonly string[] }
      ? TupleIncludes<Tags, "image-generation"> extends true
        ? Id
        : never
      : never
    : never;

export type MultimodalImageModelId = MultimodalImageModel;

// Union of all models that can generate images
export type AnyImageModelId = ImageModelId | MultimodalImageModelId;

// Runtime: derive from models array
const multimodalImageModelIds: Set<string> = new Set(
  models
    .filter(
      (m) =>
        m.type === "language" &&
        "tags" in m &&
        (m.tags as readonly string[] | undefined)?.includes("image-generation")
    )
    .map((m) => m.id)
);

export function isMultimodalImageModel(
  modelId: string
): modelId is MultimodalImageModelId {
  return multimodalImageModelIds.has(modelId);
}
