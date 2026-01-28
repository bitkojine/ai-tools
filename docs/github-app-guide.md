# GitHub App Issue Creator (Most Secure - No Client Secret)

This is the **most secure implementation** that uses GitHub Apps instead of OAuth Apps, eliminating the need for Client Secrets entirely.

## 🔐 Why GitHub Apps Are Better

### ✅ GitHub App Advantages
- **No Client Secret Required**: Only Client ID needed
- **Better Rate Limits**: 5,000 requests/hour vs 5,000 requests/hour for OAuth Apps
- **Granular Permissions**: Request only specific permissions (Issues: Write)
- **Install per User/Repo**: Users install your app on specific repositories
- **Revocable Access**: Users can uninstall the app anytime
- **Better Security**: Designed for applications, not just web auth

### ❌ What We Eliminated
- ❌ Client Secret storage and management
- ❌ Risk of leaked Client Secrets
- ❌ Complex secret rotation procedures

## 🚀 GitHub App Setup

### 1. Create GitHub App

1. Go to: https://github.com/settings/apps/new
2. Fill in the details:
   - **GitHub App name**: `Issue Creator CLI`
   - **Homepage URL**: `http://localhost:3000`
   - **Webhook URL**: Leave empty (not needed)
   - **Webhook secret**: Leave empty

### 2. Configure Permissions

Under **Repository permissions**:
- **Issues**: **Write** (required to create issues)

### 3. Configure Device Flow

- **Enable Device Flow**: ✅ **Check this box**
- **Identify and authorize users**: ✅ **Check this box**

### 4. Install the App

1. After creating the app, click **"Install App"**
2. Choose where to install:
   - **Only on select repositories** (recommended for testing)
   - **Or on all repositories** (for production)
3. Select the repositories where you want to create issues
4. Click **Install**

### 5. Get Client ID

1. Go to your app settings: https://github.com/settings/apps
2. Click on your app
3. Copy the **Client ID** (under "About")

## 🎯 Usage

### First Time Setup

```bash
# Build the app
npm run build

# Create an issue (will prompt for Client ID first time)
node dist/issue-creator-device.js create "owner/repo" "Issue Title" "Issue description" "bug" "high-priority"
```

### Interactive Setup

The first time you run the tool:

1. **Prompts for Client ID**: Enter your GitHub App's Client ID
2. **Stores Client ID**: Securely stored in OS keychain
3. **Device Authorization**: Opens GitHub for device authorization
4. **One-time Authorization**: User authorizes the device

### Subsequent Uses

```bash
# Uses stored Client ID and token automatically
node dist/issue-creator-device.js create "owner/repo" "Another Issue" "Description" "enhancement"
```

### Managing Credentials

```bash
# Logout and remove stored credentials
node dist/issue-creator-device.js logout

# Reset stored Client ID
node dist/issue-creator-device.js reset-id

# Show help
node dist/issue-creator-device.js
```

## 🔒 Security Features

### No Client Secret
- Only Client ID is stored (safe to share)
- No secret management required
- Eliminates secret leakage risks

### Device Authorization Flow
- No callback URLs needed
- Works on any device
- User explicitly authorizes each device

### OS Keychain Storage
- Client ID stored encrypted
- Access tokens stored encrypted
- No secrets in files or environment

### Granular Permissions
- Only requests Issues: Write permission
- Users can see exactly what the app can do
- Revocable by uninstalling the app

## 📋 Setup Checklist

### GitHub App Configuration
- [ ] Create GitHub App at https://github.com/settings/apps/new
- [ ] Set Repository permissions: Issues → Write
- [ ] Enable Device Flow ✅
- [ ] Enable "Identify and authorize users" ✅
- [ ] Install the app on target repositories
- [ ] Copy the Client ID

### Local Setup
- [ ] Build: `npm run build`
- [ ] Run: `node dist/issue-creator-device.js create "owner/repo" "Test" "Test"`
- [ ] Enter Client ID when prompted
- [ ] Complete device authorization in browser

## 🆚 Comparison: GitHub App vs OAuth App

| Feature | GitHub App | OAuth App |
|---------|------------|-----------|
| **Client Secret** | ❌ Not Required | ✅ Required |
| **Setup Complexity** | Medium | Medium |
| **Rate Limits** | 5,000/hour | 5,000/hour |
| **Permissions** | Granular | Broad scopes |
| **User Control** | Install per repo | Global authorization |
| **Security** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Best For** | CLI Tools | Web Apps |

## 🐛 Troubleshooting

### "Device Flow is not enabled for this App"
- Go to your GitHub App settings
- Check "Enable Device Flow"
- Save changes

### "Insufficient permission"
- Ensure your GitHub App has "Issues: Write" permission
- Reinstall the app after changing permissions
- Check that the target repository is selected in installation

### "App not installed on this repository"
- Go to your GitHub App settings
- Click "Install App"
- Select the target repository
- Try again

### "Authorization expired"
- Device authorization timed out (usually 15 minutes)
- Run the command again to get a new device code

## 🔧 Advanced Usage

### Environment Variable (Optional)

You can optionally set the Client ID as environment variable:

```bash
export GITHUB_APP_CLIENT_ID="your_client_id"
```

But the interactive prompt is more secure since it stores the Client ID in the keychain.

### Programmatic Use

```typescript
import { GitHubAppIssueCreator, CreateIssueParams } from './github-app-issue-creator';

const creator = new GitHubAppIssueCreator();

// First call will trigger device authorization
const issue = await creator.createIssue({
  repo: 'owner/repo',
  title: 'Issue Title',
  body: 'Issue description',
  labels: ['bug', 'high-priority']
});

console.log(`Created issue #${issue.number}`);
```

## 🏢 Enterprise Considerations

### For Organizations
- Create GitHub App under organization account
- Install on organization repositories
- Team members can use without individual setup

### Security Compliance
- No secrets in environment variables
- All credentials stored in OS keychain
- Granular permissions visible to users
- Audit trail in GitHub organization settings

## 📚 Resources

- [GitHub Apps Documentation](https://docs.github.com/en/developers/apps)
- [Device Flow Documentation](https://docs.github.com/en/developers/apps/building-github-apps/authorizing-github-apps#device-flow)
- [GitHub App vs OAuth App](https://docs.github.com/en/developers/apps/differences-between-github-apps-and-oauth-apps)

This GitHub App implementation provides the highest security level for CLI tools while maintaining excellent user experience.
