import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { exec } from 'child_process';
import { promisify } from 'util';

const asyncExec = promisify(exec);
const MAX_OUTPUT_SIZE = 10 * 1024;
const TIMEOUT_MS = 30_000;

@Injectable()
export class RunCommandExecutor implements ToolExecutor {
  readonly name = 'run_command';

  async execute(args: Record<string, unknown>): Promise<string> {
    let command = args.command as string | undefined;
    const cwd = (args.cwd as string) || process.cwd();
    if (!command || command.trim().length === 0) {
      command = args.raw as string | undefined;
    }
    if (!command || command.trim().length === 0) return 'Error: command is required.';
    try {
      const { stdout, stderr } = await asyncExec(command, {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_SIZE,
      });
      let output = stdout || '';
      if (stderr) output += '\n--- stderr ---\n' + stderr;
      if (output.length > MAX_OUTPUT_SIZE) output = output.slice(0, MAX_OUTPUT_SIZE) + '\n...(truncated)';
      return output || '(no output)';
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      if (err.stdout) return err.stdout;
      if (err.stderr) return err.stderr;
      return `Error: ${err.message || 'Unknown error'}`;
    }
  }
}
