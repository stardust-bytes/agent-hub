export interface ToolExecutor {
  readonly name: string
  execute(args: Record<string, unknown>): Promise<string>
}
