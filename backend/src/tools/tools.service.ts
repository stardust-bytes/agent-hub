import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tool.findMany({ orderBy: { name: 'asc' } });
  }

  async findEnabled() {
    return this.prisma.tool.findMany({ where: { enabled: true } });
  }

  async toggle(name: string) {
    const tool = await this.prisma.tool.findUnique({ where: { name } });
    if (!tool) throw new Error(`Tool ${name} not found`);
    return this.prisma.tool.update({
      where: { name },
      data: { enabled: !tool.enabled },
    });
  }

  async findByName(name: string) {
    return this.prisma.tool.findUnique({ where: { name } });
  }

  async updateConfig(name: string, config: Record<string, unknown>) {
    return this.prisma.tool.update({
      where: { name },
      data: { config: JSON.stringify(config) },
    });
  }
}
