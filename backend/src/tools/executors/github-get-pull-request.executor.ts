import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GitHubService } from '../../connector/providers/github/github.service';

@Injectable()
export class GitHubGetPullRequestExecutor implements ToolExecutor {
  readonly name = 'github_get_pull_request';
  readonly description = 'Get detailed information about a specific pull request by number.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      owner: { type: 'string', description: 'Repository owner' },
      repo: { type: 'string', description: 'Repository name' },
      pullNumber: { type: 'number', description: 'Pull request number' },
    },
    required: ['owner', 'repo', 'pullNumber'] as string[],
  };

  constructor(private readonly github: GitHubService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const pr = await this.github.getPullRequest(
        args.owner as string, args.repo as string, args.pullNumber as number,
      );
      return [
        `PR #${pr.number} [${pr.state}]${pr.draft ? ' [DRAFT]' : ''} ${pr.title}`,
        `Author: @${pr.user ?? 'unknown'}`,
        `Status: ${pr.merged ? 'Merged ✅' : pr.mergeable === true ? 'Mergeable' : pr.mergeable === false ? 'Conflicts' : 'Checking...'}`,
        `Changes: +${pr.additions} / -${pr.deletions} across ${pr.changedFiles} files`,
        `Comments: ${pr.comments}`,
        `Created: ${new Date(pr.createdAt).toLocaleDateString('vi-VN')}`,
        `URL: ${pr.htmlUrl}`,
      ].join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
