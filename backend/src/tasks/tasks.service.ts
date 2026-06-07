import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateTaskDto) {
    return this.prisma.task.create({ data: dto });
  }

  async update(id: number, dto: UpdateTaskDto) {
    await this.findOneOrFail(id);
    return this.prisma.task.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOneOrFail(id);
    return this.prisma.task.delete({ where: { id } });
  }

  private async findOneOrFail(id: number) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }
}
