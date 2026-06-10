import { Test, TestingModule } from '@nestjs/testing';
import { IndexerService } from './indexer.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { WorkspaceService } from './workspace.service';

describe('IndexerService', () => {
  let service: IndexerService;
  const mockKnowledge = {
    findByFilepath: jest.fn().mockResolvedValue(null),
    createWithPath: jest.fn().mockResolvedValue({ id: 1 }),
    processFile: jest.fn().mockResolvedValue(undefined),
  };
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexerService,
        { provide: KnowledgeService, useValue: mockKnowledge },
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    service = module.get<IndexerService>(IndexerService);
  });

  it('enqueue adds file to pending queue', () => {
    service.enqueue('/test/file.ts');
    const status = service.getStatus();
    expect(status.pending).toBe(1);
    expect(status.processing).toBe(0);
  });

  it('enqueue deduplicates same file path', () => {
    service.enqueue('/test/file.ts');
    service.enqueue('/test/file.ts');
    const status = service.getStatus();
    expect(status.pending).toBe(1);
  });

  it('getStatus returns stats', () => {
    const status = service.getStatus();
    expect(status).toHaveProperty('pending');
    expect(status).toHaveProperty('processing');
    expect(status).toHaveProperty('done');
    expect(status).toHaveProperty('errors');
  });

  it('processes enqueued files', async () => {
    service.enqueue('/test/file.ts');
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mockKnowledge.processFile).toHaveBeenCalled();
  });

  it('respects max concurrency', () => {
    for (let i = 0; i < 10; i++) service.enqueue(`/test/file${i}.ts`);
    const status = service.getStatus();
    expect(status.pending).toBeGreaterThan(0);
  });
});
