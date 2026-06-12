import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertConnectorDto } from './dto/upsert-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';

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

  async upsert(type: string, dto: UpsertConnectorDto) {
    const existing = await this.prisma.connector.findFirst({ where: { type } });
    const data: Record<string, unknown> = {
      services: JSON.stringify(dto.services ?? []),
    };
    if (dto.config !== undefined) data.config = JSON.stringify(dto.config);
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.name) data.account = JSON.stringify({ name: dto.name });

    if (existing) {
      return this.prisma.connector.update({ where: { id: existing.id }, data });
    }
    return this.prisma.connector.create({
      data: { ...data, type } as any,
    });
  }

  async update(id: string, dto: UpdateConnectorDto) {
    const data: Record<string, unknown> = {};
    if (dto.services !== undefined) data.services = JSON.stringify(dto.services);
    if (dto.config !== undefined) data.config = JSON.stringify(dto.config);
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.name !== undefined) data.account = JSON.stringify({ name: dto.name });
    return this.prisma.connector.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.connector.delete({ where: { id } });
  }
}
