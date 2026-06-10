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
    expect(mockWorkspace.writeFile).toHaveBeenCalledWith('test.txt', 'hello');
    expect(mockPrisma.agentFile.create).toHaveBeenCalledWith({
      data: { filename: 'test.txt', path: '/workspace/test.txt', sessionId: 0 },
    });
    expect(result).toBe('Written 5 bytes. [Download "test.txt"](api/files/agent/1/download)');
  });

  it('write_file returns error when path not allowed', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute({ path: '/etc/passwd', content: 'x' });
    expect(result).toBe('Error: path "/etc/passwd" is not allowed.');
  });

  it('should sandbox path in agent mode to session folder', async () => {
    const result = await executor.execute(
      { path: '../../evil/payload.js', content: 'test' },
      { mode: 'agent', sessionId: 5 },
    );
    expect(mockWorkspace.isPathAllowed).not.toHaveBeenCalled();
    expect(mockWorkspace.writeFile).toHaveBeenCalled();
    const callPath = (mockWorkspace.writeFile as jest.Mock).mock.calls[0][0];
    expect(callPath).toContain('agent-output');
    expect(callPath).toContain('session_5');
    expect(callPath).toContain('payload.js');
  });

  it('should default to output.txt when path is empty in agent mode', async () => {
    const result = await executor.execute(
      { content: 'test' },
      { mode: 'agent', sessionId: 1 },
    );
    const callPath = (mockWorkspace.writeFile as jest.Mock).mock.calls[0][0];
    expect(callPath).toContain('output.txt');
  });

  it('should still check isPathAllowed in non-agent mode', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(true);
    const result = await executor.execute(
      { path: 'allowed/file.txt', content: 'test' },
      { mode: 'cowork', sessionId: 0 },
    );
    expect(mockWorkspace.isPathAllowed).toHaveBeenCalledWith('allowed/file.txt');
  });
});
