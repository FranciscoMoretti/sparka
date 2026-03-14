import { existsSync } from "node:fs";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "../utils/run-command";

function findTemplateDir(name: string): string {
  const __dir = dirname(fileURLToPath(import.meta.url));
  // Production (dist/index.js): ../templates/<name>
  // Dev (src/helpers/scaffold.ts): ../../templates/<name>
  for (const relative of [`../templates/${name}`, `../../templates/${name}`]) {
    const candidate = resolve(__dir, relative);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Template "${name}" not found. Run \`bun template:sync\` to generate templates.`
  );
}

export async function scaffoldFromTemplate(
  destination: string
): Promise<void> {
  const templateDir = findTemplateDir("chat-app");
  await cp(templateDir, destination, { recursive: true });
}

export async function scaffoldElectron(
  projectDir: string,
  opts: { appName: string; appUrl: string; projectName: string; appScheme: string }
): Promise<void> {
  // URI schemes must start with a letter; project names can start with digits.
  const appScheme = opts.appScheme.replace(/^[^a-zA-Z]+/, "app-$&");

  const templateDir = findTemplateDir("electron");
  const destination = join(projectDir, "electron");
  await cp(templateDir, destination, { recursive: true });

  // Inject config.ts placeholders
  const configPath = join(destination, "src", "config.ts");
  const config = (await readFile(configPath, "utf8"))
    .replace("__APP_URL__", opts.appUrl)
    .replace("__APP_SCHEME__", appScheme);
  await writeFile(configPath, config);

  // Inject electron-builder.yml placeholders
  const builderPath = join(destination, "electron-builder.yml");
  const appId = `com.example.${opts.projectName}`;
  const builder = (await readFile(builderPath, "utf8"))
    .replace("__APP_ID__", appId)
    .replace("__PRODUCT_NAME__", opts.appName)
    .replace("__GITHUB_OWNER__", "your-github-username")
    .replace("__GITHUB_REPO__", opts.projectName)
    .replaceAll("__APP_SCHEME__", appScheme);
  await writeFile(builderPath, builder);
}

export async function scaffoldFromGit(
  url: string,
  destination: string
): Promise<void> {
  await runCommand(
    "git",
    ["clone", "--depth", "1", url, destination],
    process.cwd()
  );
  await rm(join(destination, ".git"), { recursive: true, force: true });
}
