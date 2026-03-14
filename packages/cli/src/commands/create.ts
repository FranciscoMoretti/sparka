import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { intro, outro } from "@clack/prompts";
import { Command } from "commander";
import { z } from "zod";
import { buildConfigTs } from "../helpers/config-builder";
import { ensureTargetEmpty } from "../helpers/ensure-target";
import {
	collectEnvChecklist,
	type EnvVarEntry,
} from "../helpers/env-checklist";
import {
	promptAuth,
	promptElectron,
	promptFeatures,
	promptGateway,
	promptInstall,
	promptProjectName,
} from "../helpers/prompts";
import {
	scaffoldElectron,
	scaffoldFromGit,
	scaffoldFromTemplate,
} from "../helpers/scaffold";
import { inferPackageManager } from "../utils/get-package-manager";
import { handleError } from "../utils/handle-error";
import { highlighter } from "../utils/highlighter";
import { logger } from "../utils/logger";
import { runCommand } from "../utils/run-command";
import { spinner } from "../utils/spinner";

function printEnvChecklist(entries: EnvVarEntry[]): void {
	logger.info("Required for your configuration:");
	logger.break();

	for (let i = 0; i < entries.length; i += 1) {
		const entry = entries[i];

		if (!entry.oneOfGroup) {
			logger.log(
				`  ${highlighter.warn("*")} ${highlighter.warn(entry.vars)} ${highlighter.dim(`- ${entry.description}`)}`,
			);
			continue;
		}

		logger.log(`  ${highlighter.warn("*")} ${highlighter.dim("One of:")}`);
		while (i < entries.length && entries[i].oneOfGroup === entry.oneOfGroup) {
			const option = entries[i];
			logger.log(
				`    ${highlighter.warn("*")} ${highlighter.warn(option.vars)} ${highlighter.dim(`- ${option.description}`)}`,
			);
			i += 1;
		}
		i -= 1;
	}
}

const createOptionsSchema = z.object({
	target: z.string().optional(),
	yes: z.boolean(),
	install: z.boolean(),
	fromGit: z.string().optional(),
});

export const create = new Command()
	.name("create")
	.description("scaffold a new ChatJS chat application")
	.argument("[directory]", "target directory for the project")
	.option("-y, --yes", "skip prompts and use defaults", false)
	.option("--no-install", "skip dependency installation")
	.option(
		"--from-git <url>",
		"clone from a git repository instead of the built-in scaffold",
	)
	.action(async (directory, opts) => {
		try {
			const options = createOptionsSchema.parse({
				target: directory,
				...opts,
			});

			const packageManager = inferPackageManager();

			if (!options.yes) {
				intro("Create ChatJS App");
			}

			// 1. Project name
			const projectName = await promptProjectName(options.target, options.yes);
			const targetDir = resolve(process.cwd(), projectName);

			// 2. Validate target
			await ensureTargetEmpty(targetDir);

			// Derive app details from project name
			const appName = projectName
				.split("-")
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(" ");
			const appPrefix = projectName;
			const appUrl = "http://localhost:3000";

			// 3. Gateway selection
			const gateway = await promptGateway(options.yes);

			// 4. Features
			const features = await promptFeatures(options.yes);

			// 5. Auth providers
			const auth = await promptAuth(options.yes);

			// 6. Electron
			const withElectron = await promptElectron(options.yes);

			// 8. Scaffold project
			logger.break();
			const scaffoldSpinner = spinner("Scaffolding project...").start();
			try {
				if (options.fromGit) {
					await scaffoldFromGit(options.fromGit, targetDir);
				} else {
					await scaffoldFromTemplate(targetDir);
				}
				if (withElectron) {
					await scaffoldElectron(targetDir, {
						appName,
						appUrl,
						projectName,
						appScheme: appPrefix,
					});
				}
				scaffoldSpinner.succeed("Project scaffolded.");
			} catch (error) {
				scaffoldSpinner.fail("Failed to scaffold project.");
				throw error;
			}

			// 7. Write configuration
			const configSpinner = spinner("Writing configuration...").start();
			try {
				const packageJsonPath = join(targetDir, "package.json");
				const packageJson = JSON.parse(
					await readFile(packageJsonPath, "utf8"),
				) as { name?: string };
				packageJson.name = projectName;
				await writeFile(
					packageJsonPath,
					`${JSON.stringify(packageJson, null, 2)}\n`,
				);

				const configSource = buildConfigTs({
					appName,
					appPrefix,
					appUrl,
					gateway,
					features,
					auth,
				});
				await writeFile(join(targetDir, "chat.config.ts"), configSource);
				configSpinner.succeed("Configuration written.");
			} catch (error) {
				configSpinner.fail("Failed to write configuration.");
				throw error;
			}

			// 8. Install dependencies
			const installNow = !options.install
				? false
				: await promptInstall(packageManager, options.yes);
			if (installNow) {
				const installSpinner = spinner(
					`Installing dependencies with ${highlighter.info(packageManager)}...`,
				).start();
				try {
					await runCommand(packageManager, ["install"], targetDir);
					installSpinner.succeed("Dependencies installed.");
				} catch (error) {
					installSpinner.fail("Failed to install dependencies.");
					throw error;
				}
			}

			// 9. Success output
			const envEntries = collectEnvChecklist({ gateway, features, auth });

			outro("Your ChatJS app is ready!");

			logger.info("Next steps:");
			logger.break();
			logger.log(
				`  ${highlighter.dim("1.")} cd ${highlighter.info(projectName)}`,
			);
			logger.log(
				`  ${highlighter.dim("2.")} Copy ${highlighter.info(".env.example")} to ${highlighter.info(".env.local")} and fill in the values below`,
			);
			if (!installNow) {
				logger.log(
					`  ${highlighter.dim("3.")} ${highlighter.info(`${packageManager} install`)}`,
				);
				logger.log(
					`  ${highlighter.dim("4.")} ${highlighter.info(`${packageManager} run db:push`)}`,
				);
				logger.log(
					`  ${highlighter.dim("5.")} ${highlighter.info(`${packageManager} run dev`)}`,
				);
			} else {
				logger.log(
					`  ${highlighter.dim("3.")} ${highlighter.info(`${packageManager} run db:push`)}`,
				);
				logger.log(
					`  ${highlighter.dim("4.")} ${highlighter.info(`${packageManager} run dev`)}`,
				);
			}
			if (withElectron) {
				logger.break();
				logger.info("Electron desktop app:");
				logger.log(
					`  Run the web app first, then: ${highlighter.info(`cd electron && bun install && bun run dev`)}`,
				);
			}
			logger.break();

			printEnvChecklist(envEntries);

			logger.break();
			logger.log(
				`  For detailed setup instructions, visit ${highlighter.info("https://www.chatjs.dev/docs/quickstart")}`,
			);
		} catch (error) {
			handleError(error);
		}
	});
