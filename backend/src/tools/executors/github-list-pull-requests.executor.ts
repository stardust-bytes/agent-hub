import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GitHubService } from '../../connector/providers/github/github.service';

@Injectable()
export class GitHubListPullRequestsExecutor implements ToolExecutor {
  readonly name = 'github_list_pull_requests';
  readonly description = 'List pull requests in a GitHub repository. Returns number, title, state, author, and draft status.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      owner: { type: 'string', description: 'Repository owner' },
      repo: { type: 'string', description: 'Repository name' },
      state: { type: 'string', enum: ['open', 'closed', 'all'] as string[], description: 'PR state (default: open)' },
      limit: { type: 'number', description: 'Max results (default: 20)' },
    },
    required: ['owner', 'repo'] as string[],
  };

  constructor(private readonly github: GitHubService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const prs = await this.github.listPullRequests(
        args.owner as string, args.repo as string,
        (args.state as 'open' | 'closed' | 'all') ?? 'open',
        (args.limit as number) ?? 20,
      );
      if (prs.length === 0) return 'No pull requests found.';
      return prs.map(pr =>
        `#${pr.number} [${pr.state}]${pr.draft ? ' [DRAFT]' : ''} ${pr.title} — @${pr.user ?? 'unknown'}`
      ).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
