import { createOpencode } from "@opencode-ai/sdk";
import type { Config, Part } from "@opencode-ai/sdk";

export interface HarnessConfig {
  model?: string;
  agent?: string;
  systemInstruction?: string;
  permission?: Config["permission"];
}

type Opencode = Awaited<ReturnType<typeof createOpencode>>;

export class AdvancedAgentHarness {
  private readonly client: Opencode["client"];
  private readonly server: Opencode["server"];
  private readonly config: HarnessConfig;
  private sessionID?: string;

  private constructor(opencode: Opencode, config: HarnessConfig) {
    this.client = opencode.client;
    this.server = opencode.server;
    this.config = config;
  }

  static async create(config: HarnessConfig = {}): Promise<AdvancedAgentHarness> {
    const opencode = await createOpencode({
      config: {
        logLevel: "ERROR",
        ...(config.model ? { model: config.model } : {}),
        permission: config.permission ?? {
          edit: "allow",
          bash: "allow",
          webfetch: "allow",
        },
      },
    });

    return new AdvancedAgentHarness(opencode, config);
  }

  async run(userPrompt: string): Promise<string> {
    console.log(`\n🚀 Initializing task payload loop: "${userPrompt}"`);

    if (!this.sessionID) {
      const session = await this.client.session.create({
        body: { title: "Advanced Agent Harness" },
        throwOnError: true,
      });
      this.sessionID = session.data.id;
    }

    console.log(`🤖 Dispatching prompt to opencode session ${this.sessionID}...`);

    const result = await this.client.session.prompt({
      path: { id: this.sessionID },
      body: {
        ...(this.config.agent ? { agent: this.config.agent } : {}),
        ...(this.config.systemInstruction ? { system: this.config.systemInstruction } : {}),
        parts: [{ type: "text", text: userPrompt }],
      },
      throwOnError: true,
    });

    const { info, parts } = result.data;
    logToolActivity(parts);

    if (info.error) {
      const detail = JSON.stringify(info.error);
      throw new Error(`opencode reported an error: ${detail}`);
    }

    console.log(`🏁 Task concluded with terminal answer.`);
    return collectText(parts) || "Task finalized successfully.";
  }

  async close(): Promise<void> {
    this.server.close();
  }
}

function collectText(parts: Part[]): string {
  return parts
    .filter((part): part is Extract<Part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function logToolActivity(parts: Part[]): void {
  const toolParts = parts.filter((part): part is Extract<Part, { type: "tool" }> => part.type === "tool");
  for (const part of toolParts) {
    console.log(`🛠️  ${part.tool} -> ${part.state.status}`);
  }
}
