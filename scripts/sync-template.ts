#!/usr/bin/env bun
import { createHash } from "node:crypto";
import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

const rootDir = resolve(import.meta.dir, "..");
const isCheck = process.argv.includes("--check");

// --- chat-app ---
const sourceDir = join(rootDir, "apps", "chat");
const templateDir = join(rootDir, "packages", "cli", "templates", "chat-app");

// --- electron ---
const electronSourceDir = join(rootDir, "apps", "electron");
const electronTemplateDir = join(
  rootDir,
  "packages",
  "cli",
  "templates",
  "electron"
);

// ─── chat-app filter ────────────────────────────────────────────────────────

const EXCLUDED_SEGMENTS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "playwright",
  "playwright-report",
  "test-results",
  "blob-report",
  "dist",
  "build",
]);

const EXCLUDED_FILES = new Set([
  ".env.local",
  ".DS_Store",
  "bun.lock",
  "bun.lockb",
]);

function shouldCopyFilePath(filePath: string): boolean {
  const rel = relative(sourceDir, filePath);
  if (!rel || rel.startsWith("..")) {
    return true;
  }
  const segments = rel.split(sep);
  if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) {
    return false;
  }
  const fileName = segments.at(-1);
  if (fileName && EXCLUDED_FILES.has(fileName)) {
    return false;
  }
  return true;
}

// ─── electron filter ─────────────────────────────────────────────────────────

const ELECTRON_EXCLUDED_SEGMENTS = new Set([
  "node_modules",
  ".turbo",
  "dist",
  "release",
]);

const ELECTRON_EXCLUDED_FILES = new Set([
  ".DS_Store",
  "bun.lock",
  "bun.lockb",
]);

function shouldCopyElectronFilePath(filePath: string): boolean {
  const rel = relative(electronSourceDir, filePath);
  if (!rel || rel.startsWith("..")) {
    return true;
  }
  const segments = rel.split(sep);
  if (segments.some((segment) => ELECTRON_EXCLUDED_SEGMENTS.has(segment))) {
    return false;
  }
  const fileName = segments.at(-1);
  if (fileName && ELECTRON_EXCLUDED_FILES.has(fileName)) {
    return false;
  }
  return true;
}

/** Files removed from the template after copying (relative to destination). */
const TEMPLATE_REMOVED_FILES = [
  "components/github-link.tsx",
  "components/docs-link.tsx",
];

/** Import lines stripped from template files after copying. */
const TEMPLATE_STRIPPED_IMPORTS = [
  'import { DocsLink } from "@/components/docs-link";',
  'import { GitHubLink } from "@/components/github-link";',
];

async function applyTemplateTransforms(destination: string): Promise<void> {
  // Delete excluded files
  await Promise.all(
    TEMPLATE_REMOVED_FILES.map((file) =>
      rm(join(destination, file), { force: true })
    )
  );

  // Strip imports that reference removed files
  if (TEMPLATE_STRIPPED_IMPORTS.length > 0) {
    const headerPath = join(destination, "components", "header-actions.tsx");
    let content = await readFile(headerPath, "utf8");
    for (const imp of TEMPLATE_STRIPPED_IMPORTS) {
      content = content.replace(`${imp}\n`, "");
    }
    // Remove JSX usage of the stripped components
    content = content.replace(/\s*<DocsLink \/>/g, "");
    content = content.replace(/\s*<GitHubLink \/>/g, "");
    await writeFile(headerPath, content);
  }

  // Replace monorepo-aware @source paths with single-app path in globals.css
  const globalsCssPath = join(destination, "app", "globals.css");
  let globalsCss = await readFile(globalsCssPath, "utf8");
  globalsCss = globalsCss.replace(
    /@source "\.\.\/node_modules\/streamdown\/dist\/\*\.js";\n@source "\.\.\/\.\.\/\.\.\/node_modules\/streamdown\/dist\/\*\.js";/,
    '@source "../node_modules/streamdown/dist/*.js";'
  );
  await writeFile(globalsCssPath, globalsCss);
}

