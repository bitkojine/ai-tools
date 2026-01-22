import { TreeNode, TreeOptions } from './types';
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
        totalFolders: 0, // Excluding root? Usually excluding root in counts or including? Let's include if it's counting "folders".
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

    // Traverse starting from root. 
    // If root is folder, it counts as 1. 
    traverse(node);

    // Usually root is not counted in "directories inside". But "Total folders" might include root.
    // Let's stick to simple traversal count.
    return summary;
}

export async function buildTree(
    currentPath: string,
    options: TreeOptions = {},
    parentIg?: any
): Promise<TreeNode> {
    const name = path.basename(currentPath);

    // Use lstat to detect symlinks
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
    let ig = parentIg ? ignore().add(parentIg) : ignore();
    ig.add('.git');

    if (options.ignorePatterns) {
        ig.add(options.ignorePatterns);
    }

    try {
        const gitignorePath = path.join(currentPath, '.gitignore');
        const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
        ig.add(gitignoreContent);
    } catch (e) { }

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

        if (s.isSymbolicLink()) continue; // Skip symlinks

        const isIgnored = ig.ignores(item);
        candidates.push({ name: item, path: itemPath, isIgnored, stats: s });
    }

    // Count visible (non-ignored) items
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
            children.push(await buildTree(cand.path, options, ig));
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
