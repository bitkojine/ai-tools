import { TreeNode, TreeOptions } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';
import ignore from 'ignore';

export async function buildTree(rootPath: string, options: TreeOptions = {}): Promise<TreeNode> {
    // TODO: Implement tree building logic
    const name = path.basename(rootPath);
    return {
        name,
        path: rootPath,
        type: 'folder',
        children: []
    };
}
