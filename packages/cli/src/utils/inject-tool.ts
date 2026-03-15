// Marker pairs that bound the CLI-managed sections in tools/index.ts.
const MARKERS = {
  imports: {
    open: "// [chatjs-registry:imports]",
    close: "// [/chatjs-registry:imports]",
  },
  tools: {
    open: "// [chatjs-registry:tools]",
    close: "// [/chatjs-registry:tools]",
  },
  ui: {
    open: "// [chatjs-registry:ui]",
    close: "// [/chatjs-registry:ui]",
  },
} as const;

/** "word-count" → "wordCount" */
function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** "word-count" → "WordCount" */
function toPascalCase(kebab: string): string {
  const camel = toCamelCase(kebab);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Insert `newLines` just before `closeMarker` in `source`.
 * Returns source unchanged if `idempotencyCheck` is already present
 * between the open and close markers.
 */
function injectIntoBlock(
  source: string,
  openMarker: string,
  closeMarker: string,
  newLines: string,
  idempotencyCheck: string
): string {
  const openIdx = source.indexOf(openMarker);
  const closeIdx = source.indexOf(closeMarker);

  if (openIdx === -1 || closeIdx === -1) {
    throw new Error(
      `Registry markers not found: ${openMarker}\n` +
        `Ensure tools/index.ts contains the expected marker comments.`
    );
  }

  const block = source.slice(openIdx, closeIdx);
  if (block.includes(idempotencyCheck)) {
    return source; // already present — nothing to do
  }

  // Insert before the entire close-marker line (not mid-line after any leading
  // whitespace) so the injected lines and the marker keep correct indentation.
  const lineStart = source.lastIndexOf("\n", closeIdx) + 1;
  return source.slice(0, lineStart) + newLines + source.slice(lineStart);
}

/**
 * Inject a tool's imports and registrations into the tools/index.ts source.
 * Returns the updated source string (pure — no file I/O).
 *
 * @param source    Current contents of tools/index.ts
 * @param name      Kebab-case tool name, e.g. "word-count"
 * @param toolsAlias  Import alias, e.g. "@/tools"
 */
export function injectTool(
  source: string,
  name: string,
  toolsAlias: string
): string {
  const camel = toCamelCase(name);
  const pascal = toPascalCase(name);
  const rendererName = `${pascal}Renderer`;

  // 1. Imports block
  const importLines =
    `import { ${rendererName} } from "${toolsAlias}/${name}/renderer";\n` +
    `import { ${camel} } from "${toolsAlias}/${name}/tool";\n`;

  source = injectIntoBlock(
    source,
    MARKERS.imports.open,
    MARKERS.imports.close,
    importLines,
    camel
  );

  // 2. Tools object block
  const toolLine = `  ${camel},\n`;

  source = injectIntoBlock(
    source,
    MARKERS.tools.open,
    MARKERS.tools.close,
    toolLine,
    camel
  );

  // 3. UI registry block
  const uiLine = `  "tool-${camel}": ${rendererName},\n`;

  source = injectIntoBlock(
    source,
    MARKERS.ui.open,
    MARKERS.ui.close,
    uiLine,
    camel
  );

  return source;
}

/** Template used when tools/index.ts doesn't exist yet. */
export function createEmptyIndexTemplate(): string {
  return (
    `// All tools and UI components installed via \`chatjs add\`.\n` +
    `// This file is fully managed by the CLI — do not edit manually.\n` +
    `\n` +
    `${MARKERS.imports.open}\n` +
    `${MARKERS.imports.close}\n` +
    `\n` +
    `export const tools = {\n` +
    `  ${MARKERS.tools.open}\n` +
    `  ${MARKERS.tools.close}\n` +
    `} as const;\n` +
    `\n` +
    `export const ui = {\n` +
    `  ${MARKERS.ui.open}\n` +
    `  ${MARKERS.ui.close}\n` +
    `};\n`
  );
}
