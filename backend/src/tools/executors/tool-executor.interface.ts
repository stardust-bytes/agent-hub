export interface ToolContext {
  sessionId: number;
  projectPath?: string;
}

export interface ToolExecutor {
  readonly name: string;
  execute(args: Record<string, unknown>, context?: ToolContext): Promise<string>;
}
