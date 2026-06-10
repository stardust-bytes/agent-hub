import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
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

  async set(key: string, value: string): Promise<void> {
    return this.upsert(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.prisma.setting.delete({ where: { key } });
  }
}
