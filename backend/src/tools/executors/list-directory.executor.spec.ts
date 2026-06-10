import { ListDirectoryExecutor } from './list-directory.executor';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('ListDirectoryExecutor', () => {
  let executor: ListDirectoryExecutor;
  let tmpDir: string;

  beforeEach(async () => {
    executor = new ListDirectoryExecutor();
    tmpDir = path.join(os.tmpdir(), `list-dir-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'a.txt'), 'a', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'b.txt'), 'bb', 'utf-8');
    await fs.mkdir(path.join(tmpDir, 'sub'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('lists files and directories', async () => {
    const result = await executor.execute({ path: tmpDir });
    expect(result).toContain('a.txt');
    expect(result).toContain('b.txt');
    expect(result).toContain('sub');
  });

  it('returns error for non-existent directory', async () => {
    const result = await executor.execute({ path: '/nonexistent/path' });
    expect(result).toMatch(/Error/);
  });

  it('rejects path outside allowed directories', async () => {
    const result = await executor.execute({ path: '/etc' });
    expect(result).toMatch(/Error/);
  });
});
