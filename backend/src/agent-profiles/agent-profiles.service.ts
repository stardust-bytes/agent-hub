import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgentProfileDto } from './dto/create-agent-profile.dto';
import { UpdateAgentProfileDto } from './dto/update-agent-profile.dto';

@Injectable()
export class AgentProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.agentProfile.findMany({ orderBy: { name: 'asc' } });
  }

  findEnabled() {
    return this.prisma.agentProfile.findMany({ where: { enabled: true }, orderBy: { name: 'asc' } });
  }

  findBySlug(slug: string) {
    return this.prisma.agentProfile.findUnique({ where: { slug } });
  }

  create(dto: CreateAgentProfileDto) {
    return this.prisma.agentProfile.create({ data: { ...dto, builtin: false } });
  }

  async update(id: number, dto: UpdateAgentProfileDto) {
    return this.prisma.agentProfile.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    const existing = await this.prisma.agentProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('profile_not_found');
    if (existing.builtin) throw new BadRequestException('profile_builtin_readonly');
    return this.prisma.agentProfile.delete({ where: { id } });
  }
}
