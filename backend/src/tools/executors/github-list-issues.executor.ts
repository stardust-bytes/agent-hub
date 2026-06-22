import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GitHubService } from '../../connector/providers/github/github.service';

@Injectable()
export class GitHubListIssuesExecutor implements ToolExecutor {
  readonly name = 'github_list_issues';
  readonly description = 'List issues in a specific GitHub repository. Issues with pull_request property are excluded.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      owner: { type: 'string', description: 'Repository owner' },
      repo: { type: 'string', description: 'Repository name' },
      state: { type: 'string', enum: ['open', 'closed', 'all'] as string[], description: 'Issue state (default: open)' },
      limit: { type: 'number', description: 'Max results (default: 20)' },
    },
    required: ['owner', 'repo'] as string[],
  };

  constructor(private readonly github: GitHubService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const issues = await this.github.listIssues(
        args.owner as string, args.repo as string,
        (args.state as 'open' | 'closed' | 'all') ?? 'open',
        (args.limit as number) ?? 20,
      );
      if (issues.length === 0) return 'No issues found.';
      return issues.map(i =>
        `#${i.number} [${i.state}] ${i.title} — @${i.user ?? 'unknown'} | labels: ${i.labels.join(', ') || 'none'}`
      ).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
