import fs from "node:fs/promises";
import path from "node:path";
import { registryToolItemSchema, type RegistryToolItem } from "./schema";

export const DEFAULT_REGISTRY_URL =
  "https://registry.chatjs.dev/items/{name}.json";

export function getRegistryUrl(override?: string): string {
  return override ?? process.env.CHATJS_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;
}

export async function fetchRegistryItem(
  name: string,
  registryUrl?: string
): Promise<RegistryToolItem> {
  const template = getRegistryUrl(registryUrl);
  const resolved = template.replace("{name}", encodeURIComponent(name));

  // Resolve relative paths against process.cwd() so they work regardless of
  // where the CLI was invoked from.
  const filePath = resolved.startsWith(".")
    ? path.resolve(process.cwd(), resolved)
    : resolved;

  let raw: unknown;

  if (filePath.startsWith("/") || filePath.startsWith(".")) {
    // Local file path — useful during development with --registry flag
    const content = await fs.readFile(filePath, "utf8").catch(() => {
      throw new Error(`Tool "${name}" not found at ${filePath}`);
    });
    raw = JSON.parse(content);
  } else {
    const res = await fetch(filePath).catch(() => {
      throw new Error(
        `Could not reach registry. Check your internet connection.`
      );
    });
    if (res.status === 404)
      throw new Error(`Tool "${name}" not found in registry.`);
    if (!res.ok)
      throw new Error(`Registry fetch failed: ${res.status} ${res.statusText}`);
    raw = await res.json();
  }

  return registryToolItemSchema.parse(raw);
}
