import { Test, TestingModule } from '@nestjs/testing';
import { WriteFileExecutor } from './write-file.executor';
import { WorkspaceService } from '../../workspace/workspace.service';

describe('WriteFileExecutor', () => {
  let executor: WriteFileExecutor;
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
    writeFile: jest.fn().mockResolvedValue({ bytesWritten: 5, resolved: '/workspace/test.txt' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WriteFileExecutor,
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    executor = module.get<WriteFileExecutor>(WriteFileExecutor);
  });

  it('write_file writes content and returns byte count', async () => {
    const result = await executor.execute({ path: 'test.txt', content: 'hello' });
    expect(mockWorkspace.writeFile).toHaveBeenCalledWith('test.txt', 'hello');
    expect(result).toBe('Written 5 bytes to /workspace/test.txt');
  });

  it('write_file returns error when path not allowed', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute({ path: '/etc/passwd', content: 'x' });
    expect(result).toBe('Error: path "/etc/passwd" is not allowed.');
  });
});
