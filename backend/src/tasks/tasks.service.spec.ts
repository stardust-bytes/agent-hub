import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksGateway } from './tasks.gateway';

const mockTask = {
  id: 1,
  title: 'Test',
  description: null,
  status: 'TODO',
  priority: 0,
  dueDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  task: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockGateway = {
  emitCreated: jest.fn(),
  emitUpdated: jest.fn(),
  emitDeleted: jest.fn(),
};

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TasksGateway, useValue: mockGateway },
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

  it('create calls gateway.emitCreated with created task', async () => {
    mockPrisma.task.create.mockResolvedValue(mockTask);
    await service.create({ title: 'Test' });
    expect(mockGateway.emitCreated).toHaveBeenCalledWith(mockTask);
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

  it('update calls gateway.emitUpdated with updated task', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
    const updated = { ...mockTask, status: 'DONE' };
    mockPrisma.task.update.mockResolvedValue(updated);
    await service.update(1, { status: 'DONE' });
    expect(mockGateway.emitUpdated).toHaveBeenCalledWith(updated);
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

  it('remove calls gateway.emitDeleted with task id', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
    mockPrisma.task.delete.mockResolvedValue(mockTask);
    await service.remove(1);
    expect(mockGateway.emitDeleted).toHaveBeenCalledWith(1);
  });

  it('findOne returns task when found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(mockTask);
    const result = await service.findOne(1);
    expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual(mockTask);
  });

  it('findOne throws NotFoundException when task not found', async () => {
    mockPrisma.task.findUnique.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('removeMany deletes tasks by ids and returns count', async () => {
    mockPrisma.task.deleteMany.mockResolvedValue({ count: 2 });
    const result = await service.removeMany([1, 2]);
    expect(mockPrisma.task.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
    });
    expect(result).toBe(2);
  });

  it('removeMany returns 0 for empty array', async () => {
    mockPrisma.task.deleteMany.mockResolvedValue({ count: 0 });
    const result = await service.removeMany([]);
    expect(mockPrisma.task.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [] } },
    });
    expect(result).toBe(0);
  });
});
