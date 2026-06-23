import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { CreateProviderModelDto } from './dto/create-provider-model.dto';

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.provider.findMany({ include: { models: true } });
  }

  create(dto: CreateProviderDto) {
    return this.prisma.provider.create({
      data: { name: dto.name, type: dto.type ?? 'ollama', baseUrl: dto.baseUrl, key: dto.key },
    });
  }

  update(id: number, dto: UpdateProviderDto) {
    return this.prisma.provider.update({ where: { id }, data: dto });
  }

  remove(id: number) {
    return this.prisma.provider.delete({ where: { id } });
  }

  addModel(providerId: number, dto: CreateProviderModelDto) {
    return this.prisma.providerModel.create({ data: { providerId, name: dto.name } });
  }

  removeModel(_providerId: number, modelId: number) {
    return this.prisma.providerModel.delete({ where: { id: modelId } });
  }

  async findAllModels() {
    const models = await this.prisma.providerModel.findMany({
      include: { provider: true },
      orderBy: [{ provider: { name: 'asc' } }, { name: 'asc' }],
    });
    return models.map(m => ({
      id: m.id,
      name: m.name,
      providerId: m.providerId,
      providerName: m.provider.name,
    }));
  }

  findModelWithProvider(id: number) {
    return this.prisma.providerModel.findUnique({
      where: { id },
      include: { provider: true },
    });
  }

  async syncModels(id: number): Promise<number> {
    const provider = await this.prisma.provider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException(`Provider ${id} not found`);

    const baseUrl = (provider.baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
    let modelNames: string[] = [];

    if (provider.type === 'ollama') {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) throw new Error(`ollama_tags_error_${res.status}`);
      const data = await res.json() as { models?: Array<{ name: string }> };
      modelNames = (data.models ?? []).map(m => m.name);
    } else if (provider.type === 'gemini') {
      const key = provider.key ?? process.env.GEMINI_API_KEY ?? '';
      if (!key) throw new Error('gemini_api_key_required');
      const res = await fetch(`${baseUrl}/models?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(`gemini_models_error_${res.status}`);
      const data = await res.json() as { models?: Array<{ name: string }> };
      modelNames = (data.models ?? [])
        .map(m => m.name.replace(/^models\//, ''))
        .filter(n => n.startsWith('gemini-'));
    } else {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (provider.key) headers['Authorization'] = `Bearer ${provider.key}`;
      const res = await fetch(`${baseUrl}/models`, { headers });
      if (!res.ok) throw new Error(`models_error_${res.status}`);
      const data = await res.json() as { data?: Array<{ id: string }> };
      modelNames = (data.data ?? []).map(m => m.id);
    }

    const existing = await this.prisma.providerModel.findMany({
      where: { providerId: id },
      select: { name: true },
    });
    const existingNames = new Set(existing.map(m => m.name));

    let added = 0;
    for (const name of modelNames) {
      if (!existingNames.has(name)) {
        await this.prisma.providerModel.create({ data: { providerId: id, name } });
        added++;
      }
    }
    return added;
  }
}
