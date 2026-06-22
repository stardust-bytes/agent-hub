import { Injectable } from '@nestjs/common';
import { ToolExecutor } from './tool-executor.interface';
import { GitHubService } from '../../connector/providers/github/github.service';

@Injectable()
export class GitHubCreateIssueExecutor implements ToolExecutor {
  readonly name = 'github_create_issue';
  readonly description = 'Create a new issue in a GitHub repository. Supports title, body, and labels.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      owner: { type: 'string', description: 'Repository owner' },
      repo: { type: 'string', description: 'Repository name' },
      title: { type: 'string', description: 'Issue title' },
      body: { type: 'string', description: 'Issue body / description' },
      labels: { type: 'array', items: { type: 'string' }, description: 'Labels to apply' },
    },
    required: ['owner', 'repo', 'title'] as string[],
  };

  constructor(private readonly github: GitHubService) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    try {
      const issue = await this.github.createIssue(
        args.owner as string, args.repo as string,
        args.title as string, args.body as string,
        args.labels as string[] | undefined,
      );
      return `Created issue #${issue.number} "${issue.title}" [${issue.state}]\n${issue.htmlUrl}`;
    } catch (e: unknown) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  }
}
