# tree-cli

A flexible CLI tool to display directory structures in a tree format, built with TypeScript and TDD.

## Features

- 🌳 **Recursive Tree View**: Visualizes your folder structure.
- 🙈 **Gitignore Support**: Automatically respects `.gitignore` rules (hides ignored files, marks ignored folders).
- 📏 **Max Leaf Control**: Skips displaying folder contents if the file count exceeds a threshold (`--maxLeaf`).
- 🔗 **Symlink Handling**: Safely skips symbolic links to prevent infinite loops.
- 📊 **Summary Statistics**: Optional summary of folders, files, and skipped items.

## Installation & Build

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

## Usage

Run the tool using `node`:

```bash
node dist/index.js [target-directory] [options]
```

**Options:**
- `--summary`: Show a summary at the end (Total files, folders, skipped items).
- `--maxLeaf=N`: Collapse folders containing more than `N` files.

### Examples

**Show current directory with summary:**
```bash
node dist/index.js . --summary
```

**Show a specific folder, limiting large directories:**
```bash
node dist/index.js ./src --maxLeaf=5
```

## Manual Testing Guide

Follow these steps to verify all features manually.

### 1. Verification Setup
Create a playground directory with various edge cases:

```bash
# Create directories
mkdir -p verify_test/src verify_test/large verify_test/ignored_folder

# Create files
echo "console.log('hello')" > verify_test/src/index.ts
echo "export const x = 1" > verify_test/src/utils.ts
echo "secret" > verify_test/ignored_folder/secret.txt
echo "ignored_folder" > verify_test/.gitignore

# Create a "large" folder (5 files)
for i in {1..5}; do echo "content" > verify_test/large/file$i.txt; done

# Create a symbolic link
ln -s ../verify_test/src verify_test/src_link
```

### 2. Test Cases

**Test A: Standard Tree & Gitignore**
Run:
```bash
node dist/index.js verify_test --summary
```
**Expectation:**
- `ignored_folder` should be marked as `🚫 (ignored)`.
- `src_link` should NOT be visible (symlinks skipped).
- Summary should be displayed.

**Test B: Max Leaf Threshold**
Run:
```bash
node dist/index.js verify_test --maxLeaf=3 --summary
```
**Expectation:**
- `large` folder should be marked `📚 (too many files)` because it has 5 files (> 3).
- Its contents (`file1.txt`...) should NOT be listed.

### 3. Cleanup
```bash
rm -rf verify_test
```

## Running Automated Tests

The project includes a comprehensive test suite using Jest.

```bash
npm test
```
