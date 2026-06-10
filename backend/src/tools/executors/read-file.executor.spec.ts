import { ReadFileExecutor } from './read-file.executor';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('ReadFileExecutor', () => {
  let executor: ReadFileExecutor
  let tmpDir: string

  beforeEach(async () => {
    executor = new ReadFileExecutor()
    tmpDir = path.join(os.tmpdir(), `read-file-test-${Date.now()}`)
    await fs.mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('reads existing file content', async () => {
    const filePath = path.join(tmpDir, 'test.txt')
    await fs.writeFile(filePath, 'hello world', 'utf-8')
    const result = await executor.execute({ path: filePath })
    expect(result).toBe('hello world')
  })

  it('returns error for non-existent file', async () => {
    const result = await executor.execute({ path: path.join(tmpDir, 'nope.txt') })
    expect(result).toMatch(/Error/)
  })

  it('rejects path outside allowed directories', async () => {
    const result = await executor.execute({ path: '/etc/passwd' })
    expect(result).toMatch(/Error/)
  })
})
