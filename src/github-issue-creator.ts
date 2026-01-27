#!/usr/bin/env node

interface CreateIssueParams {
  repo: string; // "owner/repo"
  title: string;
  body: string;
  labels?: string[];
}

interface GitHubIssueResponse {
  id: number;
  number: number;
  title: string;
  html_url: string;
}

class GitHubIssueCreator {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor() {
    this.token = process.env.GITHUB_TOKEN || '';
    if (!this.token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
  }

  async createIssue(params: CreateIssueParams): Promise<GitHubIssueResponse> {
    const [owner, repo] = params.repo.split('/');
    
    if (!owner || !repo) {
      throw new Error('Repo must be in format "owner/repo"');
    }

    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues`;
    
    const body = {
      title: params.title,
      body: params.body,
      labels: params.labels || []
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'github-issue-creator'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`GitHub API Error: ${response.status} - ${errorData}`);
      }

      const issue: GitHubIssueResponse = await response.json();
      return issue;
    } catch (error) {
      throw new Error(`Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: github-issue-creator <repo> <title> <body> [labels...]');
    console.log('Example: github-issue-creator "owner/repo" "Bug found" "Description of the bug" "bug" "high-priority"');
    process.exit(1);
  }

  const [repo, title, body, ...labels] = args;

  try {
    const creator = new GitHubIssueCreator();
    const issue = await creator.createIssue({
      repo,
      title,
      body,
      labels
    });

    console.log(`✓ Created issue #${issue.number}: ${issue.title}`);
    console.log(`🔗 ${issue.html_url}`);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Export for programmatic use
export { GitHubIssueCreator, CreateIssueParams };

// Run CLI if called directly
if (require.main === module) {
  main();
}
