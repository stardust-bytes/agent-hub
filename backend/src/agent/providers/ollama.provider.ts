import { Injectable, Logger } from '@nestjs/common';
import { LLMProvider, OllamaMessage, StreamOptions, StreamChunk } from './llm-provider.interface';
import { ToolDefinition } from '../services/context-builder.service';

@Injectable()
export class OllamaProvider implements LLMProvider {
  private readonly logger = new Logger(OllamaProvider.name);

  async *stream(options: StreamOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const { model, messages, tools, signal, baseUrl, key } = options;
    if (signal.aborted) return;

    const msgs: Array<Record<string, unknown>> = messages.map(m => ({
      role: m.role,
      content: m.content,
      ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
    }));

    const body: Record<string, unknown> = { model, messages: msgs, stream: true };
    if (tools.length > 0) body.tools = tools;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    let res: globalThis.Response;
    try {
      res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST', headers, body: JSON.stringify(body), signal,
      });
    } catch {
      if (signal.aborted) return;
      yield { type: 'error', error: 'ollama_unreachable' };
      return;
    }

    if (!res.ok) {
      let detail = `ollama_error_${res.status}`;
      try {
        const errBody = await res.json() as { error?: string };
        if (errBody.error) detail = errBody.error;
      } catch { /* ignore parse error */ }
      yield { type: 'error', error: detail };
      return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    signal.addEventListener('abort', () => reader.cancel(), { once: true });

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: unknown } }> };
            done?: boolean;
          };
          if (parsed.message?.content) {
            yield { type: 'token', token: parsed.message.content };
          }
          if (parsed.message?.tool_calls) {
            for (const tc of parsed.message.tool_calls) {
              yield {
                type: 'tool_call',
                toolCall: { name: tc.function.name, arguments: tc.function.arguments },
              };
            }
          }
        } catch { /* skip unparseable lines */ }
      }
    }
    yield { type: 'done' };
  }
}
