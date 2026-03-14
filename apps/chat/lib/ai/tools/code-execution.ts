import { Sandbox } from "@vercel/sandbox";
import { tool } from "ai";
import z from "zod";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";
const COST_CENTS = 5; // Vercel Sandbox execution

const WHITESPACE_REGEX = /\s+/;
const PACKAGE_SPEC_SPLIT_RE = /[=<>![\s]/;

async function installBasePackages(
  sandbox: Sandbox,
  basePackages: readonly string[],
  log: ReturnType<typeof createModuleLogger>,
  requestId: string
): Promise<{
  success: boolean;
  result?: { message: string; chart: string };
}> {
  const installStep = await sandbox.runCommand({
    cmd: "pip",
    args: ["install", ...basePackages],
  });
  if (installStep.exitCode !== 0) {
    const installStderr = await installStep.stderr();
    log.error(
      { requestId, stderr: installStderr },
      "base package installation failed"
    );
    return {
      success: false,
      result: {
        message: `Failed to install base packages: ${installStderr}`,
        chart: "",
      },
    };
  }
  log.info({ requestId }, "base packages installed");
  return { success: true };
}

function packageName(spec: string): string {
  return spec.split(PACKAGE_SPEC_SPLIT_RE)[0].toLowerCase();
}

async function processExtraPackages(
  code: string,
  basePackages: readonly string[],
  sandbox: Sandbox,
  log: ReturnType<typeof createModuleLogger>,
  requestId: string
): Promise<{
  codeToRun: string;
  installResult: {
    success: boolean;
    result?: { message: string; chart: string };
  };
}> {
  const basePackageNames = new Set(basePackages.map((p) => p.toLowerCase()));
  const lines = code.split("\n");
  const pipLines = lines.filter((l) => l.trim().startsWith("!pip install "));
  const extraPackages = pipLines
    .flatMap((l) =>
      l
        .trim()
        .slice("!pip install ".length)
        .split(WHITESPACE_REGEX)
        .filter(Boolean)
    )
    .filter((spec) => !basePackageNames.has(packageName(spec)));

  const codeWithoutPipLines = lines
    .filter((l) => !l.trim().startsWith("!pip install "))
    .join("\n");

  if (extraPackages.length === 0) {
    return { codeToRun: codeWithoutPipLines, installResult: { success: true } };
  }

  log.info({ requestId, extraPackages }, "installing extra packages");
  const dynamicInstall = await sandbox.runCommand({
    cmd: "pip",
    args: ["install", ...extraPackages],
  });
  if (dynamicInstall.exitCode !== 0) {
    const stderr = await dynamicInstall.stderr();
    log.error({ requestId, stderr }, "dynamic package installation failed");
    return {
      codeToRun: code,
      installResult: {
        success: false,
        result: {
          message: `Failed to install packages: ${stderr}`,
          chart: "",
        },
      },
    };
  }

  return {
    codeToRun: codeWithoutPipLines,
    installResult: { success: true },
  };
}

function createWrappedCode(codeToRun: string, chartPath: string): string {
  return `
import sys
import json
import traceback

try:
    import matplotlib.pyplot as _plt_module
    _orig_savefig = _plt_module.savefig
    def _intercepted_savefig(*args, **kwargs):
        _orig_savefig('${chartPath}', format='png', bbox_inches='tight', dpi=100)
        if args or kwargs.get('fname') not in (None, '${chartPath}'):
            return _orig_savefig(*args, **kwargs)
    _plt_module.savefig = _intercepted_savefig
except ImportError:
    pass

try:
    exec(${JSON.stringify(codeToRun)})
    try:
        _locals = locals()
        _globals = globals()
        _chart_var = _locals.get("chart") or _globals.get("chart")
        if (isinstance(_chart_var, dict)
                and isinstance(_chart_var.get("type"), str)
                and isinstance(_chart_var.get("elements"), list)):
            print("__CHART_JSON__:" + json.dumps(_chart_var))
        else:
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
            plt.savefig('${chartPath}', format='png', bbox_inches='tight', dpi=100)
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

const CHART_JSON_PREFIX = "__CHART_JSON__:";

async function parseExecutionOutput(execResult: {
  stdout: () => Promise<string>;
  exitCode: number;
}): Promise<{
  outputText: string;
  chartData: Record<string, unknown> | null;
  execInfo: {
    success: boolean;
    error?: { name: string; value: string; traceback: string };
  };
}> {
  const stdout = await execResult.stdout();
  let execInfo: {
    success: boolean;
    error?: { name: string; value: string; traceback: string };
  } = { success: true };
  let outputText = "";
  let chartData: Record<string, unknown> | null = null;

  try {
    const outLines = (stdout ?? "").trim().split("\n");
    const lastLine = outLines.at(-1);
    execInfo = JSON.parse(lastLine ?? "{}");
    outLines.pop();

    const chartLineIdx = outLines.findIndex((l) =>
      l.startsWith(CHART_JSON_PREFIX)
    );
    if (chartLineIdx !== -1) {
      const raw = outLines[chartLineIdx].slice(CHART_JSON_PREFIX.length);
      try {
        chartData = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        // ignore malformed chart JSON
      }
      outLines.splice(chartLineIdx, 1);
    }

    outputText = outLines.join("\n");
  } catch {
    outputText = stdout ?? "";
  }

  return { outputText, chartData, execInfo };
}

async function checkForChart(
  sandbox: Sandbox,
  chartPath: string,
  log: ReturnType<typeof createModuleLogger>,
  requestId: string
): Promise<{ base64: string; format: string } | undefined> {
  const chartCheck = await sandbox.runCommand({
    cmd: "test",
    args: ["-f", chartPath],
  });
  if (chartCheck.exitCode === 0) {
    const b64 = await (
      await sandbox.runCommand({
        cmd: "base64",
        args: ["-w", "0", chartPath],
      })
    ).stdout();
    log.info({ requestId }, "chart generated");
    return { base64: (b64 ?? "").trim(), format: "png" };
  }
  return;
}

function buildResponseMessage({
  outputText,
  stderr,
  execInfo,
  log,
  requestId,
}: {
  outputText: string;
  stderr: string;
  execInfo: {
    success: boolean;
    error?: { name: string; value: string; traceback: string };
  };
  log: ReturnType<typeof createModuleLogger>;
  requestId: string;
}): string {
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

  return message;
}

function getTokenAuth(): Record<string, string> {
  const { VERCEL_TEAM_ID, VERCEL_PROJECT_ID, VERCEL_TOKEN } = env;
  if (VERCEL_TEAM_ID && VERCEL_PROJECT_ID && VERCEL_TOKEN) {
    return {
      teamId: VERCEL_TEAM_ID,
      projectId: VERCEL_PROJECT_ID,
      token: VERCEL_TOKEN,
    };
  }
  return {};
}

function createSandbox(runtime: string): Promise<Sandbox> {
  return Sandbox.create({
    runtime,
    timeout: 5 * 60 * 1000,
    resources: { vcpus: 2 },
    ...getTokenAuth(),
  });
}

async function executeInSandbox({
  sandbox,
  code,
  basePackages,
  chartPath,
  log,
  requestId,
}: {
  sandbox: Sandbox;
  code: string;
  basePackages: readonly string[];
  chartPath: string;
  log: ReturnType<typeof createModuleLogger>;
  requestId: string;
}): Promise<{
  message: string;
  chart: string | { base64: string; format: string } | Record<string, unknown>;
}> {
  const baseInstallResult = await installBasePackages(
    sandbox,
    basePackages,
    log,
    requestId
  );
  if (!baseInstallResult.success) {
    return baseInstallResult.result ?? { message: "Unknown error", chart: "" };
  }

  const { codeToRun, installResult } = await processExtraPackages(
    code,
    basePackages,
    sandbox,
    log,
    requestId
  );
  if (!installResult.success) {
    return installResult.result ?? { message: "Unknown error", chart: "" };
  }

  const wrappedCode = createWrappedCode(codeToRun, chartPath);
  const execResult = await sandbox.runCommand({
    cmd: "python3",
    args: ["-c", wrappedCode],
  });

  const { outputText, chartData, execInfo } =
    await parseExecutionOutput(execResult);

  const message = buildResponseMessage({
    outputText,
    stderr: await execResult.stderr(),
    execInfo,
    log,
    requestId,
  });

  if (chartData) {
    log.info({ requestId }, "interactive chart data returned");
    return { message: message.trim(), chart: chartData };
  }

  const chartOut = await checkForChart(sandbox, chartPath, log, requestId);
  return {
    message: message.trim(),
    chart: chartOut ?? "",
  };
}

async function cleanupSandbox(
  sandbox: Sandbox | undefined,
  log: ReturnType<typeof createModuleLogger>,
  requestId: string
): Promise<void> {
  if (!sandbox) {
    return;
  }
  try {
    await sandbox.stop();
    log.info({ requestId }, "sandbox closed");
  } catch (closeErr) {
    log.warn({ requestId, closeErr }, "failed to close sandbox");
  }
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

export const codeExecution = ({
  costAccumulator,
}: {
  costAccumulator?: CostAccumulator;
}) =>
  tool({
    description: `Python-only sandbox for calculations, data analysis & visualisations.

Use for:
- Execute Python (matplotlib, pandas, numpy, sympy, yfinance pre-installed — do NOT reinstall them)
- Produce interactive line / scatter / bar charts OR matplotlib PNG charts
- Install extra libs by adding lines like: '!pip install <pkg> [<pkg2> ...]' (we auto-install and strip these lines; pre-installed packages are ignored)

Chart output — choose ONE:
1. Interactive chart (preferred for line/scatter/bar): assign a 'chart' variable matching this schema:
   chart = {
     "type": "line" | "scatter" | "bar",
     "title": "My Chart",
     "x_label": "X",   # optional
     "y_label": "Y",   # optional
     "x_scale": "datetime" | None,  # optional, for time-series x axes
     "elements": [
       # for line/scatter: {"label": "Series A", "points": [[x1,y1],[x2,y2],...]}
       # for bar: {"label": "Category", "group": "Group A", "value": 42}
     ]
   }
2. Matplotlib PNG: use plt.plot()/plt.savefig() normally (no need to call plt.show())

Restrictions:
- No images in the assistant response; don't embed them
- Interactive chart: only line / scatter / bar types

Output rules:
- Assign 'chart' dict for interactive charts (takes priority over matplotlib PNG)
- Assign 'result' or 'results' for other computed values (auto-printed)
- Or print explicitly: print(answer)
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
      const log = createModuleLogger("code-execution");
      const requestId = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const runtime = env.VERCEL_SANDBOX_RUNTIME ?? "python3.13";
      const basePackages = [
        "matplotlib",
        "pandas",
        "numpy",
        "sympy",
        "yfinance",
      ] as const;
      const chartPath = "/tmp/chart.png";

      let sandbox: Sandbox | undefined;

      try {
        log.info({ requestId, title, runtime }, "creating sandbox");
        sandbox = await createSandbox(runtime);
        log.debug({ requestId }, "sandbox created");

        log.info({ requestId, title }, "executing python code");
        const result = await executeInSandbox({
          sandbox,
          code,
          basePackages,
          chartPath,
          log,
          requestId,
        });

        costAccumulator?.addAPICost("codeExecution", COST_CENTS);

        return result;
      } catch (err) {
        log.error({ err, requestId }, "code execution failed");
        return {
          message: `Sandbox execution failed: ${getErrorMessage(err)}`,
          chart: "",
        };
      } finally {
        await cleanupSandbox(sandbox, log, requestId);
      }
    },
  });
