import type { Config } from "@opencode-ai/sdk";

export const GEMMA_4_31B_IT = "openrouter/google/gemma-4-31b-it";
export const GEMMA_4_31B_IT_FREE = "openrouter/google/gemma-4-31b-it:free";

export const DEFAULT_MODEL = GEMMA_4_31B_IT_FREE;

type ProviderModel = NonNullable<NonNullable<Config["provider"]>[string]["models"]>[string];

const gemmaModel: ProviderModel = {
  name: "Gemma 4 31B IT",
  tool_call: true,
  reasoning: false,
  attachment: false,
  temperature: true,
  limit: { context: 128_000, output: 8_192 },
  modalities: { input: ["text"], output: ["text"] },
};

export const openRouterProvider: NonNullable<Config["provider"]> = {
  openrouter: {
    models: {
      "google/gemma-4-31b-it": gemmaModel,
      "google/gemma-4-31b-it:free": { ...gemmaModel, name: "Gemma 4 31B IT (Free)" },
    },
  },
};
