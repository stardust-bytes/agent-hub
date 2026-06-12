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

  async upsert(type: string, data: { services?: string[]; account?: { email?: string; name?: string }; config: Record<string, unknown>; enabled?: boolean }) {
    const existing = await this.prisma.connector.findFirst({ where: { type } });
    if (existing) {
      return this.prisma.connector.update({
        where: { id: existing.id },
        data: {
          services: data.services ? JSON.stringify(data.services) : undefined,
          account: data.account ? JSON.stringify(data.account) : undefined,
          config: JSON.stringify(data.config),
          enabled: data.enabled ?? existing.enabled,
        },
      });
    }
    return this.prisma.connector.create({
      data: {
        type,
        services: data.services ? JSON.stringify(data.services) : '[]',
        account: data.account ? JSON.stringify(data.account) : null,
        config: JSON.stringify(data.config),
        enabled: data.enabled ?? false,
      },
    });
  }

  async update(id: string, data: { services?: string[]; account?: { email?: string; name?: string }; config?: Record<string, unknown>; enabled?: boolean }) {
    const updateData: Record<string, unknown> = {};
    if (data.services !== undefined) updateData.services = JSON.stringify(data.services);
    if (data.account !== undefined) updateData.account = JSON.stringify(data.account);
    if (data.config !== undefined) updateData.config = JSON.stringify(data.config);
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    return this.prisma.connector.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    return this.prisma.connector.delete({ where: { id } });
  }
}
