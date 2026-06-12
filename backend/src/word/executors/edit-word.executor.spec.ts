import { Test, TestingModule } from '@nestjs/testing';
import { EditWordExecutor } from './edit-word.executor';
import { WordService } from '../word.service';
import { WorkspaceService } from '../../workspace/workspace.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('EditWordExecutor', () => {
  let executor: EditWordExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditWordExecutor,
        {
          provide: WordService,
          useValue: {
            edit: jest.fn().mockResolvedValue('Updated /tmp/test.docx with 1 operation(s)'),
          },
        },
        {
          provide: WorkspaceService,
          useValue: {
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

    executor = module.get<EditWordExecutor>(EditWordExecutor);
  });

  it('should edit .docx file', async () => {
    const result = await executor.execute({
      path: '/tmp/test.docx',
      operations: [{ type: 'append', content: 'new text' }],
    });
    expect(result).toContain('Updated');
  });

  it('should return error for missing operations', async () => {
    const result = await executor.execute({ path: '/tmp/test.docx' });
    expect(result).toContain('Error');
  });
});
