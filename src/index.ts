import { AdvancedAgentHarness } from "./harness.js";
import { buildSystemPrompt } from "./prompt.js";
import { DEFAULT_MODEL, openRouterProvider } from "./models.js";

function argValue(name: string): string | undefined {
  const index = process.argv.lastIndexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function executionPipeline() {
  const model = argValue("--model") ?? process.env.OPENCODE_MODEL ?? DEFAULT_MODEL;
  const usesOpenRouter = model.startsWith("openrouter/");

  const harness = await AdvancedAgentHarness.create({
    model,
    ...(usesOpenRouter ? { provider: openRouterProvider } : {}),
    systemInstruction: buildSystemPrompt({ today: new Date() }),
  });

  const executionObjective =
    "Compute the value of the 25th element in a standard Fibonacci sequence. " +
    "Verify the calculation by writing and running an isolated JavaScript loop script.";

  try {
    const finalOutcomeText = await harness.run(executionObjective);
    console.log(`\n🎯 Complete Task Result:\n${finalOutcomeText}`);
  } catch (criticalFailure: unknown) {
    const message = criticalFailure instanceof Error ? criticalFailure.message : String(criticalFailure);
    console.error(`Fatal Execution Boundary Collapse:`, message);
    process.exitCode = 1;
  } finally {
    await harness.close();
  }
}

await executionPipeline();
