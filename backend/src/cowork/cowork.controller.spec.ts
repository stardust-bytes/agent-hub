import { Test, TestingModule } from '@nestjs/testing';
import { CoworkController } from './cowork.controller';
import { CoworkService } from './cowork.service';

describe('CoworkController', () => {
  let controller: CoworkController;
  const mockService = {
    setProject: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockResolvedValue({ projectPath: '/test', isActive: true }),
    clearProject: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoworkController],
      providers: [{ provide: CoworkService, useValue: mockService }],
    }).compile();
    controller = module.get<CoworkController>(CoworkController);
  });

  it('setProject calls service.setProject', async () => {
    const result = await controller.setProject({ path: '/my/project' });
    expect(mockService.setProject).toHaveBeenCalledWith('/my/project');
    expect(result).toEqual({ ok: true });
  });

  it('getProject returns status from service', async () => {
    const result = await controller.getProject();
    expect(mockService.getStatus).toHaveBeenCalled();
    expect(result.projectPath).toBe('/test');
  });

  it('clearProject calls service.clearProject', async () => {
    const result = await controller.clearProject();
    expect(mockService.clearProject).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});
