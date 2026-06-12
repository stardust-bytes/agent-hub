import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsageDto } from './dto/create-usage.dto';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async record(dto: CreateUsageDto) {
    return this.prisma.usageRecord.create({ data: dto });
  }

  async getTotal(): Promise<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    requestCount: number;
  }> {
    const result = await this.prisma.usageRecord.aggregate({
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
      _count: { id: true },
    });
    return {
      promptTokens: result._sum.promptTokens ?? 0,
      completionTokens: result._sum.completionTokens ?? 0,
      totalTokens: result._sum.totalTokens ?? 0,
      requestCount: result._count.id,
    };
  }

  async getPerSession(): Promise<
    Array<{
      sessionId: number;
      sessionTitle: string;
      modelName: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }>
  > {
    const groups = await this.prisma.usageRecord.groupBy({
      by: ['sessionId', 'modelName'],
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
    });

    const sessionIds = [...new Set(groups.filter(g => g.sessionId !== null).map(g => g.sessionId as number))];
    const sessions = sessionIds.length > 0
      ? await this.prisma.session.findMany({ where: { id: { in: sessionIds } } })
      : [];
    const sessionMap = new Map(sessions.map(s => [s.id, s.title]));

    return groups
      .filter(g => g.sessionId !== null)
      .map(g => ({
        sessionId: g.sessionId!,
        sessionTitle: sessionMap.get(g.sessionId!) ?? `Session #${g.sessionId}`,
        modelName: g.modelName,
        promptTokens: g._sum.promptTokens ?? 0,
        completionTokens: g._sum.completionTokens ?? 0,
        totalTokens: g._sum.totalTokens ?? 0,
      }));
  }
}
