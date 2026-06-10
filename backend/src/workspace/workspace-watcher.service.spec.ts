import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { WorkspaceService } from './workspace.service';
import { IndexerService } from './indexer.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import * as path from 'path';

jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  close: jest.fn().mockResolvedValue(undefined),
}));

const mockChokidar = jest.requireMock('chokidar');

describe('WorkspaceWatcherService', () => {
  let service: WorkspaceWatcherService;
  const mockWorkspace = {
    getWorkspaceRoot: jest.fn().mockReturnValue('/fake/workspace'),
    isPathAllowed: jest.fn().mockReturnValue(true),
  };
  const mockIndexer = {
    enqueue: jest.fn(),
    getStatus: jest.fn().mockReturnValue({ pending: 0, processing: 0, done: 5, errors: 0 }),
  };
  const mockKnowledge = {
    findByFilepath: jest.fn().mockResolvedValue(null),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceWatcherService,
        { provide: WorkspaceService, useValue: mockWorkspace },
        { provide: IndexerService, useValue: mockIndexer },
        { provide: KnowledgeService, useValue: mockKnowledge },
      ],
    }).compile();
    service = module.get<WorkspaceWatcherService>(WorkspaceWatcherService);
  });

  it('startWatch sets watching to true', async () => {
    await service.startWatch();
    expect(service.getStatus().watching).toBe(true);
  });

  it('startWatch uses provided directory if given', async () => {
    await service.startWatch('/fake/workspace/subdir');
    expect(service.getStatus().directory).toBe(path.resolve('/fake/workspace/subdir'));
  });

  it('stopWatch sets watching to false', async () => {
    await service.startWatch();
    await service.stopWatch();
    expect(service.getStatus().watching).toBe(false);
    expect(mockChokidar.close).toHaveBeenCalled();
  });

  it('getStatus returns state from indexer', () => {
    const status = service.getStatus();
    expect(status.indexedCount).toBe(5);
    expect(status.watching).toBe(false);
  });

  it('delegates file changes to indexer.enqueue', async () => {
    await service.startWatch();
    const addHandler = mockChokidar.on.mock.calls.find(c => c[0] === 'add')?.[1];
    if (addHandler) addHandler('/fake/workspace/test.ts');
    expect(mockIndexer.enqueue).toHaveBeenCalledWith('/fake/workspace/test.ts');
  });
});
