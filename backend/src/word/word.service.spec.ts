import { Test, TestingModule } from '@nestjs/testing';
import { WordService } from './word.service';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('WordService', () => {
  let service: WordService;
  let testDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WordService],
    }).compile();

    service = module.get<WordService>(WordService);
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('write', () => {
    it('should create a .docx file from markdown content', async () => {
      const filePath = path.join(testDir, 'test.docx');
      const content = '# Hello\nThis is a paragraph.\n\n## Section 2\n- item 1\n- item 2';
      const result = await service.write(filePath, content);
      expect(result).toContain('Created');
      expect(fs.existsSync(filePath)).toBe(true);
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('read', () => {
    it('should read a .docx file and return structured content', async () => {
      const filePath = path.join(testDir, 'test.docx');
      await service.write(filePath, '# Title\nHello world');

      const result = await service.read(filePath);
      expect(result.content).toBeTruthy();
      expect(result.tables).toBeDefined();
      expect(Array.isArray(result.tables)).toBe(true);
    });

    it('should throw error for non-existent file', async () => {
      await expect(service.read('/nonexistent.docx')).rejects.toThrow();
    });
  });

  describe('edit', () => {
    it('should append content to existing document', async () => {
      const filePath = path.join(testDir, 'test.docx');
      await service.write(filePath, '# Original');

      const result = await service.edit(filePath, [
        { type: 'append', content: 'Appended text' },
      ]);
      expect(result).toContain('Updated');
    });

    it('should replace text in existing document', async () => {
      const filePath = path.join(testDir, 'test.docx');
      await service.write(filePath, '# Hello\nOld text here');

      const result = await service.edit(filePath, [
        { type: 'replace', target: 'Old text', replacement: 'New text' },
      ]);
      expect(result).toContain('Updated');
    });
  });
});
