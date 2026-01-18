import type z from "zod";

export type StreamableArtifact<
  CONTENT_SCHEMA extends z.ZodTypeAny,
  DELTA_SCHEMA extends z.ZodTypeAny,
> = {
  contentSchema: CONTENT_SCHEMA;
  deltaSchema: DELTA_SCHEMA;
  reduceDelta: (
    accumulator: z.infer<CONTENT_SCHEMA>,
    delta: z.infer<DELTA_SCHEMA>
  ) => z.infer<CONTENT_SCHEMA>;
};
