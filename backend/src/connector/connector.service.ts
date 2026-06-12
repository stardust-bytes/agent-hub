import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConnectorService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.connector.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findById(id: string) {
    return this.prisma.connector.findUnique({ where: { id } });
  }

  async findByType(type: string) {
    return this.prisma.connector.findFirst({ where: { type } });
  }

  async upsert(type: string, data: { name: string; config: Record<string, unknown>; enabled?: boolean }) {
    const existing = await this.prisma.connector.findFirst({ where: { type } });
    if (existing) {
      return this.prisma.connector.update({
        where: { id: existing.id },
        data: { name: data.name, config: JSON.stringify(data.config), enabled: data.enabled ?? existing.enabled },
      });
    }
    return this.prisma.connector.create({
      data: { name: data.name, type, config: JSON.stringify(data.config), enabled: data.enabled ?? false },
    });
  }

  async update(id: string, data: { name?: string; config?: Record<string, unknown>; enabled?: boolean }) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.config !== undefined) updateData.config = JSON.stringify(data.config);
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    return this.prisma.connector.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    return this.prisma.connector.delete({ where: { id } });
  }
}
