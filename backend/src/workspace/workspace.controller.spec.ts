import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceWatcherService } from './workspace-watcher.service';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
  const mockWatcher = {
    startWatch: jest.fn().mockResolvedValue(undefined),
    stopWatch: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockReturnValue({ watching: false, directory: '', indexedCount: 0 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceController],
      providers: [{ provide: WorkspaceWatcherService, useValue: mockWatcher }],
    }).compile();
    controller = module.get<WorkspaceController>(WorkspaceController);
  });

  it('watch starts the watcher', async () => {
    const result = await controller.watch({ directory: '/test/dir' });
    expect(mockWatcher.startWatch).toHaveBeenCalledWith('/test/dir');
    expect(result).toEqual({ ok: true, directory: '/test/dir' });
  });

  it('watch uses default directory when not provided', async () => {
    const result = await controller.watch({});
    expect(mockWatcher.startWatch).toHaveBeenCalledWith(undefined);
    expect(result.ok).toBe(true);
  });

  it('getStatus returns watcher state', () => {
    const result = controller.getStatus();
    expect(mockWatcher.getStatus).toHaveBeenCalled();
    expect(result).toHaveProperty('watching');
    expect(result).toHaveProperty('directory');
    expect(result).toHaveProperty('indexedCount');
  });

  it('stopWatch stops the watcher', async () => {
    const result = await controller.stopWatch();
    expect(mockWatcher.stopWatch).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});
