import { Test, TestingModule } from '@nestjs/testing';
import { WriteWordExecutor } from './write-word.executor';
import { WordService } from '../word.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WriteWordExecutor', () => {
  let executor: WriteWordExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WriteWordExecutor,
        {
          provide: WordService,
          useValue: {
            write: jest.fn().mockResolvedValue('Created /tmp/test.docx'),
          },
        },
        {
          provide: WorkspaceService,
          useValue: {
            getWorkspaceRoot: jest.fn().mockReturnValue('/mock/workspace'),
            isPathAllowed: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            agentFile: {
              create: jest.fn().mockResolvedValue({ id: 1 }),
            },
          },
        },
      ],
    }).compile();

    executor = module.get<WriteWordExecutor>(WriteWordExecutor);
  });

  it('should write .docx file', async () => {
    const result = await executor.execute({
      path: 'test.docx',
      content: '# Hello\nWorld',
    }, { mode: 'chat', sessionId: 0 });
    expect(result).toContain('Created');
  });

  it('should return error for missing content', async () => {
    const result = await executor.execute({ path: 'test.docx' });
    expect(result).toContain('Error');
  });

  it('should route to agent-output in agent mode', async () => {
    const result = await executor.execute({
      path: 'report.docx',
      content: '# Report',
    }, { mode: 'agent', sessionId: 5 });
    expect(result).toContain('Download');
  });
});
