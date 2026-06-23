import { Test, TestingModule } from '@nestjs/testing';
import { ListDirectoryExecutor } from './list-directory.executor';
import { WorkspaceService } from '../../workspace/workspace.service';

describe('ListDirectoryExecutor', () => {
  let executor: ListDirectoryExecutor;
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
    listDirectory: jest.fn().mockResolvedValue('- file1.txt\n- file2.ts\nd subdir'),
    getAllowedPaths: jest.fn().mockReturnValue(['/allowed']),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListDirectoryExecutor,
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    executor = module.get<ListDirectoryExecutor>(ListDirectoryExecutor);
  });

  it('list_directory lists entries', async () => {
    const result = await executor.execute({ path: '.' });
    expect(mockWorkspace.listDirectory).toHaveBeenCalledWith('.');
    expect(result).toContain('file1.txt');
  });

  it('list_directory returns error when path not allowed', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute({ path: '/etc' });
    expect(result).toContain('not allowed');
  });
});
