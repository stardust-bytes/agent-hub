import { Test, TestingModule } from '@nestjs/testing';
import { WriteFileExecutor } from './write-file.executor';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WriteFileExecutor', () => {
  let executor: WriteFileExecutor;
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
    writeFile: jest.fn().mockResolvedValue({ bytesWritten: 5, resolved: '/workspace/test.txt' }),
    getWorkspaceRoot: jest.fn().mockReturnValue('/workspace'),
    getAllowedPaths: jest.fn().mockReturnValue(['/workspace']),
  };
  const mockPrisma = {
    agentFile: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WriteFileExecutor,
        { provide: WorkspaceService, useValue: mockWorkspace },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    executor = module.get<WriteFileExecutor>(WriteFileExecutor);
  });

  it('write_file writes content and returns download URL for workspace files', async () => {
    const result = await executor.execute({ path: 'test.txt', content: 'hello' });
    expect(mockWorkspace.writeFile).toHaveBeenCalled();
    expect(mockPrisma.agentFile.create).toHaveBeenCalledWith({
      data: { filename: 'test.txt', path: '/workspace/test.txt', sessionId: 0 },
    });
    expect(result).toContain('Download');
  });

  it('write_file returns error when path not allowed with project context', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute(
      { path: 'unallowed.txt', content: 'x' },
      { sessionId: 0, projectPath: '/my-project' },
    );
    expect(result).toContain('not allowed');
  });

  it('should check isPathAllowed when projectPath is set', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(true);
    await executor.execute(
      { path: 'allowed/file.txt', content: 'test' },
      { sessionId: 0, projectPath: '/my-project' },
    );
    expect(mockWorkspace.isPathAllowed).toHaveBeenCalledWith(
      expect.stringContaining('my-project'),
    );
  });
});
