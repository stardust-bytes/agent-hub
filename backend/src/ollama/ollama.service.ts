import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OllamaService {
  private readonly ollamaUrl: string;

  constructor(private readonly config: ConfigService) {
    this.ollamaUrl = this.config.get<string>('OLLAMA_URL', 'http://localhost:11434');
  }

  async getModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { models: Array<{ name: string }> };
      return data.models.map((m) => m.name);
    } catch {
      throw new ServiceUnavailableException('ollama_unreachable');
    }
  }
}
