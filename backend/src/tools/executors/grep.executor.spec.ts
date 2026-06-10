import { Test, TestingModule } from '@nestjs/testing';
import { GrepExecutor } from './grep.executor';
import { WorkspaceService } from '../../workspace/workspace.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grep-test-'));
const testFile = path.join(tmpDir, 'test.txt');
fs.writeFileSync(testFile, 'hello world\nfoo bar\nhello again');

describe('GrepExecutor', () => {
  let executor: GrepExecutor;
  const mockWorkspace = {
    isPathAllowed: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWorkspace.isPathAllowed.mockReturnValue(true);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrepExecutor,
        { provide: WorkspaceService, useValue: mockWorkspace },
      ],
    }).compile();
    executor = module.get<GrepExecutor>(GrepExecutor);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('grep returns matching lines', async () => {
    const result = await executor.execute({ pattern: 'hello', path: tmpDir });
    expect(result).toContain('hello world');
    expect(result).toContain('hello again');
    expect(result).not.toContain('foo bar');
  });

  it('grep returns error when path not allowed', async () => {
    mockWorkspace.isPathAllowed.mockReturnValue(false);
    const result = await executor.execute({ pattern: 'test', path: '/etc' });
    expect(result).toContain('not allowed');
  });

  it('grep returns no matches message when no results', async () => {
    const result = await executor.execute({ pattern: 'nonexistent', path: tmpDir });
    expect(result).toBe('No matches found.');
  });
});
