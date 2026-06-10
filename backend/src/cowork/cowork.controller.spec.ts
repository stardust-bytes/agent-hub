import { Test, TestingModule } from '@nestjs/testing';
import { CoworkController } from './cowork.controller';
import { CoworkService } from './cowork.service';

describe('CoworkController', () => {
  let controller: CoworkController;
  const mockService = {
    setProject: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockResolvedValue({ projectPath: '/test', isActive: true }),
    clearProject: jest.fn().mockResolvedValue(undefined),
    getDrives: jest.fn().mockResolvedValue(['C:\\', 'D:\\']),
    browseDirectory: jest.fn().mockResolvedValue({ path: '/test', entries: [{ name: 'subdir', isDirectory: true }] }),
    readFile: jest.fn().mockResolvedValue({ content: 'hi', filename: 'test.ts', size: 2 }),
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

  it('getDrives returns drives from service', async () => {
    const result = await controller.getDrives();
    expect(mockService.getDrives).toHaveBeenCalled();
    expect(result).toEqual(['C:\\', 'D:\\']);
  });

it('browse delegates to service.browseDirectory', async () => {
  const result = await controller.browse('/test');
  expect(mockService.browseDirectory).toHaveBeenCalledWith('/test');
  expect(result.entries[0].name).toBe('subdir');
});

it('browse throws when path is missing', async () => {
  await expect(controller.browse('')).rejects.toThrow('path query parameter is required');
});

it('readFile delegates to service and returns file content', async () => {
  mockService.getStatus.mockResolvedValue({ projectPath: '/project', isActive: true });
  mockService.readFile.mockResolvedValue({ content: 'hi', filename: 'test.ts', size: 2 });

  const result = await controller.readFile('/project/test.ts');
  expect(mockService.getStatus).toHaveBeenCalled();
  expect(mockService.readFile).toHaveBeenCalledWith('/project/test.ts', '/project');
  expect(result).toEqual({ content: 'hi', filename: 'test.ts', size: 2 });
});

it('readFile throws when no project connected', async () => {
  mockService.getStatus.mockResolvedValue({ projectPath: null, isActive: false });
  await expect(controller.readFile('/project/test.ts')).rejects.toThrow('No project connected');
});
});
