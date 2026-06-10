export interface ToolContext {
  mode: 'chat' | 'agent' | 'cowork';
  sessionId: number;
}

export interface ToolExecutor {
  readonly name: string;
  execute(args: Record<string, unknown>, context?: ToolContext): Promise<string>;
}
