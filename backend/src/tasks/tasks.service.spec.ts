import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  task: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  it('findAll returns tasks ordered by createdAt desc', async () => {
    mockPrisma.task.findMany.mockResolvedValue([{ id: 1, title: 'Test' }]);
    const result = await service.findAll();
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    expect(result).toEqual([{ id: 1, title: 'Test' }]);
  });

  it('create persists a task', async () => {
    const dto = { title: 'New task' };
    mockPrisma.task.create.mockResolvedValue({ id: 1, title: 'New task', status: 'TODO' });
    const result = await service.create(dto);
    expect(mockPrisma.task.create).toHaveBeenCalledWith({ data: dto });
    expect(result).toMatchObject({ id: 1, title: 'New task' });
  });

  it('update throws NotFoundException when task not found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(null);
    await expect(service.update(999, { title: 'x' })).rejects.toThrow(NotFoundException);
    expect(mockPrisma.task.update).not.toHaveBeenCalled();
  });

  it('update patches task when found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: 1, title: 'Old' });
    mockPrisma.task.update.mockResolvedValue({ id: 1, title: 'New' });
    const result = await service.update(1, { title: 'New' });
    expect(mockPrisma.task.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { title: 'New' } });
    expect(result).toMatchObject({ title: 'New' });
  });

  it('remove throws NotFoundException when task not found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(null);
    await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    expect(mockPrisma.task.delete).not.toHaveBeenCalled();
  });

  it('remove deletes task when found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: 1 });
    mockPrisma.task.delete.mockResolvedValue({ id: 1 });
    await service.remove(1);
    expect(mockPrisma.task.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
