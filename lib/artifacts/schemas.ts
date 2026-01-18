import z from "zod";
import type { ArtifactKind } from "./artifact-kind";
import type { StreamableArtifact } from "./streamable-artifact";

export const TextArtifact: StreamableArtifact<z.ZodString, z.ZodString> = {
  contentSchema: z.string(),
  deltaSchema: z.string(),
  reduceDelta: (accumulator, delta) => accumulator + delta,
};

export const CodeArtifact: StreamableArtifact<z.ZodString, z.ZodString> = {
  contentSchema: z.string(),
  deltaSchema: z.string(),
  reduceDelta: (accumulator, delta) => accumulator + delta,
};

export const SheetArtifact: StreamableArtifact<z.ZodString, z.ZodString> = {
  contentSchema: z.string(),
  deltaSchema: z.string(),
  reduceDelta: (accumulator, delta) => accumulator + delta,
};

export const artifacts: Record<
  ArtifactKind,
  StreamableArtifact<z.ZodString, z.ZodString>
> = {
  text: TextArtifact,
  code: CodeArtifact,
  sheet: SheetArtifact,
};
