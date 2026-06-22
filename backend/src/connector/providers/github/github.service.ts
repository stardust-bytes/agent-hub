import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { ConnectorService } from '../../connector.service';

@Injectable()
export class GitHubService {
  constructor(private readonly connector: ConnectorService) {}

  async getClient(type: string = 'github'): Promise<Octokit | null> {
    const conn = await this.connector.findByType(type);
    if (!conn?.enabled) return null;
    const config = JSON.parse(conn.config);
    if (!config.token) return null;
    return new Octokit({ auth: config.token });
  }

  // Repos
  async searchRepos(query: string, perPage = 10) {
    const octo = await this.getClient();
    if (!octo) throw new Error('GitHub connector not configured');
    const { data } = await octo.search.repos({ q: query, per_page: perPage });
    return data.items.map(r => ({
      name: r.full_name, description: r.description, stars: r.stargazers_count,
      language: r.language, url: r.html_url, defaultBranch: r.default_branch,
    }));
  }

  async getRepo(owner: string, repo: string) {
    const octo = await this.getClient();
    if (!octo) throw new Error('GitHub connector not configured');
    const { data } = await octo.repos.get({ owner, repo });
    return {
      name: data.full_name, description: data.description, stars: data.stargazers_count,
      language: data.language, defaultBranch: data.default_branch, topics: data.topics,
      openIssues: data.open_issues_count, forks: data.forks_count, url: data.html_url,
    };
  }

  // Issues
  async searchIssues(query: string, perPage = 10) {
    const octo = await this.getClient();
    if (!octo) throw new Error('GitHub connector not configured');
    const { data } = await octo.search.issuesAndPullRequests({ q: query, per_page: perPage });
    return data.items.map(i => ({
      number: i.number, title: i.title, state: i.state, repoUrl: i.repository_url,
      htmlUrl: i.html_url, user: i.user?.login, labels: i.labels.map(l => l.name),
      createdAt: i.created_at, updatedAt: i.updated_at,
    }));
  }

  async listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open', perPage = 20) {
    const octo = await this.getClient();
    if (!octo) throw new Error('GitHub connector not configured');
    const { data } = await octo.issues.listForRepo({ owner, repo, state, per_page: perPage });
    return data.filter(i => !i.pull_request).map(i => ({
      number: i.number, title: i.title, state: i.state, user: i.user?.login,
      labels: (i.labels as { name: string }[]).map(l => l.name), createdAt: i.created_at, updatedAt: i.updated_at,
    }));
  }

  async getIssue(owner: string, repo: string, issueNumber: number) {
    const octo = await this.getClient();
    if (!octo) throw new Error('GitHub connector not configured');
    const { data } = await octo.issues.get({ owner, repo, issue_number: issueNumber });
    return {
      number: data.number, title: data.title, state: data.state, body: data.body,
      user: data.user?.login, labels: (data.labels as { name: string }[]).map(l => l.name),
      assignees: data.assignees.map(a => a.login), comments: data.comments,
      createdAt: data.created_at, updatedAt: data.updated_at, htmlUrl: data.html_url,
    };
  }

  async createIssue(owner: string, repo: string, title: string, body?: string, labels?: string[]) {
    const octo = await this.getClient();
    if (!octo) throw new Error('GitHub connector not configured');
    const { data } = await octo.issues.create({ owner, repo, title, body, labels });
    return { number: data.number, title: data.title, state: data.state, htmlUrl: data.html_url };
  }

  // Pull Requests
  async listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open', perPage = 20) {
    const octo = await this.getClient();
    if (!octo) throw new Error('GitHub connector not configured');
    const { data } = await octo.pulls.list({ owner, repo, state, per_page: perPage });
    return data.map(pr => ({
      number: pr.number, title: pr.title, state: pr.state, user: pr.user?.login,
      body: pr.body?.slice(0, 500), draft: pr.draft, createdAt: pr.created_at,
      updatedAt: pr.updated_at, htmlUrl: pr.html_url,
    }));
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number) {
    const octo = await this.getClient();
    if (!octo) throw new Error('GitHub connector not configured');
    const { data } = await octo.pulls.get({ owner, repo, pull_number: pullNumber });
    return {
      number: data.number, title: data.title, state: data.state, body: data.body,
      user: data.user?.login, draft: data.draft, mergeable: data.mergeable,
      merged: data.merged, additions: data.additions, deletions: data.deletions,
      changedFiles: data.changed_files, comments: data.comments,
      createdAt: data.created_at, updatedAt: data.updated_at, htmlUrl: data.html_url,
    };
  }

  // Commits
  async listCommits(owner: string, repo: string, perPage = 20, branch?: string) {
    const octo = await this.getClient();
    if (!octo) throw new Error('GitHub connector not configured');
    const { data } = await octo.repos.listCommits({ owner, repo, per_page: perPage, sha: branch });
    return data.map(c => ({
      sha: c.sha.slice(0, 7), message: c.commit.message.split('\n')[0],
      author: c.commit.author?.name, date: c.commit.author?.date,
      url: c.html_url,
    }));
  }
}
