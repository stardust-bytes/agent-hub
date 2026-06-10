import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(sessionId: number, title: string, steps: string[]) {
    return this.prisma.plan.create({
      data: {
        sessionId,
        title,
        steps: {
          create: steps.map((text, i) => ({ order: i, text })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async findOne(id: number) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  async findBySession(sessionId: number) {
    return this.prisma.plan.findMany({
      where: { sessionId },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: number) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    if (plan.status !== 'PENDING') {
      throw new BadRequestException(`Plan ${id} is not in PENDING status`);
    }
    return this.prisma.plan.update({ where: { id }, data: { status: 'APPROVED' } });
  }

  async reject(id: number) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return this.prisma.plan.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async updateStepStatus(stepId: number, status: string) {
    return this.prisma.planStep.update({ where: { id: stepId }, data: { status } });
  }

  async updateStatus(id: number, status: string) {
    return this.prisma.plan.update({ where: { id }, data: { status } });
  }

  async setInterrupted(id: number) {
    return this.prisma.plan.update({ where: { id }, data: { status: 'INTERRUPTED' } });
  }

  async findNextActionable(sessionId: number) {
    const plan = await this.prisma.plan.findFirst({
      where: { sessionId },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!plan) return { found: false as const };
    if (plan.status === 'DONE') return { found: false as const };
    if (plan.status === 'PENDING') return { found: true as const, plan, action: 'approve' as const };
    const incompleteSteps = plan.steps.filter(s => s.status !== 'DONE');
    if (incompleteSteps.length === 0) return { found: false as const };
    return { found: true as const, plan, action: 'resume' as const };
  }
}
