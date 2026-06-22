import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GitHubService } from '../../connector/providers/github/github.service';

@Injectable()
export class GitHubGetIssueExecutor implements ToolExecutor {
  readonly name = 'github_get_issue';
  readonly description = 'Get detailed information about a specific GitHub issue by number.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      owner: { type: 'string', description: 'Repository owner' },
      repo: { type: 'string', description: 'Repository name' },
      issueNumber: { type: 'number', description: 'Issue number' },
    },
    required: ['owner', 'repo', 'issueNumber'] as string[],
  };

  constructor(private readonly github: GitHubService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const issue = await this.github.getIssue(
        args.owner as string, args.repo as string, args.issueNumber as number,
      );
      return [
        `#${issue.number} [${issue.state}] ${issue.title}`,
        `Author: @${issue.user ?? 'unknown'}`,
        `Assignees: ${issue.assignees.join(', ') || 'none'}`,
        `Labels: ${issue.labels.join(', ') || 'none'}`,
        `Comments: ${issue.comments}`,
        `Created: ${new Date(issue.createdAt).toLocaleDateString('vi-VN')}`,
        `---`,
        issue.body ?? '(no description)',
      ].join('\n');
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
