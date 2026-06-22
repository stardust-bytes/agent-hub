import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GitHubService } from '../../connector/providers/github/github.service';

@Injectable()
export class GitHubListCommitsExecutor implements ToolExecutor {
  readonly name = 'github_list_commits';
  readonly description = 'List recent commits in a GitHub repository. Optionally filter by branch.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      owner: { type: 'string', description: 'Repository owner' },
      repo: { type: 'string', description: 'Repository name' },
      branch: { type: 'string', description: 'Branch name (default: default branch)' },
      limit: { type: 'number', description: 'Max commits (default: 20)' },
    },
    required: ['owner', 'repo'] as string[],
  };

  constructor(private readonly github: GitHubService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const commits = await this.github.listCommits(
        args.owner as string, args.repo as string,
        (args.limit as number) ?? 20, args.branch as string,
      );
      if (commits.length === 0) return 'No commits found.';
      return commits.map(c =>
        `${c.sha} ${c.message} — ${c.author ?? 'unknown'} (${new Date(c.date ?? '').toLocaleDateString('vi-VN')})`
      ).join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
