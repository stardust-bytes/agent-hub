export interface AgentAction {
  type: 'activate_skill' | 'call_tool' | 'search_kb' | 'call_agent' | 'respond' | 'unknown';
  skillSlug?: string;
  toolSlug?: string;
  args?: Record<string, unknown>;
  query?: string;
  agentSlug?: string;
  content?: string;
}

export function parseAction(response: string): AgentAction {
  if (!response || !response.trim()) {
    return { type: 'unknown' };
  }

  try {
    const json = JSON.parse(response.trim());
    if (json.action) {
      return parseActionString(json.action);
    }
    if (json.content || json.message || json.thought) {
      return { type: 'respond', content: json.content || json.message || json.thought };
    }
  } catch {
  }

  const actionMatch = response.match(/"action"\s*:\s*"(.+?)"/);
  if (actionMatch) {
    return parseActionString(actionMatch[1]);
  }

  const firstLine = response.trim().split('\n')[0].trim();

  if (firstLine.startsWith('activate_skill:')) {
    const skillSlug = firstLine.slice(14).trim();
    const remainingLines = response.trim().split('\n').slice(1).join('\n').trim();
    return { type: 'activate_skill', skillSlug, content: remainingLines || undefined };
  }

  if (firstLine.startsWith('search_kb:')) {
    const query = firstLine.slice(10).trim();
    return { type: 'search_kb', query };
  }

  return { type: 'respond', content: response.trim() };
}

function parseActionString(actionStr: string): AgentAction {
  const trimmed = actionStr.trim();

  if (trimmed.startsWith('respond:')) {
    const content = trimmed.slice(7).trim();
    return { type: 'respond', content };
  }

  if (trimmed.startsWith('activate_skill:')) {
    const skillSlug = trimmed.slice(14).trim();
    return { type: 'activate_skill', skillSlug };
  }

  const toolMatch = trimmed.match(/^call_tool:([a-zA-Z0-9_-]+)\((.*)?\)$/s);
  if (toolMatch) {
    const toolSlug = toolMatch[1];
    let args: Record<string, unknown> = {};
    if (toolMatch[2]) {
      try {
        args = JSON.parse(toolMatch[2]);
      } catch {
        args = { input: toolMatch[2] };
      }
    }
    return { type: 'call_tool', toolSlug, args };
  }

  if (trimmed.startsWith('search_kb:')) {
    const query = trimmed.slice(10).trim();
    return { type: 'search_kb', query };
  }

  if (trimmed.startsWith('call_agent:')) {
    const rest = trimmed.slice(11).trim();
    const agentMatch = rest.match(/^([a-zA-Z0-9_-]+)\((.*)?\)$/s);
    if (agentMatch) {
      return { type: 'call_agent', agentSlug: agentMatch[1], content: agentMatch[2] };
    }
    return { type: 'call_agent', agentSlug: rest };
  }

  return { type: 'respond', content: trimmed };
}
