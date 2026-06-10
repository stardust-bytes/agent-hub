import { RunCommandExecutor } from './run-command.executor';
import * as path from 'path';
import * as os from 'os';

describe('RunCommandExecutor', () => {
  let executor: RunCommandExecutor;

  beforeEach(() => {
    executor = new RunCommandExecutor();
  });

  it('executes a command and returns stdout', async () => {
    const result = await executor.execute({ command: 'echo hello' });
    expect(result).toContain('hello');
  });

  it('returns error for empty command', async () => {
    const result = await executor.execute({ command: '' });
    expect(result).toMatch(/Error/);
  });
});
