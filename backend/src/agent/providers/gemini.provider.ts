import { Injectable, Logger } from '@nestjs/common';
import { LLMProvider, OllamaMessage, StreamOptions, StreamChunk } from './llm-provider.interface';
import { ToolDefinition } from '../services/context-builder.service';

const GEMINI_PARAM_KEYS = new Set([
  'type', 'properties', 'items', 'required', 'description', 'enum', 'nullable',
]);

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiToolCall {
  name: string;
  args: Record<string, unknown>;
}

@Injectable()
export class GeminiProvider implements LLMProvider {
  private readonly logger = new Logger(GeminiProvider.name);

  async *stream(options: StreamOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const { model, messages, tools, signal, baseUrl, key } = options;
    if (signal.aborted) return;

    const apiKey = key ?? process.env.GEMINI_API_KEY ?? '';
    if (!apiKey) {
      yield { type: 'error', error: 'Gemini API key is required. Set GEMINI_API_KEY env var or provide key in provider config.' };
      return;
    }

    const base = (baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    const url = `${base}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    const { systemInstruction, contents } = this.buildContents(messages);

    const body: Record<string, unknown> = { contents };
    if (systemInstruction) body.systemInstruction = systemInstruction;
    if (tools.length > 0) {
      body.tools = [{
        functionDeclarations: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: this.sanitizeParams(t.function.parameters as Record<string, unknown>),
        })),
      }];
    }

    let res: globalThis.Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      if (signal.aborted) return;
      yield { type: 'error', error: 'provider_unreachable' };
      return;
    }

    if (!res.ok) {
      let detail = `provider_error_${res.status}`;
      try {
        const errBody = await res.json() as { error?: { message?: string } };
        if (errBody.error?.message) detail = errBody.error.message;
      } catch { /* ignore parse error */ }
      yield { type: 'error', error: detail };
      return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let lastUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

    signal.addEventListener('abort', () => {
      try {
        reader.cancel().catch(() => { /* stream already torn down by fetch abort */ });
      } catch { /* reader.cancel() can throw synchronously mid-teardown */ }
    }, { once: true });

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

        if (payload === '[DONE]') {
          yield { type: 'done', usage: lastUsage };
          return;
        }

        try {
          const parsed = JSON.parse(payload) as {
            candidates?: Array<{
              content?: { parts?: GeminiPart[] };
              finishReason?: string;
            }>;
            usageMetadata?: {
              promptTokenCount: number;
              candidatesTokenCount: number;
              totalTokenCount: number;
            };
          };

          if (parsed.usageMetadata) {
            lastUsage = {
              promptTokens: parsed.usageMetadata.promptTokenCount,
              completionTokens: parsed.usageMetadata.candidatesTokenCount,
              totalTokens: parsed.usageMetadata.totalTokenCount,
            };
          }

          const candidate = parsed.candidates?.[0];
          if (!candidate?.content?.parts) continue;

          for (const part of candidate.content.parts) {
            if (part.text) {
              yield { type: 'token', token: part.text };
            }
            if (part.functionCall) {
              const tc: GeminiToolCall = {
                name: part.functionCall.name,
                args: part.functionCall.args ?? {},
              };
              yield { type: 'tool_call', toolCall: { name: tc.name, arguments: tc.args } };
            }
          }

          if (candidate.finishReason === 'STOP' || candidate.finishReason === 'MAX_TOKENS') {
            yield { type: 'done', usage: lastUsage };
            return;
          }
        } catch { /* skip unparseable */ }
      }
    }

    yield { type: 'done', usage: lastUsage };
  }

  private sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (!GEMINI_PARAM_KEYS.has(key)) continue;
      if (key === 'properties' && typeof value === 'object' && value !== null) {
        const cleaned: Record<string, unknown> = {};
        for (const [propKey, propVal] of Object.entries(value as Record<string, unknown>)) {
          cleaned[propKey] = typeof propVal === 'object' && propVal !== null && !Array.isArray(propVal)
            ? this.sanitizeParams(propVal as Record<string, unknown>)
            : propVal;
        }
        result[key] = cleaned;
      } else if (key === 'items' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.sanitizeParams(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    if (result.type === 'array' && !result.items) {
      result.items = { type: 'object' };
    }
    const items = result.items;
    if (items && typeof items === 'object' && !(items as Record<string, unknown>).type) {
      (items as Record<string, unknown>).type = 'object';
    }
    if (!result.type && typeof result.properties === 'object') {
      result.type = 'object';
    }

    return result;
  }

  private buildContents(messages: OllamaMessage[]): {
    systemInstruction?: { parts: GeminiPart[] };
    contents: GeminiContent[];
  } {
    const systemParts: GeminiPart[] = [];
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemParts.push({ text: msg.content });
        continue;
      }

      const role = msg.role === 'assistant' ? 'model' : msg.role === 'tool' ? 'function' : 'user';
      const parts: GeminiPart[] = [];

      if (msg.content) {
        parts.push({ text: msg.content });
      }

      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          const args = typeof tc.function.arguments === 'string'
            ? (() => { try { return JSON.parse(tc.function.arguments as string); } catch { return {}; } })()
            : tc.function.arguments as Record<string, unknown>;
          parts.push({
            functionCall: {
              name: tc.function.name,
              args,
            },
          });
        }
      }

      if (msg.role === 'tool' && msg.toolCallId) {
        let response: Record<string, unknown> = {};
        try { response = { result: JSON.parse(msg.content) }; } catch { response = { result: msg.content }; }
        parts.push({
          functionResponse: {
            name: msg.toolCallId,
            response,
          },
        });
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    return {
      systemInstruction: systemParts.length > 0 ? { parts: systemParts } : undefined,
      contents,
    };
  }
}
