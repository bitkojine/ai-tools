import { buildTree } from '../src/core';
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

    it('should build a simple tree for a directory with one file', async () => {
        const filePath = path.join(tempDir, 'file.txt');
        fs.writeFileSync(filePath, 'content');

        const tree = await buildTree(tempDir);

        expect(tree).toBeDefined();
        expect(tree.type).toBe('folder');
        // Once implemented, children should be populated.
        // expect(tree.children).toHaveLength(1);
        // expect(tree.children![0].name).toBe('file.txt');
    });

    it('should ignore files based on .gitignore', async () => {
        const gitignorePath = path.join(tempDir, '.gitignore');
        fs.writeFileSync(gitignorePath, 'ignored.txt');

        fs.writeFileSync(path.join(tempDir, 'ignored.txt'), 'content');
        fs.writeFileSync(path.join(tempDir, 'included.txt'), 'content');

        const tree = await buildTree(tempDir);

        // TODO: Assertions for ignored files
        expect(tree).toBeDefined();
    });
});
