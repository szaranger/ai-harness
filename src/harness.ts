import { createOpencode } from "@opencode-ai/sdk";
import type { Config, Part } from "@opencode-ai/sdk";

export type ToolCall = Extract<Part, { type: "tool" }>;

export interface HarnessConfig {
  model?: string;
  agent?: string;
  systemInstruction?: string;
  permission?: Config["permission"];
  tools?: Config["tools"];
  onTool?: (tool: ToolCall) => void;
}

type Opencode = Awaited<ReturnType<typeof createOpencode>>;

export class AdvancedAgentHarness {
  private readonly client: Opencode["client"];
  private readonly server: Opencode["server"];
  private readonly config: HarnessConfig;
  private readonly notifiedToolIDs = new Set<string>();
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
        tools: config.tools ?? { question: false },
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
    const messages = await this.client.session.messages({
      path: { id: this.sessionID },
      throwOnError: true,
    });
    const allParts = messages.data.flatMap((message) => message.parts);
    logToolActivity(allParts);
    this.notifyTools(allParts);

    if (info.error) {
      const detail = JSON.stringify(info.error);
      throw new Error(`opencode reported an error: ${detail}`);
    }

    console.log(`🏁 Task concluded with terminal answer.`);
    const answer = collectText(parts);
    if (!answer) {
      throw new Error("opencode returned no text answer for this task.");
    }
    return answer;
  }

  async close(): Promise<void> {
    this.server.close();
  }

  resetSession(): void {
    this.sessionID = undefined;
    this.notifiedToolIDs.clear();
  }

  private notifyTools(parts: Part[]): void {
    if (!this.config.onTool) return;
    for (const part of parts) {
      if (part.type !== "tool" || this.notifiedToolIDs.has(part.id)) continue;
      this.notifiedToolIDs.add(part.id);
      this.config.onTool(part);
    }
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
    const status = part.state.status;
    const detail = part.state.status === "error" ? ` - ${part.state.error}` : "";
    console.log(`🛠️  ${part.tool} -> ${status}${detail}`);
  }
}
