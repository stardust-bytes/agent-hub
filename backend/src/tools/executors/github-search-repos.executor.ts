import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GitHubService } from '../../connector/providers/github/github.service';

@Injectable()
export class GitHubSearchReposExecutor implements ToolExecutor {
  readonly name = 'github_search_repos';
  readonly description = 'Search GitHub repositories by query. Returns name, description, stars, language.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query (name, description, topics)' },
      limit: { type: 'number', description: 'Max results (default: 10)' },
    },
    required: ['query'] as string[],
  };

  constructor(private readonly github: GitHubService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const repos = await this.github.searchRepos(args.query as string, (args.limit as number) ?? 10);
      if (repos.length === 0) return 'No repositories found.';
      return repos.map(r =>
        `[${r.name}] ${r.description ?? ''} — ⭐ ${r.stars} | ${r.language ?? 'N/A'} | ${r.url}`
      ).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
