import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<{ ollama: { baseUrl: string; defaultModel: string } }> {
    const baseUrl = await this.get('ollama.baseUrl', 'http://localhost:11434');
    const defaultModel = await this.get('ollama.defaultModel', 'llama3.2');
    return { ollama: { baseUrl, defaultModel } };
  }

  async get(key: string, fallback: string): Promise<string> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    return setting?.value ?? fallback;
  }

  async upsert(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
