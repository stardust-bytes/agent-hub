import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

const mockService = {
  findAll: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: 1, title: 'Test' }),
  update: jest.fn().mockResolvedValue({ id: 1, title: 'Updated' }),
  remove: jest.fn().mockResolvedValue({ id: 1 }),
};

describe('TasksController', () => {
  let controller: TasksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: mockService }],
    }).compile();
    controller = module.get<TasksController>(TasksController);
    jest.clearAllMocks();
  });

  it('findAll delegates to service', async () => {
    mockService.findAll.mockResolvedValue([{ id: 1 }]);
    const result = await controller.findAll();
    expect(result).toEqual([{ id: 1 }]);
  });

  it('create delegates to service with dto', async () => {
    const dto = { title: 'New' };
    await controller.create(dto as any);
    expect(mockService.create).toHaveBeenCalledWith(dto);
  });

  it('update delegates with id and dto', async () => {
    const dto = { title: 'Updated' };
    await controller.update(1, dto as any);
    expect(mockService.update).toHaveBeenCalledWith(1, dto);
  });

  it('remove delegates with id', async () => {
    await controller.remove(1);
    expect(mockService.remove).toHaveBeenCalledWith(1);
  });
});
