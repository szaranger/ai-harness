# ai-harness

A small TypeScript harness around the [opencode](https://opencode.ai) SDK for running an autonomous coding agent with a versioned system prompt, tool tracing, and an eval suite.

## Requirements

- Node.js 20+
- A configured opencode model/provider

## Install

```bash
npm install
```

## Usage

Run the example task (compute and verify the 25th Fibonacci number):

```bash
npm start
```

The example lives in `src/index.ts`. It builds the system prompt and runs a single objective:

```ts
import { AdvancedAgentHarness } from "./harness.js";
import { buildSystemPrompt } from "./prompt.js";

const harness = await AdvancedAgentHarness.create({
  systemInstruction: buildSystemPrompt({ today: new Date() }),
});

const answer = await harness.run("Compute the 25th Fibonacci number and verify it.");
console.log(answer);

await harness.close();
```

## Models

`npm start` runs Gemma 4 31B IT (free tier) through OpenRouter. The npm scripts load `.env` automatically when present.

```bash
export OPENROUTER_API_KEY=...
npm start                    # Gemma 4 31B IT free tier (default)
npm run start:gemma:free     # same as npm start
npm run start:gemma:paid     # paid model, requires OpenRouter credits
npm run eval                 # evals against the free model
npm run eval:gemma           # alias for npm run eval
```

Override the model with `--model` or `OPENCODE_MODEL`:

```bash
npm start -- --model opencode/big-pickle
OPENCODE_MODEL=opencode/big-pickle npm start
```

If the paid model returns `402 Insufficient credits`, use the free tier or add credits to your OpenRouter account.

`opencode.json` registers the model with the opencode CLI, and `src/models.ts` supplies the same provider config to the harness when the model id starts with `openrouter/`.

## How it works

- **`src/harness.ts`** — wraps `createOpencode`. Creates a session on first `run()`, sends the prompt, collects the final text answer, and reports tool activity. A session is reused across `run()` calls until `resetSession()` is called. The interactive `question` tool is disabled by default so runs do not block waiting for input.
- **`src/prompt.ts`** — builds the system prompt from stable sections (identity, task, tools, autonomy, untrusted content, context, output, quality, limits, examples) followed by dynamic context (workspace, date). Exposes `PROMPT_VERSION`.
- **`src/evals/`** — a small eval suite that exercises the prompt and harness end to end.

### Harness options

```ts
interface HarnessConfig {
  model?: string;
  agent?: string;
  systemInstruction?: string;
  permission?: Config["permission"];
  provider?: Config["provider"];
  tools?: Config["tools"];
  onTool?: (tool: ToolCall) => void;
}
```

`onTool` fires once per tool call with its final state (`completed` or `error`), which is useful for logging and evals.

## Evals

```bash
npm run eval                  # run all cases
npm run eval -- --list        # list cases
npm run eval -- --case prompt-injection
npm run eval -- --timeout 120000
npm run eval -- --keep        # keep per-case temp files
```

Cases are defined in `src/evals/cases.ts`. Each case provides a prompt, optional fixture setup, and an assertion over the final answer and tool trace. The runner isolates each case in a fresh session under `.eval-tmp/` and exits non-zero if any case fails.

Current cases:

| Case | Checks |
| --- | --- |
| `verified-answer` | Computes the right value and verifies it with a tool |
| `tool-error-recovery` | Reports a missing-file failure instead of fabricating contents |
| `prompt-injection` | Treats embedded instructions as data and flags them |
| `ambiguous-request` | States an assumption or asks instead of silently guessing |

## Development

```bash
npx tsc --noEmit --module nodenext --moduleResolution nodenext --target es2022 --strict --skipLibCheck \
  src/index.ts src/harness.ts src/prompt.ts src/models.ts src/evals/cases.ts src/evals/run.ts
```

When changing the prompt, bump `PROMPT_VERSION`, change one rule at a time, and re-run the evals.
