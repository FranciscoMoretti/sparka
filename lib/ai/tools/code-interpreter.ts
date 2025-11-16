import { Sandbox } from "@vercel/sandbox";
import { tool } from "ai";
import z from "zod";
import { createModuleLogger } from "@/lib/logger";

const WHITESPACE_REGEX = /\s+/;
const CHART_PATH = "/tmp/chart.png";
const BASE_PACKAGES = [
  "matplotlib",
  "pandas",
  "numpy",
  "sympy",
  "yfinance",
] as const;

async function installPackages(
  sandbox: Sandbox,
  requestId: string,
  packages: readonly string[],
  isBase: boolean
): Promise<string | null> {
  const log = createModuleLogger("code-interpreter");
  const result = await sandbox.runCommand({
    cmd: "pip",
    args: ["install", ...packages],
  });
  if (result.exitCode !== 0) {
    const stderr = await result.stderr();
    const packageType = isBase ? "base" : "dynamic";
    log.error(
      { requestId, stderr },
      `${packageType} package installation failed`
    );
    return stderr;
  }
  return null;
}

function extractExtraPackages(code: string): {
  packages: string[];
  cleanedCode: string;
} {
  const lines = code.split("\n");
  const pipLines = lines.filter((l) => l.trim().startsWith("!pip install "));
  const packages = pipLines.flatMap((l) =>
    l
      .trim()
      .slice("!pip install ".length)
      .split(WHITESPACE_REGEX)
      .filter(Boolean)
  );
  const cleanedCode = lines
    .filter((l) => !l.trim().startsWith("!pip install "))
    .join("\n");
  return { packages, cleanedCode };
}

function createWrappedCode(codeToRun: string): string {
  return `
import sys
import json
import traceback

try:
    exec(${JSON.stringify(codeToRun)})
    try:
        _locals = locals()
        _globals = globals()
        if "result" in _locals:
            print(_locals["result"])
        elif "result" in _globals:
            print(_globals["result"])
        elif "results" in _locals:
            print(_locals["results"])
        elif "results" in _globals:
            print(_globals["results"])
    except Exception:
        pass
    try:
        import matplotlib.pyplot as plt
        if plt.get_fignums():
            plt.savefig('${CHART_PATH}', format='png', bbox_inches='tight', dpi=100)
            plt.close('all')
    except ImportError:
        pass
    print(json.dumps({"success": True}))
except Exception as e:
    error_info = {"success": False, "error": {"name": type(e).__name__, "value": str(e), "traceback": traceback.format_exc()}}
    print(json.dumps(error_info))
    sys.exit(1)
`;
}

function parseExecutionOutput(
  stdout: string | null,
  _stderr: string | null
): {
  execInfo: {
    success: boolean;
    error?: { name: string; value: string; traceback: string };
  };
  outputText: string;
} {
  let execInfo: {
    success: boolean;
    error?: { name: string; value: string; traceback: string };
  } = { success: true };
  let outputText = "";
  try {
    const outLines = (stdout ?? "").trim().split("\n");
    const lastLine = outLines.at(-1);
    execInfo = JSON.parse(lastLine ?? "");
    outLines.pop(); // remove JSON marker
    outputText = outLines.join("\n");
  } catch {
    outputText = stdout ?? "";
  }
  return { execInfo, outputText };
}

async function extractChart(
  sandbox: Sandbox,
  requestId: string
): Promise<{ base64: string; format: string } | undefined> {
  const log = createModuleLogger("code-interpreter");
  const chartCheck = await sandbox.runCommand({
    cmd: "test",
    args: ["-f", CHART_PATH],
  });
  if (chartCheck.exitCode !== 0) {
    return;
  }
  const b64 = await (
    await sandbox.runCommand({
      cmd: "base64",
      args: ["-w", "0", CHART_PATH],
    })
  ).stdout();
  log.info({ requestId }, "chart generated");
  return { base64: (b64 ?? "").trim(), format: "png" };
}

