#!/usr/bin/env node
import { buildTree, getSummary } from './core';
import { renderTree } from './render';
import * as path from 'path';
import chalk from 'chalk';

async function main() {
    const args = process.argv.slice(2);
    let targetDir = '.';
    let maxLeaf: number | undefined;
    let showSummary = false;

    // Simple arg parsing
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--summary' || arg === '-s') {
            showSummary = true;
        } else if (arg === '--maxLeaf' || arg.startsWith('--maxLeaf=') || arg === '-m' || arg.startsWith('-m=')) {
            const val = arg.includes('=') ? arg.split('=')[1] : args[++i];
            if (val) {
                maxLeaf = parseInt(val, 10);
            }
        } else if (!arg.startsWith('-')) {
            targetDir = arg;
        }
    }

    const absolutePath = path.resolve(process.cwd(), targetDir);

    try {
        const tree = await buildTree(absolutePath, { maxLeaf });
        console.log(renderTree(tree));

        if (showSummary) {
            const summary = getSummary(tree);
            console.log('\n' + chalk.bold('Summary:'));
            console.log(`Total folders: ${chalk.blue(summary.totalFolders)}`);
            console.log(`Total files: ${chalk.green(summary.totalFiles)}`);
            if (summary.skippedGitignore > 0 || summary.skippedSize > 0) {
                console.log(chalk.yellow(`Skipped folders: ${summary.skippedGitignore} (gitignore), ${summary.skippedSize} (size)`));
            }
        }
    } catch (err: any) {
        console.error(chalk.red('Error building tree:'), err.message);
        process.exit(1);
    }
}

main();
