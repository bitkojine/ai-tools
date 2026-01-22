import { renderTree } from '../src/render';
import { TreeNode } from '../src/types';

const stripAnsi = (str: string) => str.replace(/\u001b\[\d+m/g, '');

describe('renderTree', () => {
    it('should render a simple tree structure', () => {
        const tree: TreeNode = {
            name: 'root',
            path: '/root',
            type: 'folder',
            children: [
                { name: 'file1.txt', path: '/root/file1.txt', type: 'file', stats: { size: 100 } },
                {
                    name: 'src', path: '/root/src', type: 'folder', children: [
                        { name: 'index.ts', path: '/root/src/index.ts', type: 'file', stats: { size: 200 } }
                    ]
                }
            ]
        };

        const output = stripAnsi(renderTree(tree));

        expect(output).toContain('📁 root');
        expect(output).toContain('├── 📄 file1.txt');
        expect(output).toContain('└── 📁 src');
        expect(output).toContain('    └── 📄 index.ts');
    });

    it('should show emojis for folders and files', () => {
        const tree: TreeNode = {
            name: 'root',
            path: '/root',
            type: 'folder',
            children: [
                { name: 'file.txt', path: '/root/file.txt', type: 'file' }
            ]
        };
        const output = stripAnsi(renderTree(tree));
        expect(output).toContain('📁 root');
        expect(output).toContain('└── 📄 file.txt');
    });

    it('should indicate skipped folders', () => {
        const tree: TreeNode = {
            name: 'root',
            path: '/root',
            type: 'folder',
            children: [
                { name: 'ignored', path: '/root/ignored', type: 'folder', skipped: 'gitignore' },
                { name: 'huge', path: '/root/huge', type: 'folder', skipped: 'size' }
            ]
        };
        const output = stripAnsi(renderTree(tree));

        // Note: The implementation renders "🚫 ignored (ignored)" and "📚 huge (too many files)"
        expect(output).toContain('├── 🚫 ignored (ignored)');
        expect(output).toContain('└── 📚 huge (too many files)');
    });
});
