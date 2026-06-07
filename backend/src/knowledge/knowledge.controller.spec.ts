import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

describe('KnowledgeController', () => {
  let controller: KnowledgeController;
  const mockService = {
    findAll: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeController],
      providers: [{ provide: KnowledgeService, useValue: mockService }],
    }).compile();
    controller = module.get<KnowledgeController>(KnowledgeController);
    jest.clearAllMocks();
  });

  it('getAll returns files from service', async () => {
    const files = [{ id: 1, filename: 'test.md' }];
    mockService.findAll.mockResolvedValue(files);
    const result = await controller.getAll();
    expect(result).toEqual(files);
  });

  it('deleteFile calls service.remove and returns ok', async () => {
    mockService.remove.mockResolvedValue({ id: 1 });
    const result = await controller.deleteFile('1');
    expect(mockService.remove).toHaveBeenCalledWith(1);
    expect(result).toEqual({ ok: true });
  });
});
