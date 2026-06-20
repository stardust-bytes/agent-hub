import { ToolDefinition } from '../services/context-builder.service';

const DISPATCH_TOOLS = new Set(['spawn_subagent', 'delegate']);

export function filterSubagentTools(tools: ToolDefinition[], allowedTools?: string): ToolDefinition[] {
  let allowed: Set<string> | null = null;
  if (allowedTools && allowedTools !== '*') {
    try {
      const parsed = JSON.parse(allowedTools);
      if (Array.isArray(parsed)) allowed = new Set(parsed.map(String));
    } catch { /* treat as wildcard */ }
  }
  return tools.filter(t => {
    const name = t.function.name;
    if (DISPATCH_TOOLS.has(name)) return false;
    if (allowed && !allowed.has(name)) return false;
    return true;
  });
}

export async function runWithConcurrency<T, R>(
  items: T[], limit: number, fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
