import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { confirm, intro, outro, isCancel, log } from "@clack/prompts";
import { handleError } from "../utils/handle-error";
import { spinner } from "../utils/spinner";
import { fetchRegistryItem } from "../registry/fetch";
import { loadProjectConfig, resolveToolsPath } from "../utils/get-config";
import { writeToolFiles } from "../utils/write-files";
import { installDependencies } from "../utils/install-deps";
import { injectTool, createEmptyIndexTemplate } from "../utils/inject-tool";

export const add = new Command()
  .name("add")
  .description("add a tool to an existing ChatJS project")
  .argument("[tools...]", "tool names to add (e.g. word-count)")
  .option("-y, --yes", "skip confirmation prompt", false)
  .option("-o, --overwrite", "overwrite existing files without prompting", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory (defaults to current directory)",
    process.cwd()
  )
  .option(
    "-r, --registry <url>",
    "registry URL or local path template (e.g. ./packages/registry/items/{name}.json)"
  )
  .action(async (tools: string[], opts) => {
    try {
      const cwd = path.resolve(opts.cwd);

      if (tools.length === 0) {
        log.error(
          "Please specify one or more tool names, e.g. chatjs add word-count"
        );
        process.exit(1);
      }

      // Preflight: ensure this is a ChatJS project
      try {
        await fs.stat(path.join(cwd, "chat.config.ts"));
      } catch {
        log.error(
          "No chat.config.ts found. Run `chat-js create` first or specify --cwd."
        );
        process.exit(1);
      }

      intro("chatjs add");

      // Load project config to resolve the tools directory
      const configSpinner = spinner("Loading project config...");
      configSpinner.start();
      let config: { paths: { tools: string; toolUi: string } };
      try {
        config = await loadProjectConfig(cwd);
        configSpinner.succeed("Project config loaded");
      } catch (err) {
        configSpinner.fail("Failed to load project config");
        throw err;
      }

      const toolsDir = resolveToolsPath(config.paths.tools, cwd);
      const indexPath = path.join(toolsDir, "index.ts");

      // Confirm installation unless --yes
      if (!opts.yes) {
        const answer = await confirm({
          message: `Install ${tools.join(", ")} into ${path.relative(process.cwd(), toolsDir)}/?`,
        });
        if (isCancel(answer) || !answer) {
          outro("Cancelled.");
          process.exit(0);
        }
      }

      // Install each tool
      for (const name of tools) {
        log.step(`Installing ${name}`);

        // 1. Fetch from registry
        const fetchSpinner = spinner(`Fetching ${name}...`);
        fetchSpinner.start();
        let item: Awaited<ReturnType<typeof fetchRegistryItem>>;
        try {
          item = await fetchRegistryItem(name, opts.registry);
          fetchSpinner.succeed(`Fetched ${name}`);
        } catch (err) {
          fetchSpinner.fail(`Failed to fetch ${name}`);
          throw err;
        }

        // 2. Write files to disk
        const overwrite = opts.overwrite as boolean;
        try {
          // First pass: skip existing files unless --overwrite
          const writeSpinner = spinner("Writing files...");
          writeSpinner.start();
          const { written, existing } = await writeToolFiles(cwd, item.files, {
            overwrite,
          });
          writeSpinner.stop();

          if (existing.length > 0 && !overwrite) {
            const answer = await confirm({
              message: `${existing.map((f) => path.relative(cwd, f)).join(", ")} already exist. Overwrite?`,
            });
            if (isCancel(answer) || !answer) {
              log.warn(`Skipped ${name}`);
              continue;
            }
            // Write the files that were skipped
            const { written: rest } = await writeToolFiles(cwd, item.files, {
              overwrite: true,
            });
            written.push(...rest);
          }

          log.step(written.map((f) => path.relative(cwd, f)).join(", "));
        } catch (err) {
          log.error("Failed to write files");
          throw err;
        }

        // 3. Install npm dependencies
        if (item.dependencies && item.dependencies.length > 0) {
          const depsSpinner = spinner("Installing dependencies...");
          depsSpinner.start();
          try {
            await installDependencies(item.dependencies, cwd);
            depsSpinner.succeed(`Installed: ${item.dependencies.join(", ")}`);
          } catch (err) {
            depsSpinner.fail("Failed to install dependencies");
            throw err;
          }
        }

        // 4. Inject into tools/index.ts
        const injectSpinner = spinner("Updating tools/index.ts...");
        injectSpinner.start();
        try {
          let source: string;
          try {
            source = await fs.readFile(indexPath, "utf8");
          } catch {
            source = createEmptyIndexTemplate();
          }
          const updated = injectTool(source, name, config.paths.tools);
          await fs.mkdir(path.dirname(indexPath), { recursive: true });
          await fs.writeFile(indexPath, updated, "utf8");
          injectSpinner.succeed("Updated tools/index.ts");
        } catch (err) {
          injectSpinner.fail("Failed to update tools/index.ts");
          throw err;
        }
      }

      outro(
        `Done! ${tools.length === 1 ? `"${tools[0]}"` : `${tools.length} tools`} installed successfully.`
      );
    } catch (error) {
      handleError(error);
    }
  });
