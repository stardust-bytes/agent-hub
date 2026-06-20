import { parseAgentCommand } from './agent-command.util';

describe('parseAgentCommand', () => {
  it('parses slug and task', () => {
    expect(parseAgentCommand('/agent researcher find the bug')).toEqual({ slug: 'researcher', task: 'find the bug' });
  });

  it('returns null for non-agent messages', () => {
    expect(parseAgentCommand('hello world')).toBeNull();
  });

  it('returns null when task is missing', () => {
    expect(parseAgentCommand('/agent researcher')).toBeNull();
  });

  it('returns null when task is only whitespace', () => {
    expect(parseAgentCommand('/agent researcher    ')).toBeNull();
  });

  it('returns null for an uppercase/invalid slug', () => {
    expect(parseAgentCommand('/agent Researcher do it')).toBeNull();
  });

  it('preserves multi-line task content', () => {
    expect(parseAgentCommand('/agent code-reviewer line one\nline two')).toEqual({
      slug: 'code-reviewer',
      task: 'line one\nline two',
    });
  });
});
