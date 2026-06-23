import { Test, TestingModule } from '@nestjs/testing';
import { ReadFileExecutor } from './read-file.executor';
import { WorkspaceService } from '../../workspace/workspace.service';

describe('ReadFileExecutor', () => {
  let executor: ReadFileExecutor;
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
    readFile: jest.fn().mockResolvedValue('file content'),
    getAllowedPaths: jest.fn().mockReturnValue(['/allowed']),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadFileExecutor,
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    executor = module.get<ReadFileExecutor>(ReadFileExecutor);
  });

  it('read_file reads file content', async () => {
    const result = await executor.execute({ path: 'test.txt' });
    expect(mockWorkspace.readFile).toHaveBeenCalledWith('test.txt');
    expect(result).toBe('file content');
  });

  it('read_file returns error when path not allowed', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute({ path: '/etc/passwd' });
    expect(result).toContain('not allowed');
  });
});
