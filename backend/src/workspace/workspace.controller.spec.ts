import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { IndexerService } from './indexer.service';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
  const mockWatcher = {
    startWatch: jest.fn().mockResolvedValue(undefined),
    stopWatch: jest.fn().mockResolvedValue(undefined),
    getStatus: jest.fn().mockReturnValue({ watching: false, directory: '', indexedCount: 0 }),
  };
  const mockIndexer = {
    getStatus: jest.fn().mockReturnValue({ pending: 0, processing: 0, done: 0, errors: 0 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceController],
      providers: [
        { provide: WorkspaceWatcherService, useValue: mockWatcher },
        { provide: IndexerService, useValue: mockIndexer },
      ],
    }).compile();
    controller = module.get<WorkspaceController>(WorkspaceController);
  });

  it('watch starts the watcher', async () => {
    const result = await controller.watch({ directory: '/test/dir' });
    expect(mockWatcher.startWatch).toHaveBeenCalledWith('/test/dir');
    expect(result).toEqual({ ok: true, directory: '/test/dir' });
  });

  it('getStatus returns watcher state', () => {
    const result = controller.getStatus();
    expect(mockWatcher.getStatus).toHaveBeenCalled();
    expect(result).toHaveProperty('watching');
  });

  it('stopWatch stops the watcher', async () => {
    const result = await controller.stopWatch();
    expect(mockWatcher.stopWatch).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('getIndexerStatus returns indexer state', () => {
    const result = controller.getIndexerStatus();
    expect(mockIndexer.getStatus).toHaveBeenCalled();
    expect(result).toHaveProperty('pending');
    expect(result).toHaveProperty('done');
  });
});
