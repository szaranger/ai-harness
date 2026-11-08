import { AdvancedAgentHarness } from "./harness.js";

async function executionPipeline() {
  const harness = await AdvancedAgentHarness.create({
    systemInstruction:
      "You are a code inspection engineer. When calculating logic, construct runtime code and verify your assumptions using your tools.",
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
