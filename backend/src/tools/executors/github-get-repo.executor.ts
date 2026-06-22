import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GitHubService } from '../../connector/providers/github/github.service';

@Injectable()
export class GitHubGetRepoExecutor implements ToolExecutor {
  readonly name = 'github_get_repo';
  readonly description = 'Get detailed information about a GitHub repository. Use "owner/repo" format.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      owner: { type: 'string', description: 'Repository owner (user or org)' },
      repo: { type: 'string', description: 'Repository name' },
    },
    required: ['owner', 'repo'] as string[],
  };

  constructor(private readonly github: GitHubService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const repo = await this.github.getRepo(args.owner as string, args.repo as string);
      return [
        `Repository: ${repo.name}`,
        `Description: ${repo.description ?? 'N/A'}`,
        `Stars: ⭐ ${repo.stars}  |  Forks: ${repo.forks}  |  Open Issues: ${repo.openIssues}`,
        `Language: ${repo.language ?? 'N/A'}  |  Default Branch: ${repo.defaultBranch}`,
        `Topics: ${repo.topics?.join(', ') ?? 'none'}`,
        `URL: ${repo.url}`,
      ].join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
