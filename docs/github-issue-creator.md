# GitHub Issue Creator Tool

## Overview
A minimal TypeScript tool for programmatically creating GitHub issues via the GitHub REST API. Designed for automated branch review workflows.

## Capabilities
- Create GitHub issues in any repository
- Add labels to issues
- Both CLI and programmatic interfaces
- Environment variable authentication
- Proper error handling and validation

## Setup

### 1. Environment Variable
Set your GitHub Personal Access Token:
```bash
export GITHUB_TOKEN=your_personal_access_token
```

**Required Token Scopes:** `repo` (to create issues)

### 2. Compilation
```bash
npx tsc src/github-issue-creator.ts --outDir dist --target es2020 --module commonjs
```

## Usage

### CLI Interface
```bash
node dist/github-issue-creator.js <repo> <title> <body> [labels...]
```

**Examples:**
```bash
# Basic issue
node dist/github-issue-creator.js "owner/repo" "Bug found" "Description of the bug"

# With labels
node dist/github-issue-creator.js "owner/repo" "Security issue" "CVE found in auth" "security" "high-priority"

# Multiple labels
node dist/github-issue-creator.js "owner/repo" "Missing tests" "UserService needs unit tests" "testing" "enhancement"
```

### Programmatic Interface
```typescript
import { GitHubIssueCreator, CreateIssueParams } from './github-issue-creator';

const creator = new GitHubIssueCreator();

// Basic usage
const issue = await creator.createIssue({
  repo: "owner/repo",
  title: "Issue Title",
  body: "Detailed description",
  labels: ["bug", "high-priority"]
});

console.log(`Created issue #${issue.number}: ${issue.html_url}`);
```

## Integration in Branch Review Workflow

### Step 1: Branch Analysis
When reviewing a branch against main:
```bash
git diff main...feature-branch --name-only
```

### Step 2: Issue Detection
Analyze changes for:
- Security vulnerabilities
- Missing tests
- Documentation gaps
- Code quality issues
- Performance problems

### Step 3: Automated Issue Creation
```typescript
// Example: Create issues for detected problems
const issues = [
  {
    title: "Missing unit tests for UserService",
    body: "The UserService class in src/services/user.ts lacks unit tests. Please add test coverage for all public methods.",
    labels: ["testing", "enhancement"]
  },
  {
    title: "Security vulnerability in API endpoint",
    body: "The POST /api/users endpoint lacks input validation. This could lead to SQL injection attacks.",
    labels: ["security", "bug", "high-priority"]
  }
];

for (const issueData of issues) {
  await creator.createIssue({
    repo: "owner/repo",
    ...issueData
  });
}
```

## Error Handling

### Common Errors
- **Missing Token:** `GITHUB_TOKEN environment variable is required`
- **Invalid Repo Format:** `Repo must be in format "owner/repo"`
- **API Errors:** `GitHub API Error: 404 - Not Found` (repo doesn't exist or insufficient permissions)
- **Network Issues:** `Failed to create issue: fetch failed`

### Troubleshooting
1. Verify token is set: `echo $GITHUB_TOKEN`
2. Check token has `repo` scope
3. Verify repo format: "owner/repo"
4. Ensure repo exists and you have write access

## API Response Format
```typescript
interface GitHubIssueResponse {
  id: number;        // GitHub issue ID
  number: number;    // Issue number in repository
  title: string;     // Issue title
  html_url: string;  // URL to view issue in browser
}
```

## File Structure
```
ai-tools/
├── src/
│   └── github-issue-creator.ts    # Main tool implementation
├── dist/
│   └── github-issue-creator.js    # Compiled JavaScript
└── docs/
    └── github-issue-creator.md    # This documentation
```

## Dependencies
- Node.js (ES2020+)
- TypeScript compiler
- GitHub Personal Access Token

No external npm packages required - uses built-in `fetch` API.
