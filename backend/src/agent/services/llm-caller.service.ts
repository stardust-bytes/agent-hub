import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
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

  constructor(private readonly settings: SettingsService) {}

  async *streamChat(
    model: string,
    messages: OllamaMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (signal.aborted) return;

    const ollamaUrl = await this.settings.get('ollama.baseUrl', 'http://localhost:11434');

    const msgs: Array<Record<string, unknown>> = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ];

    const body: Record<string, unknown> = {
      model,
      messages: msgs,
      stream: true,
    };
    if (tools.length > 0) {
      body.tools = tools;
    }

    let ollamaRes: globalThis.Response;
    try {
      ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
