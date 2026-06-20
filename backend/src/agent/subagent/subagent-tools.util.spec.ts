import { filterSubagentTools, runWithConcurrency } from './subagent-tools.util';

const def = (name: string) => ({ type: 'function' as const, function: { name, description: '', parameters: {} } });

describe('filterSubagentTools', () => {
  const tools = [def('read_file'), def('grep'), def('spawn_subagent'), def('delegate'), def('web_search')];

  it('always strips dispatch tools (recursion block)', () => {
    const names = filterSubagentTools(tools, '*').map(t => t.function.name);
    expect(names).not.toContain('spawn_subagent');
    expect(names).not.toContain('delegate');
    expect(names).toContain('read_file');
  });

  it('restricts to allowedTools list', () => {
    const names = filterSubagentTools(tools, JSON.stringify(['read_file', 'grep'])).map(t => t.function.name);
    expect(names).toEqual(['read_file', 'grep']);
  });
});

describe('runWithConcurrency', () => {
  it('preserves order and caps parallelism', async () => {
    let inFlight = 0, maxInFlight = 0;
    const fn = async (n: number) => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--; return n * 2;
    };
    const out = await runWithConcurrency([1, 2, 3, 4, 5], 2, fn);
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
