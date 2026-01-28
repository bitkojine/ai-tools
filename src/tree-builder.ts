import { TreeNode, TreeOptions } from './tree-types';
import * as fs from 'fs/promises';
import * as path from 'path';
import ignore from 'ignore';

export interface TreeSummary {
    totalFiles: number;
    totalFolders: number;
    skippedGitignore: number;
    skippedSize: number;
}

export function getSummary(node: TreeNode): TreeSummary {
    const summary: TreeSummary = {
        totalFiles: 0,
        totalFolders: 0,
        skippedGitignore: 0,
        skippedSize: 0
    };

    function traverse(n: TreeNode) {
        if (n.type === 'folder') {
            summary.totalFolders++;
            if (n.skipped === 'gitignore') summary.skippedGitignore++;
            if (n.skipped === 'size') summary.skippedSize++;
        } else {
            summary.totalFiles++;
        }

        if (n.children) {
            n.children.forEach(traverse);
        }
    }

    traverse(node);
    return summary;
}

interface IgnoreStackItem {
    ignorer: any;
    basePath: string;
}

export async function buildTree(
    currentPath: string,
    options: TreeOptions = {},
    ignoreStack: IgnoreStackItem[] = []
): Promise<TreeNode> {
    const name = path.basename(currentPath);

    let stats;
    try {
        stats = await fs.lstat(currentPath);
    } catch (e) {
        return { name, path: currentPath, type: 'file', stats: { size: 0 } };
    }

    if (stats.isSymbolicLink()) {
        return { name, path: currentPath, type: 'file', stats: { size: 0 } };
    }

    if (!stats.isDirectory()) {
        return {
            name,
            path: currentPath,
            type: 'file',
            stats: { size: stats.size }
        };
    }

    // Handle .gitignore for current directory
    const currentIg = ignore();

    // If root (empty stack), allow adding global options
    if (ignoreStack.length === 0) {
        currentIg.add('.git');
        if (options.ignorePatterns) {
            currentIg.add(options.ignorePatterns);
        }
    }

    try {
        const gitignorePath = path.join(currentPath, '.gitignore');
        const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
        currentIg.add(gitignoreContent);
    } catch (e) { }

    // Start with existing stack, append current ignore instance
    const newStack = [...ignoreStack, { ignorer: currentIg, basePath: currentPath }];

    let childrenItems: string[];
    try {
        childrenItems = await fs.readdir(currentPath);
    } catch (e) {
        return {
            name,
            path: currentPath,
            type: 'folder',
            children: []
        };
    }

    const candidates: { name: string, path: string, isIgnored: boolean, stats: any }[] = [];
    for (const item of childrenItems) {
        const itemPath = path.join(currentPath, item);
        let s;
        try { s = await fs.lstat(itemPath); } catch { continue; }

        if (s.isSymbolicLink()) continue;

        // Check if ignored by ANY ignorer in the stack
        let isIgnored = false;
        for (const { ignorer, basePath } of newStack) {
            // Get path relative to the ignore file location
            const relPath = path.relative(basePath, itemPath);
            if (ignorer.ignores(relPath)) {
                isIgnored = true;
                break;
            }
            if (s.isDirectory() && ignorer.ignores(relPath + '/')) {
                isIgnored = true;
                break;
            }
        }

        candidates.push({ name: item, path: itemPath, isIgnored, stats: s });
    }

    const visibleCount = candidates.filter(c => !c.isIgnored).length;

    if (options.maxLeaf && visibleCount > options.maxLeaf) {
        return {
            name,
            path: currentPath,
            type: 'folder',
            skipped: 'size'
        };
    }

    const children: TreeNode[] = [];
    for (const cand of candidates) {
        if (cand.isIgnored) {
            if (cand.stats.isDirectory()) {
                children.push({
                    name: cand.name,
                    path: cand.path,
                    type: 'folder',
                    skipped: 'gitignore'
                });
            }
            continue;
        }

        if (cand.stats.isDirectory()) {
            children.push(await buildTree(cand.path, options, newStack));
        } else {
            children.push({
                name: cand.name,
                path: cand.path,
                type: 'file',
                stats: { size: cand.stats.size }
            });
        }
    }

    children.sort((a, b) => {
        if (a.type === b.type) {
            return a.name.localeCompare(b.name);
        }
        return a.type === 'folder' ? -1 : 1;
    });

    return {
        name,
        path: currentPath,
        type: 'folder',
        children
    };
}
