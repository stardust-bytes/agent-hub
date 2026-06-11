import { BLOCK_RULES, matchDangerPattern } from './danger-patterns.config';

describe('danger-patterns.config', () => {
  it('should match python interpreter in bash command', () => {
    const result = matchDangerPattern('bash', 'python script.py', BLOCK_RULES);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('interpreters');
  });

  it('should match curl in bash command', () => {
    const result = matchDangerPattern('bash', 'curl http://example.com', BLOCK_RULES);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('network');
  });

  it('should match git force push', () => {
    const result = matchDangerPattern('bash', 'git push --force origin main', BLOCK_RULES);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('git_destructive');
  });

  it('should match write_file with .sh extension', () => {
    const result = matchDangerPattern('write_file', 'deploy.sh', BLOCK_RULES);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('write_scripts');
  });

  it('should not match safe bash commands', () => {
    const result = matchDangerPattern('bash', 'ls -la', BLOCK_RULES);
    expect(result).toBeNull();
  });

  it('should not match for non-matching tool', () => {
    const result = matchDangerPattern('list_tasks', 'python', BLOCK_RULES);
    expect(result).toBeNull();
  });
});
