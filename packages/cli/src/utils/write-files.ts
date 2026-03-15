import fs from "node:fs/promises";
import path from "node:path";
import type { RegistryToolItemFile } from "../registry/schema";

/**
 * Write tool files to disk.
 * Each file's `target` is resolved relative to `cwd`.
 * Returns the list of absolute paths that were written.
 */
export async function writeToolFiles(
  cwd: string,
  files: RegistryToolItemFile[]
): Promise<string[]> {
  const written: string[] = [];

  for (const file of files) {
    const dest = path.resolve(cwd, file.target);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file.content, "utf8");
    written.push(dest);
  }

  return written;
}
