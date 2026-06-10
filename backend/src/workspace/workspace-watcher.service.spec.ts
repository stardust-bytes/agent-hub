import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceWatcherService } from './workspace-watcher.service';
import { WorkspaceService } from './workspace.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import * as path from 'path';

jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  close: jest.fn().mockResolvedValue(undefined),
}));

const mockChokidar = require('chokidar');

describe('WorkspaceWatcherService', () => {
  let service: WorkspaceWatcherService;
  const mockWorkspace = {
    getWorkspaceRoot: jest.fn().mockReturnValue('/fake/workspace'),
    isPathAllowed: jest.fn().mockReturnValue(true),
  };
  const mockKnowledge = {
    findAll: jest.fn().mockResolvedValue([]),
    createWithPath: jest.fn(),
    processFile: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceWatcherService,
        { provide: WorkspaceService, useValue: mockWorkspace },
        { provide: KnowledgeService, useValue: mockKnowledge },
      ],
    }).compile();
    service = module.get<WorkspaceWatcherService>(WorkspaceWatcherService);
  });

  it('startWatch sets watching to true', async () => {
    await service.startWatch();
    expect(mockChokidar.watch).toHaveBeenCalled();
    const status = service.getStatus();
    expect(status.watching).toBe(true);
    expect(status.directory).toBe('/fake/workspace');
  });

  it('startWatch uses provided directory if given', async () => {
    await service.startWatch('/fake/workspace/subdir');
    expect(mockChokidar.watch).toHaveBeenCalled();
    expect(service.getStatus().directory).toBe(path.resolve('/fake/workspace/subdir'));
  });

  it('stopWatch sets watching to false', async () => {
    await service.startWatch();
    await service.stopWatch();
    expect(service.getStatus().watching).toBe(false);
    expect(mockChokidar.close).toHaveBeenCalled();
  });

  it('getStatus returns correct state when not watching', () => {
    const status = service.getStatus();
    expect(status.watching).toBe(false);
    expect(status.directory).toBe('');
    expect(status.indexedCount).toBe(0);
  });
});
