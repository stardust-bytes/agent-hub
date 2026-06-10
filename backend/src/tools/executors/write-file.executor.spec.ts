import { WriteFileExecutor } from './write-file.executor';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('WriteFileExecutor', () => {
  let executor: WriteFileExecutor
  let tmpDir: string

  beforeEach(async () => {
    executor = new WriteFileExecutor()
    tmpDir = path.join(os.tmpdir(), `write-file-test-${Date.now()}`)
    await fs.mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('writes content to a file', async () => {
    const filePath = path.join(tmpDir, 'test.txt')
    const result = await executor.execute({ path: filePath, content: 'hello world' })
    expect(result).toMatch(/Written/)
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toBe('hello world')
  })

  it('creates parent directories', async () => {
    const filePath = path.join(tmpDir, 'sub', 'nested', 'test.txt')
    const result = await executor.execute({ path: filePath, content: 'nested' })
    expect(result).toMatch(/Written/)
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toBe('nested')
  })

  it('rejects path outside allowed directories', async () => {
    const result = await executor.execute({ path: '/etc/passwd', content: 'hack' })
    expect(result).toMatch(/Error/)
  })

  it('returns error for missing args', async () => {
    const result = await executor.execute({} as Record<string, unknown>)
    expect(result).toMatch(/Error/)
  })
})
