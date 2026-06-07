import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { OllamaProvider } from './providers/ollama.provider';
import { KnowledgeService } from '../knowledge/knowledge.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly provider: OllamaProvider,
    private readonly knowledge: KnowledgeService,
  ) {}

  async streamChat(
    message: string,
    model: string,
    res: Response,
    signal: AbortSignal,
  ): Promise<void> {
    let context = '';
    try {
      const chunks = await this.knowledge.search(message);
      if (chunks.length > 0) {
        context = 'Context from knowledge base:\n' + chunks.map((c: { filename: string; text: string }) =>
          `[File: ${c.filename}]\n${c.text}`
        ).join('\n---\n') + '\n';
      }
    } catch { /* RAG failure should not block chat */ }
    await this.provider.streamChat(message, model, res, signal, context);
  }
}
