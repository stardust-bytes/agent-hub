import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksGateway } from './tasks.gateway';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: TasksGateway,
  ) {}

  findAll() {
    return this.prisma.task.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreateTaskDto) {
    const task = await this.prisma.task.create({ data: dto });
    this.gateway.emitCreated(task);
    return task;
  }

  async update(id: number, dto: UpdateTaskDto) {
    await this.findOneOrFail(id);
    const task = await this.prisma.task.update({ where: { id }, data: dto });
    this.gateway.emitUpdated(task);
    return task;
  }

  async remove(id: number) {
    await this.findOneOrFail(id);
    const task = await this.prisma.task.delete({ where: { id } });
    this.gateway.emitDeleted(task.id);
    return task;
  }

  async findOne(id: number) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async removeMany(ids: number[]) {
    if (ids.length === 0) return 0;
    const result = await this.prisma.task.deleteMany({
      where: { id: { in: ids } },
    });
    for (const id of ids) {
      this.gateway.emitDeleted(id);
    }
    return result.count;
  }

  private async findOneOrFail(id: number) {
    return this.findOne(id);
  }
}
