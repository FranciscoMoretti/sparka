/**
 * Build script — generates items/*.json and index.json from src/{name}/.
 *
 * Each tool directory must contain:
 *   tool.ts       — backend tool implementation
 *   renderer.tsx  — frontend renderer component
 *   meta.json     — { description, dependencies? }
 *
 * Run: bun run build
 */

import fs from "node:fs/promises";
import path from "node:path";

const srcDir = new URL("./src", import.meta.url).pathname;
const itemsDir = new URL("./items", import.meta.url).pathname;
const indexPath = new URL("./index.json", import.meta.url).pathname;

type Meta = {
  description: string;
  dependencies?: string[];
};

await fs.mkdir(itemsDir, { recursive: true });

const toolNames = (await fs.readdir(srcDir)).filter(async (entry) =>
  (await fs.stat(path.join(srcDir, entry))).isDirectory()
);

// Filter to actual directories synchronously
const dirs: string[] = [];
for (const entry of toolNames) {
  const stat = await fs.stat(path.join(srcDir, entry));
  if (stat.isDirectory()) dirs.push(entry);
}

const index: { name: string; description: string }[] = [];

for (const name of dirs) {
  const dir = path.join(srcDir, name);

  const meta: Meta = JSON.parse(
    await fs.readFile(path.join(dir, "meta.json"), "utf8")
  );
  const toolContent = await fs.readFile(path.join(dir, "tool.ts"), "utf8");
  const rendererContent = await fs.readFile(
    path.join(dir, "renderer.tsx"),
    "utf8"
  );

  const item = {
    name,
    description: meta.description,
    dependencies: meta.dependencies ?? [],
    files: [
      {
        path: "tool.ts",
        type: "tool",
        target: `tools/${name}/tool.ts`,
        content: toolContent,
      },
      {
        path: "renderer.tsx",
        type: "renderer",
        target: `tools/${name}/renderer.tsx`,
        content: rendererContent,
      },
    ],
  };

  await fs.writeFile(
    path.join(itemsDir, `${name}.json`),
    JSON.stringify(item, null, 2) + "\n"
  );

  index.push({ name, description: meta.description });
  console.log(`  built ${name}`);
}

await fs.writeFile(indexPath, JSON.stringify(index, null, 2) + "\n");

console.log(`\n✓ ${dirs.length} tool(s) → items/ + index.json`);
