import { Test, TestingModule } from '@nestjs/testing';
import { ReadWordExecutor } from './read-word.executor';
import { WordService } from '../word.service';
import { WorkspaceService } from '../../workspace/workspace.service';

describe('ReadWordExecutor', () => {
  let executor: ReadWordExecutor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadWordExecutor,
        {
          provide: WordService,
          useValue: {
            read: jest.fn().mockResolvedValue({
              content: 'test content',
              tables: ['| h1 | h2 |\n| --- | --- |\n| a | b |'],
              metadata: { headingCount: 1, paragraphCount: 2 },
            }),
          },
        },
        {
          provide: WorkspaceService,
          useValue: {
            isPathAllowed: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    executor = module.get<ReadWordExecutor>(ReadWordExecutor);
  });

  it('should return structured content from .docx', async () => {
    const result = await executor.execute({ path: '/test/doc.docx' });
    expect(result).toContain('test content');
    expect(result).toContain('| h1 | h2 |');
  });

  it('should return error for missing path', async () => {
    const result = await executor.execute({});
    expect(result).toContain('Error');
  });
});
