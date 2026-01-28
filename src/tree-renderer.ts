import { TreeNode } from './tree-types';
import chalk from 'chalk';

export function renderTree(tree: TreeNode): string {
    const lines: string[] = [];

    function traverse(node: TreeNode, prefix: string, isLast: boolean, isRoot: boolean) {
        let line = '';

        // Add prefix for non-root nodes
        if (!isRoot) {
            line += prefix + (isLast ? '└── ' : '├── ');
        }

        // Add Icon and Name
        let icon = '';
        let name = node.name;

        if (node.skipped === 'gitignore') {
            icon = '🚫'; // Or maybe just mention it's skipped
            name = chalk.gray(`${node.name} (ignored)`);
        } else if (node.skipped === 'size') {
            icon = '📚';
            name = chalk.yellow(`${node.name} (too many files)`);
        } else if (node.type === 'folder') {
            icon = '📁';
            name = chalk.bold.blue(node.name);
        } else {
            icon = '📄';
            name = node.name;
        }

        line += `${icon} ${name}`;
        lines.push(line);

        // Recurse
        if (node.children) {
            const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');

            node.children.forEach((child, index) => {
                const isLastChild = index === node.children!.length - 1;
                traverse(child, childPrefix, isLastChild, false);
            });
        }
    }

    traverse(tree, '', true, true);
    return lines.join('\n');
}
