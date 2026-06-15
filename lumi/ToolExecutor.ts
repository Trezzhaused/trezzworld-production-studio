export interface ToolDefinition {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  execute: (input: unknown) => Promise<unknown> | unknown;
}

export interface ToolExecutionResult {
  success: boolean;
  toolId: string;
  result?: unknown;
  error?: string;
  executedAt: string;
}

export class ToolExecutor {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): ToolDefinition {
    this.tools.set(tool.id, tool);
    return tool;
  }

  unregister(id: string): boolean {
    return this.tools.delete(id);
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  async execute(toolId: string, input: unknown): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolId);
    if (!tool || !tool.enabled) {
      return { success: false, toolId, error: 'Tool not found or disabled', executedAt: new Date().toISOString() };
    }
    try {
      const result = await tool.execute(input);
      return { success: true, toolId, result, executedAt: new Date().toISOString() };
    } catch (err) {
      return { success: false, toolId, error: err instanceof Error ? err.message : String(err), executedAt: new Date().toISOString() };
    }
  }
}
