# AI Tools

A collection of AI-powered tools for GitHub repository management and analysis.

## Features

- 🤖 **GitHub App Integration**: Secure authentication using GitHub Apps
- 🌳 **Directory Tree Visualization**: Display directory structures in tree format
- � **Multi-Repository Analysis**: Analyze multiple repositories simultaneously
- 🏷️ **Issue Creation**: Create GitHub issues programmatically

## Installation & Build

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

## Available Tools

### Directory Tree Tool

Visualize folder structures with gitignore support:

```bash
node dist/index.js [target-directory] [options]
```

**Options:**
- `--summary`, `-s`: Show a summary at the end
- `--maxLeaf=N`, `-m N`: Collapse folders containing more than N files

### GitHub App Issue Creator

Create issues using GitHub App authentication:

```bash
node dist/issue-creator-device.js create "owner/repo" "Issue Title" "Issue description"
```

### GitHub App JWT Issue Creator

Create issues using JWT-based GitHub App authentication:

```bash
node dist/issue-creator-jwt.js create "owner/repo" "Issue Title" "Issue description"
```

## Setup

### GitHub App Configuration

1. Create a GitHub App at https://github.com/settings/apps/new
2. Configure the necessary permissions (Issues: Write)
3. Download the private key
4. Set the required environment variables:
   ```bash
   export GITHUB_APP_ID="your_app_id"
   export GITHUB_PRIVATE_KEY_PATH="path/to/private/key.pem"
   ```

For detailed setup instructions, see [docs/github-app-guide.md](docs/github-app-guide.md).

## Running Tests

```bash
npm test
```

## Project Structure

- `src/tree-builder.ts` - Core tree building functionality
- `src/tree-renderer.ts` - Tree rendering utilities
- `src/issue-creator-device.ts` - GitHub App issue creation (Device Flow)
- `src/issue-creator-jwt.ts` - JWT-based GitHub App authentication
- `docs/` - Documentation for various tools

## License

ISC
