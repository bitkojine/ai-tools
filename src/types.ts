export interface TreeNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: TreeNode[];
    skipped?: 'gitignore' | 'size';
    stats?: {
        size: number;
    };
}

export interface TreeOptions {
    maxLeaf?: number;
    ignorePatterns?: string[];
}
