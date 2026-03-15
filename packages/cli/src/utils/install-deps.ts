import { runCommand } from "./run-command";
import { inferPackageManager } from "./get-package-manager";

/**
 * Install npm dependencies in `cwd` using the detected package manager.
 * No-ops if `deps` is empty.
 */
export async function installDependencies(
  deps: string[],
  cwd: string
): Promise<void> {
  if (!deps.length) return;

  const pm = inferPackageManager();
  const args = pm === "yarn" ? ["add", ...deps] : ["add", ...deps];

  await runCommand(pm, args, cwd);
}
