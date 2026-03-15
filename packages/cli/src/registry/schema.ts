import { z } from "zod";

export const registryToolFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  type: z.enum(["tool", "renderer"]),
  target: z.string(),
});

export const registryToolItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  files: z.array(registryToolFileSchema),
});

export type RegistryToolItem = z.infer<typeof registryToolItemSchema>;
export type RegistryToolItemFile = z.infer<typeof registryToolFileSchema>;
