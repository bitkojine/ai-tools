#!/usr/bin/env node

import * as keytar from 'keytar';
import { createSign } from 'crypto';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';

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

interface InstallationResponse {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
  repository_selection: string;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
}

class IssueCreatorJWT {
  private baseUrl = 'https://api.github.com';
  private clientId: string;
  private privateKeyPath: string;
  private serviceName = 'issue-creator-jwt';
  private accountName = 'jwt-token';

  constructor() {
    this.clientId = process.env.GITHUB_APP_CLIENT_ID || '';
    this.privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH || '';

    if (!this.clientId || !this.privateKeyPath) {
      console.log('🔧 Setup required: GitHub App credentials needed');
      console.log('Create a GitHub App at: https://github.com/settings/apps/new');
      console.log('Download the private key (.pem file) from the app settings');
    }
  }

  private async promptForInput(prompt: string, hidden: boolean = false): Promise<string> {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      });

      if (hidden) {
        process.stdin.setRawMode(true);
        let input = '';

        const onData = (char: Buffer) => {
          const str = char.toString();
          switch (str) {
            case '\n':
            case '\r':
            case '\u0004':
              process.stdin.setRawMode(false);
              process.stdin.pause();
              process.stdin.off('data', onData);
              rl.write('\n');
              rl.close();
              resolve(input);
              break;
            case '\u0003':
              process.exit(0);
              break;
            case '\u007F':
              if (input.length > 0) {
                input = input.slice(0, -1);
                process.stdout.write('\b \b');
              }
              break;
            default:
              input += str;
              process.stdout.write('*');
              break;
          }
        };

        process.stdin.on('data', onData);
        rl.question(prompt, () => { });
      } else {
        rl.question(prompt, (answer) => {
          rl.close();
          resolve(answer);
        });
      }
    });
  }

  private async getClientId(): Promise<string> {
    if (this.clientId) {
      return this.clientId;
    }

    const storedClientId = await keytar.getPassword(this.serviceName, 'client-id');
    if (storedClientId) {
      this.clientId = storedClientId;
      return this.clientId;
    }

    const clientId = await this.promptForInput('Enter GitHub App Client ID: ', false);
    if (!clientId) {
      throw new Error('Client ID is required');
    }

    await keytar.setPassword(this.serviceName, 'client-id', clientId);
    this.clientId = clientId;
    console.log('✓ Client ID stored securely');

    return clientId;
  }

  private async getPrivateKeyPath(): Promise<string> {
    if (this.privateKeyPath) {
      return this.privateKeyPath;
    }

    const storedPath = await keytar.getPassword(this.serviceName, 'private-key-path');
    if (storedPath) {
      this.privateKeyPath = storedPath;
      return this.privateKeyPath;
    }

    const path = await this.promptForInput('Enter path to GitHub App private key (.pem file): ', false);
    if (!path) {
      throw new Error('Private key path is required');
    }

    // Test if file exists
    try {
      readFileSync(resolve(path));
    } catch (error) {
      throw new Error(`Private key file not found at: ${path}`);
    }

    await keytar.setPassword(this.serviceName, 'private-key-path', path);
    this.privateKeyPath = path;
    console.log('✓ Private key path stored securely');

    return path;
  }

  private generateJWT(): string {
    const clientId = this.clientId;
    const privateKey = readFileSync(resolve(this.privateKeyPath));

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // 60 seconds in the past
      exp: now + (10 * 60), // 10 minutes expiration
      iss: clientId
    };

    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    // Base64url encode without padding
    const base64UrlEncode = (str: string) => {
      return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));

    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const sign = createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(privateKey, 'base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return `${signatureInput}.${signature}`;
  }

  private async getInstallationToken(jwt: string): Promise<InstallationResponse> {
    console.log('🔍 Getting installations...');

    // First, get the installation ID
    const installationsResponse = await fetch('https://api.github.com/app/installations', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'issue-creator-jwt'
      }
    });

    if (!installationsResponse.ok) {
      const errorData = await installationsResponse.text();
      console.log(`❌ Failed to get installations: ${installationsResponse.status} - ${errorData}`);
      throw new Error(`Failed to get installations: ${installationsResponse.status} - ${errorData}`);
    }

    const installations = await installationsResponse.json();
    console.log(`🔍 Found ${installations.length} installations`);

    if (!installations || installations.length === 0) {
      throw new Error('No installations found. Please install the GitHub App on at least one repository.');
    }

    // Use the first installation (you could make this configurable)
    const installationId = installations[0].id;
    console.log(`🔧 Using installation ID: ${installationId}`);

    // Get repositories accessible by this installation
    console.log('🔍 Getting accessible repositories...');
    const reposResponse = await fetch(`https://api.github.com/installation/${installationId}/repositories`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'issue-creator-jwt'
      }
    });

    if (reposResponse.ok) {
      const reposData = await reposResponse.json();
      console.log(`🔍 Accessible repositories:`);
      reposData.repositories.forEach((repo: any) => {
        console.log(`   - ${repo.full_name}`);
      });
    }

    // Get access token for the installation
    console.log('🔍 Getting installation access token...');
    const tokenResponse = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'github-app-jwt-issue-creator'
      }
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.log(`❌ Failed to get installation token: ${tokenResponse.status} - ${errorData}`);
      throw new Error(`Failed to get installation token: ${tokenResponse.status} - ${errorData}`);
    }

    const tokenData = await tokenResponse.json();
    console.log(`🔍 Token response:`, JSON.stringify(tokenData, null, 2));

    // Store the actual token field
    await this.storeToken(tokenData.token);
    console.log('✅ Token stored securely');

    return tokenData;
  }

  private async storeToken(token: string): Promise<void> {
    await keytar.setPassword(this.serviceName, this.accountName, token);
  }

  private async getStoredToken(): Promise<string | null> {
    return await keytar.getPassword(this.serviceName, this.accountName);
  }

  private async getValidToken(): Promise<string> {
    // Check if we have a valid stored token
    const storedToken = await this.getStoredToken();
    if (storedToken) {
      console.log('🔍 Using stored token');
      // TODO: Check if token is still valid (GitHub App tokens expire after 1 hour)
      // For now, we'll try to use it and refresh if it fails
      return storedToken;
    }

    // Get new token
    console.log('🔐 Generating new Issue Creator JWT token...');

    try {
      await this.getClientId();
      await this.getPrivateKeyPath();

      const jwt = this.generateJWT();
      console.log('✅ JWT generated successfully');

      const tokenResponse = await this.getInstallationToken(jwt);
      console.log('✅ Installation token obtained');

      return tokenResponse.token; // Return the token field
    } catch (error) {
      console.log('❌ Error in getValidToken:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async createIssue(params: CreateIssueParams): Promise<GitHubIssueResponse> {
    const token = await this.getValidToken();

    const [owner, repo] = params.repo.split('/');

    if (!owner || !repo) {
      throw new Error('Repo must be in format "owner/repo"');
    }

    // First, test if we can access the repository
    const repoUrl = `${this.baseUrl}/repos/${owner}/${repo}`;
    console.log(`🔍 Testing repository access: ${repoUrl}`);

    try {
      const repoResponse = await fetch(repoUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'issue-creator-jwt'
        }
      });

      if (!repoResponse.ok) {
        const errorData = await repoResponse.text();
        console.log(`❌ Repository access failed: ${repoResponse.status} - ${errorData}`);
        throw new Error(`Cannot access repository ${owner}/${repo}. Is the GitHub App installed on this repository?`);
      }

      console.log(`✅ Repository accessible`);
    } catch (error) {
      throw error;
    }

    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues`;

    const body = {
      title: params.title,
      body: params.body,
      labels: params.labels && params.labels.length > 0 ? params.labels : undefined
    };

    console.log(`🔍 Creating issue in: ${owner}/${repo}`);
    console.log(`🔍 Token length: ${token.length}`);
    console.log(`🔍 URL: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'issue-creator-jwt'
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

  async listPublicRepositories(owner: string): Promise<Repository[]> {
    const token = await this.getValidToken();

    console.log(`🔍 Fetching public repositories for: ${owner}`);

    const url = `${this.baseUrl}/users/${owner}/repos?type=public&per_page=100`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'issue-creator-jwt'
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`GitHub API Error: ${response.status} - ${errorData}`);
      }

      const repositories: Repository[] = await response.json();
      return repositories;
    } catch (error) {
      throw new Error(`Failed to fetch repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async logout(): Promise<void> {
    await keytar.deletePassword(this.serviceName, this.accountName);
    await keytar.deletePassword(this.serviceName, 'client-id');
    await keytar.deletePassword(this.serviceName, 'private-key-path');
    console.log('✅ Logged out successfully');
  }

  async resetCredentials(): Promise<void> {
    await keytar.deletePassword(this.serviceName, 'client-id');
    await keytar.deletePassword(this.serviceName, 'private-key-path');
    console.log('✅ Credentials reset. You will be prompted again on next run.');
  }

  async listRepositories(): Promise<void> {
    // Get JWT for app-level API calls
    await this.getClientId();
    await this.getPrivateKeyPath();
    const jwt = this.generateJWT();

    console.log('🔍 Getting accessible repositories...');

    // Get installations first
    const installationsResponse = await fetch('https://api.github.com/app/installations', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'github-app-jwt-issue-creator'
      }
    });

    if (!installationsResponse.ok) {
      const errorData = await installationsResponse.text();
      throw new Error(`Failed to get installations: ${installationsResponse.status} - ${errorData}`);
    }

    const installations = await installationsResponse.json();

    if (!installations || installations.length === 0) {
      console.log('❌ No installations found.');
      return;
    }

    // Get repositories for each installation
    for (const installation of installations) {
      console.log(`\n📦 Installation: ${installation.account?.login || 'Unknown'} (${installation.target_type})`);
      console.log(`🔧 Installation ID: ${installation.id}`);
      console.log(`🔧 Permissions:`, JSON.stringify(installation.permissions, null, 2));

      // Get installation token first
      console.log('🔧 Getting installation token...');
      const tokenResponse = await fetch(`https://api.github.com/app/installations/${installation.id}/access_tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'github-app-jwt-issue-creator'
        }
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.log(`   ❌ Failed to get installation token: ${tokenResponse.status}`);
        console.log(`   ❌ Error details: ${errorData}`);
        continue;
      }

      const tokenData = await tokenResponse.json();
      const installationToken = tokenData.token;

      // Now get repositories using installation token
      const reposResponse = await fetch(`https://api.github.com/installation/repositories`, {
        headers: {
          'Authorization': `token ${installationToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'github-app-jwt-issue-creator'
        }
      });

      if (reposResponse.ok) {
        const reposData = await reposResponse.json();

        if (reposData.repositories && reposData.repositories.length > 0) {
          console.log(`📚 Accessible repositories (${reposData.repositories.length}):`);
          reposData.repositories.forEach((repo: any) => {
            const visibility = repo.private ? '🔒' : '🌍';
            const language = repo.language || 'Unknown';
            const stars = repo.stargazers_count || 0;
            const updated = new Date(repo.updated_at).toLocaleDateString();
            console.log(`   ${visibility} ${repo.full_name} (${language}) ⭐ ${stars} 📅 ${updated}`);
            console.log(`      📎 ${repo.html_url}`);
          });
        } else {
          console.log('   No repositories accessible for this installation');
        }
      } else {
        const errorData = await reposResponse.text();
        console.log(`   ❌ Failed to get repositories: ${reposResponse.status}`);
        console.log(`   ❌ Error details: ${errorData}`);
      }
    }
  }

  async listAllRepositoriesWithAccessMethod(owner: string): Promise<void> {
    console.log(`🔍 Getting ALL repositories for ${owner} with access method tags...`);

    // Get all public repositories first
    const publicRepos = await this.listPublicRepositories(owner);

    // Get repositories accessible through GitHub App
    let appAccessibleRepos: string[] = [];
    try {
      await this.getClientId();
      await this.getPrivateKeyPath();
      const jwt = this.generateJWT();

      const installationsResponse = await fetch('https://api.github.com/app/installations', {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'github-app-jwt-issue-creator'
        }
      });

      if (installationsResponse.ok) {
        const installations = await installationsResponse.json();

        for (const installation of installations) {
          if (installation.account?.login === owner) {
            const tokenResponse = await fetch(`https://api.github.com/app/installations/${installation.id}/access_tokens`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${jwt}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'github-app-jwt-issue-creator'
              }
            });

            if (tokenResponse.ok) {
              const tokenData = await tokenResponse.json();
              const installationToken = tokenData.token;

              const reposResponse = await fetch(`https://api.github.com/installation/repositories`, {
                headers: {
                  'Authorization': `token ${installationToken}`,
                  'Accept': 'application/vnd.github.v3+json',
                  'User-Agent': 'github-app-jwt-issue-creator'
                }
              });

              if (reposResponse.ok) {
                const reposData = await reposResponse.json();
                if (reposData.repositories) {
                  appAccessibleRepos = reposData.repositories.map((repo: any) => repo.full_name);
                }
              }
            }
            break;
          }
        }
      }
    } catch (error) {
      console.log(`⚠️  Could not get GitHub App access info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log(`\n📊 Repository Access Summary for ${owner}:`);
    console.log(`🌍 Public repositories: ${publicRepos.length}`);
    console.log(`🔧 GitHub App accessible: ${appAccessibleRepos.length}`);
    console.log(`📈 Total repositories found: ${publicRepos.length}`);

    console.log(`\n📋 All Repositories with Access Method:`);

    publicRepos.forEach((repo) => {
      const language = repo.language || 'Unknown';
      const stars = repo.stargazers_count || 0;
      const updated = new Date(repo.updated_at).toLocaleDateString();

      // Determine access method
      let accessTag = '';
      let accessIcon = '';

      if (appAccessibleRepos.includes(repo.full_name)) {
        accessTag = '🔑 GITHUB APP';
        accessIcon = '🔑';
      } else {
        accessTag = '🌐 PUBLIC API';
        accessIcon = '🌐';
      }

      const visibility = repo.private ? '🔒' : '🌍';

      console.log(`${accessIcon} ${visibility} ${repo.full_name} (${language}) ⭐ ${stars} 📅 ${updated}`);
      console.log(`   📎 ${repo.html_url}`);
      console.log(`   ${accessTag}`);
      if (repo.description) {
        console.log(`   📝 ${repo.description}`);
      }
      console.log('');
    });

    // Summary by access method
    const appOnlyCount = appAccessibleRepos.length;
    const publicOnlyCount = publicRepos.length - appOnlyCount;

    console.log(`📈 Access Method Summary:`);
    console.log(`   🔑 GitHub App: ${appOnlyCount} repos (app-based access)`);
    console.log(`   🌐 Public API: ${publicOnlyCount} repos (direct API access)`);
    console.log(`   🏷️ Total: ${publicRepos.length} repos (all can accept issues)`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: issue-creator-jwt <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  list-repos                                   List all accessible repositories');
    console.log('  list-public <owner>                          List public repositories for a user');
    console.log('  list-all <owner>                             List ALL repos with access method tags');
    console.log('  create <repo> <title> <body> [labels...]  Create a new issue');
    console.log('  logout                                       Remove stored credentials');
    console.log('  reset-credentials                            Reset stored credentials');
    console.log('');
    console.log('Security features:');
    console.log('  • JWT-based authentication (most secure)');
    console.log('  • Private key stored securely in OS keychain');
    console.log('  • No Client Secret required');
    console.log('  • Installation tokens (auto-expiring)');
    console.log('');
    console.log('Setup:');
    console.log('  1. Create GitHub App: https://github.com/settings/apps/new');
    console.log('  2. Set permissions: Issues (Write)');
    console.log('  3. Generate and download private key (.pem file)');
    console.log('  4. Install the app on target repositories');
    console.log('  5. Run: issue-creator-jwt create "owner/repo" "Title" "Body"');
    console.log('');
    console.log('Example:');
    console.log('  issue-creator-jwt list-repos');
    console.log('  issue-creator-jwt list-public bitkojine');
    console.log('  issue-creator-jwt list-all bitkojine');
    console.log('  issue-creator-jwt create "owner/repo" "Bug found" "Description" "bug" "high-priority"');
    process.exit(1);
  }

  const [command] = args;

  try {
    if (command === 'list-repos') {
      const creator = new IssueCreatorJWT();
      await creator.listRepositories();
      return;
    }

    if (command === 'list-public') {
      if (args.length < 2) {
        console.log('Usage: issue-creator-jwt list-public <owner>');
        console.log('Example: issue-creator-jwt list-public bitkojine');
        process.exit(1);
      }

      const [, owner] = args;
      const creator = new IssueCreatorJWT();
      const repositories = await creator.listPublicRepositories(owner);

      console.log(`🌍 Public repositories for ${owner} (${repositories.length}):`);
      repositories.forEach((repo) => {
        const language = repo.language || 'Unknown';
        const stars = repo.stargazers_count || 0;
        const updated = new Date(repo.updated_at).toLocaleDateString();
        console.log(`🌍 ${repo.full_name} (${language}) ⭐ ${stars} 📅 ${updated}`);
        console.log(`   📎 ${repo.html_url}`);
        if (repo.description) {
          console.log(`   📝 ${repo.description}`);
        }
        console.log('');
      });
      return;
    }

    if (command === 'list-all') {
      if (args.length < 2) {
        console.log('Usage: issue-creator-jwt list-all <owner>');
        console.log('Example: issue-creator-jwt list-all bitkojine');
        process.exit(1);
      }

      const [, owner] = args;
      const creator = new IssueCreatorJWT();
      await creator.listAllRepositoriesWithAccessMethod(owner);
      return;
    }

    if (command === 'logout') {
      const creator = new IssueCreatorJWT();
      await creator.logout();
      return;
    }

    if (command === 'reset-credentials') {
      const creator = new IssueCreatorJWT();
      await creator.resetCredentials();
      return;
    }

    if (command === 'create') {
      if (args.length < 4) {
        console.log('Usage: issue-creator-jwt create <repo> <title> <body> [labels...]');
        console.log('Example: issue-creator-jwt create "owner/repo" "Bug found" "Description" "bug" "high-priority"');
        process.exit(1);
      }

      const [, repo, title, body, ...labels] = args;

      const creator = new IssueCreatorJWT();
      const issue = await creator.createIssue({
        repo,
        title,
        body,
        labels: labels.length > 0 ? labels : undefined
      });

      console.log(`✅ Created issue #${issue.number}: ${issue.title}`);
      console.log(`🔗 ${issue.html_url}`);
      return;
    }

    console.error(`Unknown command: ${command}`);
    process.exit(1);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Export for programmatic use
export { IssueCreatorJWT, CreateIssueParams };

// Run CLI if called directly
if (require.main === module) {
  main();
}
