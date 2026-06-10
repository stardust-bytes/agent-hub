import { Test, TestingModule } from '@nestjs/testing';
import { GlobExecutor } from './glob.executor';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs';
import * as path from 'path';

const tmpDir = fs.mkdtempSync('glob-test-');
fs.writeFileSync(path.join(tmpDir, 'test.ts'), '');
fs.writeFileSync(path.join(tmpDir, 'test.js'), '');
fs.mkdirSync(path.join(tmpDir, 'sub'));
fs.writeFileSync(path.join(tmpDir, 'sub', 'deep.ts'), '');

describe('GlobExecutor', () => {
  let executor: GlobExecutor;
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWorkspace.isPathAllowed.mockReturnValue(true);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobExecutor,
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    executor = module.get<GlobExecutor>(GlobExecutor);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('glob finds files matching pattern', async () => {
    const result = await executor.execute({ pattern: '**/*.ts', path: tmpDir });
    expect(result).toContain('test.ts');
    expect(result).toContain('deep.ts');
    expect(result).not.toContain('test.js');
  });

  it('glob returns error when path not allowed', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute({ pattern: '*', path: '/etc' });
    expect(result).toContain('not allowed');
  });

  it('glob returns no matches when nothing found', async () => {
    const result = await executor.execute({ pattern: '**/*.xyz', path: tmpDir });
    expect(result).toBe('No files found.');
  });
});
