#!/usr/bin/env node

import open from 'open';
import * as keytar from 'keytar';
import { randomBytes } from 'crypto';
import { createInterface } from 'readline';

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

interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
}

class IssueCreatorDevice {
  private baseUrl = 'https://api.github.com';
  private clientId: string;
  private serviceName = 'issue-creator-device';
  private accountName = 'device-token';

  constructor() {
    this.clientId = process.env.GITHUB_APP_CLIENT_ID || '';

    if (!this.clientId) {
      console.log('🔧 Setup required: GitHub App Client ID needed');
      console.log('Create a GitHub App at: https://github.com/settings/apps/new');
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

  private async initiateDeviceAuth(): Promise<DeviceAuthResponse> {
    const clientId = await this.getClientId();

    console.log(`🔍 Using Client ID: ${clientId}`);

    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'public_repo'
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.log(`❌ Debug - Status: ${response.status}`);
      console.log(`❌ Debug - Response: ${errorData}`);

      if (response.status === 404) {
        throw new Error('Device Flow not enabled for this GitHub App. Please check that "Enable Device Flow" is checked in your GitHub App settings.');
      }

      throw new Error(`Device auth initiation failed: ${response.status} - ${errorData}`);
    }

    return await response.json();
  }

  private async pollForToken(deviceCode: string, interval: number): Promise<TokenResponse> {
    const clientId = await this.getClientId();

    while (true) {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Token polling failed: ${response.status} - ${errorData}`);
      }

      const data = await response.json();

      if (data.access_token) {
        return data;
      }

      if (data.error === 'authorization_pending') {
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
        continue;
      }

      if (data.error === 'slow_down') {
        await new Promise(resolve => setTimeout(resolve, (interval + 5) * 1000));
        continue;
      }

      if (data.error === 'expired_token') {
        throw new Error('Authorization expired. Please try again.');
      }

      if (data.error === 'access_denied') {
        throw new Error('Authorization denied by user.');
      }

      throw new Error(`Unexpected error: ${data.error}`);
    }
  }

  private async storeToken(token: string): Promise<void> {
    await keytar.setPassword(this.serviceName, this.accountName, token);
  }

  private async getStoredToken(): Promise<string | null> {
    return await keytar.getPassword(this.serviceName, this.accountName);
  }

  private async authorize(): Promise<string> {
    console.log('🔐 Starting Issue Creator Device Authorization...');

    const deviceAuth = await this.initiateDeviceAuth();

    console.log('');
    console.log('📱 Please authorize this device:');
    console.log(`   1. Visit: ${deviceAuth.verification_uri}`);
    console.log(`   2. Enter code: ${deviceAuth.user_code}`);
    console.log('');

    try {
      await open(deviceAuth.verification_uri);
      console.log('🌐 Browser opened automatically');
    } catch (error) {
      console.log('⚠️  Could not open browser automatically');
    }

    console.log(`⏳ Waiting for authorization (expires in ${deviceAuth.expires_in}s)...`);

    const tokenResponse = await this.pollForToken(deviceAuth.device_code, deviceAuth.interval);

    await this.storeToken(tokenResponse.access_token);

    console.log('✅ Authorization successful!');
    return tokenResponse.access_token;
  }

  private async getValidToken(): Promise<string> {
    let token = await this.getStoredToken();

    if (!token) {
      token = await this.authorize();
    }

    return token;
  }

  async createIssue(params: CreateIssueParams): Promise<GitHubIssueResponse> {
    const token = await this.getValidToken();

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
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'issue-creator-device'
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

  async logout(): Promise<void> {
    await keytar.deletePassword(this.serviceName, this.accountName);
    await keytar.deletePassword(this.serviceName, 'client-id');
    console.log('✅ Logged out successfully');
  }

  async resetClientId(): Promise<void> {
    await keytar.deletePassword(this.serviceName, 'client-id');
    console.log('✅ Client ID reset. You will be prompted again on next run.');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: issue-creator-device <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  create <repo> <title> <body> [labels...]  Create a new issue');
    console.log('  logout                                       Remove stored credentials');
    console.log('  reset-id                                     Reset stored client ID');
    console.log('');
    console.log('Security features:');
    console.log('  • NO Client Secret required (GitHub App advantage)');
    console.log('  • Client ID stored securely in OS keychain');
    console.log('  • No secrets in environment variables or shell history');
    console.log('  • Device authorization flow (no redirect URI needed)');
    console.log('  • Better rate limits than OAuth Apps');
    console.log('');
    console.log('Setup:');
    console.log('  1. Create GitHub App: https://github.com/settings/apps/new');
    console.log('  2. Enable Device Flow for the app');
    console.log('  3. Set permissions: Issues (Write)');
    console.log('  4. Run: issue-creator-device create "owner/repo" "Title" "Body"');
    console.log('');
    console.log('Example:');
    console.log('  issue-creator-device create "owner/repo" "Bug found" "Description" "bug" "high-priority"');
    process.exit(1);
  }

  const [command] = args;

  try {
    if (command === 'logout') {
      const creator = new IssueCreatorDevice();
      await creator.logout();
      return;
    }

    if (command === 'reset-id') {
      const creator = new IssueCreatorDevice();
      await creator.resetClientId();
      return;
    }

    if (command === 'create') {
      if (args.length < 5) {
        console.log('Usage: issue-creator-device create <repo> <title> <body> [labels...]');
        console.log('Example: issue-creator-device create "owner/repo" "Bug found" "Description" "bug" "high-priority"');
        process.exit(1);
      }

      const [, repo, title, body, ...labels] = args;

      const creator = new IssueCreatorDevice();
      const issue = await creator.createIssue({
        repo,
        title,
        body,
        labels
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
export { IssueCreatorDevice, CreateIssueParams };

// Run CLI if called directly
if (require.main === module) {
  main();
}
