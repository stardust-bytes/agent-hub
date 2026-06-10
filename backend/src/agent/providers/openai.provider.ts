import { Injectable, Logger } from '@nestjs/common';
import { LLMProvider, OllamaMessage, StreamOptions, StreamChunk } from './llm-provider.interface';
import { ToolDefinition } from '../services/context-builder.service';

@Injectable()
export class OpenAIProvider implements LLMProvider {
  private readonly logger = new Logger(OpenAIProvider.name);

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
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST', headers, body: JSON.stringify(body), signal,
      });
    } catch {
      if (signal.aborted) return;
      yield { type: 'error', error: 'provider_unreachable' };
      return;
    }

    if (!res.ok) {
      let detail = `provider_error_${res.status}`;
      try {
        const errBody = await res.json() as { error?: { message?: string } | string };
        if (typeof errBody.error === 'string') detail = errBody.error;
        else if (errBody.error?.message) detail = errBody.error.message;
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
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') { yield { type: 'done' }; return; }

        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{
              delta?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> };
              finish_reason?: string;
            }>;
            usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
          };

          const choice = parsed.choices?.[0];
          if (!choice) continue;

          if (choice.delta?.content) {
            yield { type: 'token', token: choice.delta.content };
          }

          if (choice.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              let parsedArgs: unknown;
              try { parsedArgs = JSON.parse(tc.function.arguments); } catch { parsedArgs = tc.function.arguments; }
              yield {
                type: 'tool_call',
                toolCall: { name: tc.function.name, arguments: parsedArgs },
              };
            }
          }
        } catch { /* skip unparseable */ }
      }
    }
    yield { type: 'done' };
  }
}