async function applyElectronTemplateTransforms(
  destination: string
): Promise<void> {
  // config.ts: replace hardcoded production URL and scheme with placeholders
  const configPath = join(destination, "src", "config.ts");
  let config = await readFile(configPath, "utf8");
  config = config
    .replace(/"https:\/\/chatjs\.dev"/, '"__APP_URL__"')
    .replace(/"chatjs"/, '"__APP_SCHEME__"');
  await writeFile(configPath, config);

  // electron-builder.yml: replace hardcoded app identity, publish config, and protocol scheme
  const builderPath = join(destination, "electron-builder.yml");
  let builder = await readFile(builderPath, "utf8");
  builder = builder
    .replace(/^appId: .+$/m, "appId: __APP_ID__")
    .replace(/^productName: .+$/m, "productName: __PRODUCT_NAME__")
    .replace(/^( {2}owner: ).+$/m, "$1__GITHUB_OWNER__")
    .replace(/^( {2}repo: ).+$/m, "$1__GITHUB_REPO__")
    .replace(/- chatjs$/gm, "- __APP_SCHEME__");
  await writeFile(builderPath, builder);
}

async function copyElectronTemplate(destination: string): Promise<void> {
  await rm(destination, { recursive: true, force: true });
  await cp(electronSourceDir, destination, {
    recursive: true,
    filter: shouldCopyElectronFilePath,
  });
  await applyElectronTemplateTransforms(destination);
}

async function copyTemplate(destination: string): Promise<void> {
  await rm(destination, { recursive: true, force: true });
  await cp(sourceDir, destination, {
    recursive: true,
    filter: shouldCopyFilePath,
  });
  await applyTemplateTransforms(destination);
}

async function collectSnapshot(
  dir: string,
  prefix = ""
): Promise<Map<string, string>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const output = new Map<string, string>();
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const nested = await collectSnapshot(absolute, rel);
      for (const [nestedPath, hash] of nested) {
        output.set(nestedPath, hash);
      }
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const bytes = await readFile(absolute);
    const hash = createHash("sha256").update(bytes).digest("hex");
    output.set(rel, hash);
  }
  return output;
}

async function assertSynced(
  label: string,
  actualDir: string,
  copyFn: (dest: string) => Promise<void>
): Promise<boolean> {
  const templateStats = await stat(actualDir).catch(() => null);
  if (!templateStats?.isDirectory()) {
    console.error(
      `${label}: template folder missing. Run \`bun template:sync\`.`
    );
    return false;
  }

  const tempParent = await mkdtemp(join(tmpdir(), "chat-template-"));
  const tempDir = join(tempParent, label);
  await copyFn(tempDir);

  const [expectedSnapshot, actualSnapshot] = await Promise.all([
    collectSnapshot(tempDir),
    collectSnapshot(actualDir),
  ]);

  await rm(tempParent, { recursive: true, force: true });

  const expectedEntries = [...expectedSnapshot.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const actualEntries = [...actualSnapshot.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  if (JSON.stringify(expectedEntries) !== JSON.stringify(actualEntries)) {
    console.error(`${label}: template drift detected. Run \`bun template:sync\`.`);
    return false;
  }
  console.log(`${label}: template is synced.`);
  return true;
}

if (isCheck) {
  const results = await Promise.all([
    assertSynced("chat-app", templateDir, copyTemplate),
    assertSynced("electron", electronTemplateDir, copyElectronTemplate),
  ]);
  if (results.some((ok) => !ok)) process.exit(1);
} else {
  await copyTemplate(templateDir);
  console.log("Synced templates/chat-app from apps/chat.");
  await copyElectronTemplate(electronTemplateDir);
  console.log("Synced templates/electron from apps/electron.");
}
