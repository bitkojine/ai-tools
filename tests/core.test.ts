import { buildTree, getSummary } from '../src/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('buildTree', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-cli-test-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should build a tree including nested files and folders', async () => {
        fs.mkdirSync(path.join(tempDir, 'src'));
        fs.writeFileSync(path.join(tempDir, 'src/index.ts'), 'console.log("hello")');
        fs.writeFileSync(path.join(tempDir, 'README.md'), '# Helper');

        const tree = await buildTree(tempDir);

        expect(tree.name).toBe(path.basename(tempDir));
        expect(tree.children).toBeDefined();

        // Check direct children
        const childrenNames = tree.children?.map(c => c.name).sort();
        expect(childrenNames).toEqual(['README.md', 'src']);

        // Check nested child
        const srcNode = tree.children?.find(c => c.name === 'src');
        expect(srcNode).toBeDefined();
        expect(srcNode?.type).toBe('folder');
        expect(srcNode?.children).toHaveLength(1);
        expect(srcNode?.children?.[0].name).toBe('index.ts');
    });

    it('should ignore files based on .gitignore', async () => {
        const gitignorePath = path.join(tempDir, '.gitignore');
        fs.writeFileSync(gitignorePath, 'ignored.txt\nnode_modules');

        fs.writeFileSync(path.join(tempDir, 'ignored.txt'), 'content');
        fs.writeFileSync(path.join(tempDir, 'included.txt'), 'content');
        fs.mkdirSync(path.join(tempDir, 'node_modules'));
        fs.writeFileSync(path.join(tempDir, 'node_modules/pkg.json'), '{}');

        const tree = await buildTree(tempDir);

        const childrenNames = tree.children?.map(c => c.name);
        expect(childrenNames).toContain('included.txt');
        expect(childrenNames).not.toContain('ignored.txt');

        // node_modules should be present but marked as skipped
        const nodeModules = tree.children?.find(c => c.name === 'node_modules');
        expect(nodeModules).toBeDefined();
        expect(nodeModules?.skipped).toBe('gitignore');
        expect(nodeModules?.children).toBeUndefined(); // Shortcuts recursion
    });

    it('should skip symbolic links', async () => {
        const targetDir = path.join(tempDir, 'target');
        fs.mkdirSync(targetDir);
        fs.writeFileSync(path.join(targetDir, 'file.txt'), 'content');

        const linkPath = path.join(tempDir, 'link');
        fs.symlinkSync(targetDir, linkPath);

        const tree = await buildTree(tempDir);
        const linkNode = tree.children?.find(c => c.name === 'link');

        // Requirements say: "Symbolic links should be skipped"
        // This implies they shouldn't appear in the tree OR should appear but not be traversed?
        // "Symbolic links should be skipped to avoid infinite loops"
        // Let's assume we simply don't include them in the tree output to keep it clean.
        expect(linkNode).toBeUndefined();
    });

    it('should respect maxLeaf option', async () => {
        fs.mkdirSync(path.join(tempDir, 'large-dir'));
        for (let i = 0; i < 5; i++) {
            fs.writeFileSync(path.join(tempDir, `large-dir/file${i}.txt`), 'content');
        }

        const tree = await buildTree(tempDir, { maxLeaf: 3 });
        const largeDir = tree.children?.find(c => c.name === 'large-dir');

        expect(largeDir).toBeDefined();
        expect(largeDir?.skipped).toBe('size');
        expect(largeDir?.children).toBeUndefined();
    });
    it('should calculate correct summary', async () => {
        const tree: any = {
            type: 'folder',
            children: [
                { type: 'file' },
                { type: 'folder', children: [{ type: 'file' }] },
                { type: 'folder', skipped: 'gitignore' },
                { type: 'folder', skipped: 'size' }
            ]
        };

        const summary = getSummary(tree);
        expect(summary.totalFiles).toBe(2);
        expect(summary.totalFolders).toBe(4);
        expect(summary.skippedGitignore).toBe(1);
        expect(summary.skippedSize).toBe(1);
    });
});
