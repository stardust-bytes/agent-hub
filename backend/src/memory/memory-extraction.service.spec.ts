import { Test, TestingModule } from '@nestjs/testing';
import { MemoryExtractionService } from './memory-extraction.service';
import { MemoryService } from './memory.service';
import { PrismaService } from '../prisma/prisma.service';

const mockMemoryService = {
  create: jest.fn(),
};

const mockPrisma = {
  session: {
    findUnique: jest.fn(),
  },
  memory: {
    findFirst: jest.fn(),
  },
};

describe('MemoryExtractionService', () => {
  let service: MemoryExtractionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryExtractionService,
        { provide: MemoryService, useValue: mockMemoryService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MemoryExtractionService>(MemoryExtractionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should skip extraction when no messages exist', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ id: 1, messages: [] });
    await service.extract({ sessionId: 1, providerType: 'ollama', model: 'test', providerConfig: { baseUrl: 'http://localhost:11434' } });
    expect(mockMemoryService.create).not.toHaveBeenCalled();
  });

  describe('classifyMemories', () => {
    it('should extract USER memory from "I am" statements', () => {
      const result = (service as any).classifyMemories('I am a software developer working on backend systems.');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('USER');
      expect(result[0].content).toContain('I am a software developer');
    });

    it('should extract USER memory from "my role" statements', () => {
      const result = (service as any).classifyMemories('my role is to design APIs and manage the team.');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('USER');
    });

    it('should extract FEEDBACK memory from "prefer" statements', () => {
      const result = (service as any).classifyMemories('I prefer using TypeScript over JavaScript for type safety.');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('FEEDBACK');
    });

    it('should extract FEEDBACK memory from "lesson learned" statements', () => {
      const result = (service as any).classifyMemories('lesson learned: always validate input before processing.');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('FEEDBACK');
      expect(result[0].title).toBe('Lesson');
    });

    it('should extract PROJECT memory from deadline statements', () => {
      const result = (service as any).classifyMemories('deadline for the release is next Friday.');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('PROJECT');
      expect(result[0].title).toBe('Deadline');
    });

    it('should extract REFERENCE memory from ticket references', () => {
      const result = (service as any).classifyMemories('This bug is tracked in ticket #456 on Linear.');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('REFERENCE');
    });

    it('should NOT extract short meaningless text', () => {
      const result = (service as any).classifyMemories('I am hi');
      expect(result).toHaveLength(0);
    });

    it('should NOT extract questions', () => {
      const result = (service as any).classifyMemories('what is the deadline for this project?');
      expect(result).toHaveLength(0);
    });

    it('should NOT extract negative statements with "don\'t"', () => {
      const result = (service as any).classifyMemories("I don't prefer that approach at all.");
      expect(result).toHaveLength(0);
    });

    it('should NOT extract greetings', () => {
      const result = (service as any).classifyMemories('thanks for your help with this');
      expect(result).toHaveLength(0);
    });

    it('should extract multiple memory types from compound content', () => {
      const content = [
        'I am a frontend developer.',
        'I prefer using Vue 3 for new projects.',
        'deadline for the landing page is end of month.',
      ].join(' ');

      const result = (service as any).classifyMemories(content);
      expect(result.length).toBeGreaterThanOrEqual(3);
      const types = result.map(r => r.type);
      expect(types).toContain('USER');
      expect(types).toContain('FEEDBACK');
      expect(types).toContain('PROJECT');
    });

    it('should not extract old broad patterns like "never", "always", "remember" standalone', () => {
      const content = 'never do that again. always use the right tool. remember to commit.';
      const result = (service as any).classifyMemories(content);
      expect(result).toHaveLength(0);
    });

    it('should not extract common words "project", "version", "release" without qualifiers', () => {
      const content = 'this project is about the new version of the release.';
      const result = (service as any).classifyMemories(content);
      expect(result).toHaveLength(0);
    });
  });
});
