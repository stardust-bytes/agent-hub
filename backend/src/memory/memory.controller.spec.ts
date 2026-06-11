import { Test, TestingModule } from '@nestjs/testing';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';

const mockService = {
  findAll: jest.fn(),
  getContextMemories: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('MemoryController', () => {
  let controller: MemoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MemoryController],
      providers: [{ provide: MemoryService, useValue: mockService }],
    }).compile();

    controller = module.get<MemoryController>(MemoryController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /memories should call findAll', async () => {
    mockService.findAll.mockResolvedValue([]);
    const result = await controller.findAll({});
    expect(result).toEqual([]);
    expect(mockService.findAll).toHaveBeenCalledWith({});
  });

  it('GET /memories/context should call getContextMemories', async () => {
    mockService.getContextMemories.mockResolvedValue('## Persistent Memory');
    const result = await controller.getContext();
    expect(result).toBe('## Persistent Memory');
  });

  it('POST /memories should call create', async () => {
    const dto = { type: 'USER' as const, title: 'Test', content: 'Hello' };
    mockService.create.mockResolvedValue({ id: '1', ...dto });
    const result = await controller.create(dto);
    expect(result).toHaveProperty('id');
    expect(mockService.create).toHaveBeenCalledWith(dto);
  });
});
