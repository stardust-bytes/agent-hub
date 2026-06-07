import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { LLMProvider } from './llm-provider.interface';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class OllamaProvider implements LLMProvider {
  constructor(private readonly settings: SettingsService) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) return;

    const ollamaUrl = await this.settings.get('ollama.baseUrl', 'http://localhost:11434');

    let ollamaRes: globalThis.Response;
    try {
      ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: message }],
          stream: true,
        }),
        signal,
      });
    } catch {
      if (signal.aborted) return;
      res.write('data: {"error":"ollama_unreachable"}\n\n');
      res.write('data: [DONE]\n\n');
      return;
    }

    if (!ollamaRes.ok) {
      let detail = `ollama_error_${ollamaRes.status}`;
      try {
        const errBody = (await ollamaRes.json()) as { error?: string };
        if (errBody.error) detail = errBody.error;
      } catch { /* ignore parse error */ }
      res.write(`data: ${JSON.stringify({ error: detail })}\n\n`);
      res.write('data: [DONE]\n\n');
      return;
    }

    const reader = ollamaRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
          };
          if (parsed.message?.content) {
            res.write(`data: ${JSON.stringify({ token: parsed.message.content })}\n\n`);
          }
        } catch {
          // skip malformed line
        }
      }
    }

    if (!signal.aborted) {
      res.write('data: [DONE]\n\n');
    }
  }
}
