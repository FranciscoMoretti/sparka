import { spawn } from "node:child_process";
import path from "node:path";
import { inferPackageManager } from "./get-package-manager";
import type { PackageManager } from "../types";

// Mirrors the pattern from commands/config.ts but captures stdout for parsing.
const EVAL_SCRIPT = `
import userConfig from "./chat.config.ts";
import { applyDefaults } from "./lib/config-schema";
process.stdout.write(JSON.stringify(applyDefaults(userConfig)));
`;

function getTsEvalCommand(pm: PackageManager): [string, string[]] {
  switch (pm) {
    case "bun":
      return ["bun", ["--eval", EVAL_SCRIPT]];
    case "pnpm":
      return ["pnpm", ["dlx", "tsx", "--eval", EVAL_SCRIPT]];
    case "yarn":
      return ["yarn", ["dlx", "tsx", "--eval", EVAL_SCRIPT]];
    default:
      return ["npx", ["tsx", "--eval", EVAL_SCRIPT]];
  }
}

export type ProjectConfig = {
  paths: {
    tools: string;
    toolUi: string;
  };
};

export async function loadProjectConfig(cwd: string): Promise<ProjectConfig> {
  const pm = inferPackageManager();
  const [cmd, args] = getTsEvalCommand(pm);

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const out: string[] = [];
    const err: string[] = [];

    child.stdout?.on("data", (d) => out.push(String(d)));
    child.stderr?.on("data", (d) => err.push(String(d)));

    child.on("error", (e) =>
      reject(
        new Error(
          `Could not spawn ${cmd}. Make sure ${pm} is installed.\n${e.message}`
        )
      )
    );

    child.on("close", (code) => {
      if (code === 0) resolve(out.join(""));
      else reject(new Error(`Failed to load config:\n${err.join("").trim()}`));
    });
  });

  const parsed = JSON.parse(stdout);
  return {
    paths: {
      tools: parsed?.paths?.tools ?? "@/tools",
      toolUi: parsed?.paths?.toolUi ?? "@/tools",
    },
  };
}

/**
 * Resolve a Next.js-style import alias to a filesystem path.
 * "@/tools" → "<cwd>/tools"
 * "./tools" → "<cwd>/tools"
 */
export function resolveToolsPath(alias: string, cwd: string): string {
  if (alias.startsWith("@/")) {
    return path.join(cwd, alias.slice(2));
  }
  return path.resolve(cwd, alias);
}
