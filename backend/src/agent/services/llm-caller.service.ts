import { Injectable, Logger } from '@nestjs/common';
import { OllamaMessage } from '../providers/llm-provider.interface';
import { ToolDefinition } from './context-builder.service';

export interface StreamChunk {
  type: 'token' | 'tool_call' | 'thinking' | 'done' | 'error';
  token?: string;
  toolCall?: { name: string; arguments: unknown };
  thinking?: string;
  error?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

@Injectable()
export class LLMCallerService {
  private readonly logger = new Logger(LLMCallerService.name);

  async *streamChat(
    model: string,
    messages: OllamaMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal,
    baseUrl: string,
    key?: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (signal.aborted) return;

    const msgs: Array<Record<string, unknown>> = [
      ...messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
      })),
    ];

    const body: Record<string, unknown> = {
      model,
      messages: msgs,
      stream: true,
    };
    if (tools.length > 0) {
      body.tools = tools;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    let ollamaRes: globalThis.Response;
    try {
      ollamaRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      if (signal.aborted) return;
      yield { type: 'error', error: 'ollama_unreachable' };
      return;
    }

    if (!ollamaRes.ok) {
      let detail = `ollama_error_${ollamaRes.status}`;
      try {
        const errBody = await ollamaRes.json() as { error?: string };
        if (errBody.error) detail = errBody.error;
      } catch { }
      yield { type: 'error', error: detail };
      return;
    }

    const reader = ollamaRes.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

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
                toolCall: {
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
              };
            }
          }
        } catch { }
      }
    }

    yield { type: 'done' };
  }
}