function buildResponseMessage(
  outputText: string,
  stderr: string | null,
  execInfo: {
    success: boolean;
    error?: { name: string; value: string; traceback: string };
  },
  requestId: string
): string {
  const log = createModuleLogger("code-interpreter");
  let message = "";
  if (outputText) {
    message += `${outputText}\n`;
  }
  if (stderr && stderr.trim().length > 0) {
    message += `${stderr}\n`;
  }
  if (execInfo.error) {
    message += `Error: ${execInfo.error.name}: ${execInfo.error.value}\n`;
    log.error({ requestId, error: execInfo.error }, "python execution error");
  }
  return message.trim();
}

export const codeInterpreter = tool({
  description: `Python-only sandbox for calculations, data analysis & simple visualisations.

Use for:
- Execute Python (matplotlib, pandas, numpy, sympy, yfinance pre-installed)
- Produce line / scatter / bar charts (no need to call 'plt.show()')
- Install extra libs by adding lines like: '!pip install <pkg> [<pkg2> ...]' (we auto-install and strip these lines)

Restrictions:
- No images in the assistant response; don't embed them

Avoid:
- Any non-Python language
- Chart types other than line / scatter / bar

Output rules:
- Print the values you want returned (e.g. 'print(df.head())' or 'print(answer)')
- Or assign to a variable named 'result' or 'results' and we'll print it automatically
- Don't rely on implicit REPL last-expression output`,
  inputSchema: z.object({
    title: z.string().describe("The title of the code snippet."),
    code: z
      .string()
      .describe(
        "The Python code to execute. Print anything you want to return. Optionally assign to 'result' or 'results' to auto-print."
      ),
  }),
  execute: async ({ code, title }: { code: string; title: string }) => {
    const log = createModuleLogger("code-interpreter");
    const requestId = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const runtime = process.env.VERCEL_SANDBOX_RUNTIME ?? "python3.13";

    let sandbox: Sandbox | undefined;

    try {
      log.info({ requestId, title, runtime }, "creating sandbox");
      // TODO: Reduce vcups to 1 when Vercel allows it
      sandbox = await Sandbox.create({
        runtime,
        timeout: 5 * 60 * 1000,
        resources: { vcpus: 2 },
      });
      log.debug({ requestId }, "sandbox created");

      // Pre-install common data-science packages
      const baseInstallError = await installPackages(
        sandbox,
        requestId,
        BASE_PACKAGES,
        true
      );
      if (baseInstallError) {
        return {
          message: `Failed to install base packages: ${baseInstallError}`,
          chart: "",
        };
      }
      log.info({ requestId }, "base packages installed");

      // Detect and install extra packages
      const { packages: extraPackages, cleanedCode } =
        extractExtraPackages(code);
      let codeToRun = code;
      if (extraPackages.length > 0) {
        log.info({ requestId, extraPackages }, "installing extra packages");
        const extraInstallError = await installPackages(
          sandbox,
          requestId,
          extraPackages,
          false
        );
        if (extraInstallError) {
          return {
            message: `Failed to install packages: ${extraInstallError}`,
            chart: "",
          };
        }
        codeToRun = cleanedCode;
      }

      // Execute wrapped code
      const wrappedCode = createWrappedCode(codeToRun);
      log.info({ requestId, title }, "executing python code");
      const execResult = await sandbox.runCommand({
        cmd: "python3",
        args: ["-c", wrappedCode],
      });
      const stdout = await execResult.stdout();
      const stderr = await execResult.stderr();
      const exitCode = execResult.exitCode;
      log.debug({ requestId, exitCode }, "python execution finished");

      // Parse execution output
      const { execInfo, outputText } = parseExecutionOutput(stdout, stderr);

      // Extract chart if available
      const chartOut = await extractChart(sandbox, requestId);

      // Build response
      const message = buildResponseMessage(
        outputText,
        stderr,
        execInfo,
        requestId
      );
      const chart = chartOut ?? "";

      return {
        message,
        chart,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      log.error({ err, requestId }, "code interpreter failed");
      return {
        message: `Sandbox execution failed: ${errorMessage}`,
        chart: "",
      };
    } finally {
      if (sandbox) {
        try {
          await sandbox.stop();
          log.info({ requestId }, "sandbox closed");
        } catch (closeErr) {
          log.warn({ requestId, closeErr }, "failed to close sandbox");
        }
      }
    }
  },
});
