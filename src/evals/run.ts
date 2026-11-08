import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { AdvancedAgentHarness } from "../harness.js";
import { DEFAULT_MODEL, openRouterProvider } from "../models.js";
import { buildSystemPrompt } from "../prompt.js";
import { cases, type ToolRecord } from "./cases.js";

interface CaseOutcome {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
  output: string;
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function main(): Promise<void> {
  const listOnly = process.argv.includes("--list");
  const keep = process.argv.includes("--keep");
  const filter = argValue("--case");
  const timeoutMs = Number(argValue("--timeout") ?? 180_000);
  const model = argValue("--model") ?? process.env.OPENCODE_MODEL ?? DEFAULT_MODEL;
  const usesOpenRouter = model.startsWith("openrouter/");

  const selected = filter ? cases.filter((testCase) => testCase.id === filter) : cases;
  if (selected.length === 0) {
    console.error(`No eval case matches "${filter}". Available: ${cases.map((c) => c.id).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (listOnly) {
    for (const testCase of selected) {
      console.log(`${testCase.id.padEnd(20)} ${testCase.goal}`);
    }
    return;
  }

  const tempRoot = join(process.cwd(), ".eval-tmp");
  mkdirSync(tempRoot, { recursive: true });

  let trace: ToolRecord[] = [];
  const harness = await AdvancedAgentHarness.create({
    ...(model ? { model } : {}),
    ...(usesOpenRouter ? { provider: openRouterProvider } : {}),
    systemInstruction: buildSystemPrompt({ today: new Date() }),
    permission: {
      edit: "allow",
      bash: "allow",
      webfetch: "allow",
      external_directory: "allow",
      doom_loop: "allow",
    },
    onTool: (call) => {
      trace.push({
        tool: call.tool,
        status: call.state.status,
        error: call.state.status === "error" ? call.state.error : undefined,
      });
    },
  });

  const outcomes: CaseOutcome[] = [];
  try {
    for (const testCase of selected) {
      const dir = mkdtempSync(join(tempRoot, `${testCase.id}-`));
      testCase.setup?.(dir);

      trace = [];
      harness.resetSession();

      let output = "";
      let detail = "";
      try {
        output = await withTimeout(harness.run(testCase.prompt(dir)), timeoutMs, testCase.id);
        detail = testCase.assert({ output, trace, dir }) ?? "";
      } catch (error) {
        detail = `run failed: ${error instanceof Error ? error.message : String(error)}`;
      }

      outcomes.push({
        id: testCase.id,
        name: testCase.name,
        passed: detail === "",
        detail,
        output,
      });

      if (!keep) rmSync(dir, { recursive: true, force: true });
    }
  } finally {
    await harness.close();
  }

  console.log("\nEval results");
  console.log("=".repeat(60));
  for (const outcome of outcomes) {
    console.log(`${outcome.passed ? "PASS" : "FAIL"}  ${outcome.id} - ${outcome.name}`);
    if (!outcome.passed) {
      console.log(`      ${outcome.detail}`);
      const snippet = outcome.output.trim().slice(0, 500);
      if (snippet) console.log(`      output: ${snippet.replace(/\n/g, "\n      ")}`);
    }
  }

  const passed = outcomes.filter((outcome) => outcome.passed).length;
  console.log("=".repeat(60));
  console.log(`${passed}/${outcomes.length} passed`);
  if (passed !== outcomes.length) process.exitCode = 1;
}

await main();
