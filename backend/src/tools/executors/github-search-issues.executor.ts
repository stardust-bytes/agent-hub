import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GitHubService } from '../../connector/providers/github/github.service';

@Injectable()
export class GitHubSearchIssuesExecutor implements ToolExecutor {
  readonly name = 'github_search_issues';
  readonly description = 'Search GitHub issues and pull requests across all repositories. Supports GitHub search qualifiers (repo:, label:, state:, is:issue, is:pr).';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query with GitHub qualifiers (e.g. "repo:owner/name bug")' },
      limit: { type: 'number', description: 'Max results (default: 10)' },
    },
    required: ['query'] as string[],
  };

  constructor(private readonly github: GitHubService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const issues = await this.github.searchIssues(args.query as string, (args.limit as number) ?? 10);
      if (issues.length === 0) return 'No issues found.';
      return issues.map(i =>
        `#${i.number} [${i.state}] ${i.title} — @${i.user} | ${i.htmlUrl}`
      ).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
