import { Injectable } from '@nestjs/common';
import { OllamaProvider } from '../providers/ollama.provider';
import { OllamaMessage, StreamOptions, StreamChunk } from '../providers/llm-provider.interface';
import { ToolDefinition } from './context-builder.service';

@Injectable()
export class LLMControllerService {
  private providers: Map<string, OllamaProvider>;

  constructor(private readonly ollama: OllamaProvider) {
    this.providers = new Map([['ollama', ollama]]);
  }

  registerProvider(type: string, provider: OllamaProvider): void {
    this.providers.set(type, provider);
  }

  async *stream(
    providerType: string,
    model: string,
    messages: OllamaMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal,
    baseUrl: string,
    key?: string,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      yield { type: 'error', error: `unknown_provider: ${providerType}` };
      return;
    }

    const opts: StreamOptions = { model, messages, tools, signal, baseUrl, key };
    yield* provider.stream(opts);
  }

  buildMessages(
    systemPrompt: string,
    history: OllamaMessage[],
    userMessage: string,
    toolResults?: Array<{ name: string; content: string }>,
  ): OllamaMessage[] {
    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    if (toolResults) {
      for (const tr of toolResults) {
        messages.push({ role: 'tool', content: tr.content, toolCalls: [{ function: { name: tr.name, arguments: {} } }] });
      }
    }

    return messages;
  }
}
