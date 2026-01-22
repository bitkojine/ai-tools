const { execSync } = require('child_process');
const path = require('path');
const { buildTree } = require('./dist/core');

const target = process.argv[2] || '.';
const resolvedTarget = path.resolve(target);

console.log(`Verifying file lists for: ${resolvedTarget}`);

async function verify() {
    try {
        // 1. Get Tree-CLI file list via API
        console.log('Building tree...');
        const tree = await buildTree(resolvedTarget);

        const treeFiles = new Set();
        function collectFiles(node) {
            if (node.type === 'file') {
                treeFiles.add(path.relative(resolvedTarget, node.path));
            } else if (node.children) {
                node.children.forEach(c => collectFiles(c));
            }
        }
        collectFiles(tree);
        console.log(`Tree found ${treeFiles.size} files.`);

        // 2. Get Git file list
        console.log('Running git ls-files...');
        let gitOutput;
        try {
            gitOutput = execSync(`git ls-files -c -o --exclude-standard`, { cwd: resolvedTarget, encoding: 'utf-8' });
        } catch (e) {
            console.error('Failed to run git ls-files. Is the target a git repository?');
            process.exit(1);
        }

        const gitFilesArr = gitOutput.trim().split('\n').filter(l => l.length > 0);
        const gitFiles = new Set(gitFilesArr);
        console.log(`Git found ${gitFiles.size} files.`);

        // 3. Compare
        const missingInTree = [...gitFiles].filter(x => !treeFiles.has(x));
        const extraInTree = [...treeFiles].filter(x => !gitFiles.has(x));

        if (missingInTree.length === 0 && extraInTree.length === 0) {
            console.log('\n✅ SUCCESS: File lists match exactly!');
        } else {
            console.log('\n❌ MISMATCH: Lists differ.');

            if (missingInTree.length > 0) {
                console.log('\nFiles in Git but MISSING in Tree (Ignored wrongly?):');
                missingInTree.slice(0, 10).forEach(f => console.log(` - ${f}`));
                if (missingInTree.length > 10) console.log(`... and ${missingInTree.length - 10} more.`);
            }

            if (extraInTree.length > 0) {
                console.log('\nFiles in Tree but MISSING in Git (Should be ignored?):');
                extraInTree.slice(0, 10).forEach(f => console.log(` - ${f}`));
                if (extraInTree.length > 10) console.log(`... and ${extraInTree.length - 10} more.`);
            }
            process.exit(1);
        }

    } catch (e) {
        console.error('Error during verification:', e);
        process.exit(1);
    }
}

verify();
