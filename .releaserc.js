module.exports = {
    branches: [
        'main',
        {
            name: 'release/*',
            prerelease: 'beta'
        }
    ],
    plugins: [
        [
            '@semantic-release/commit-analyzer',
            {
                preset: 'conventionalcommits',
                releaseRules: [
                    { type: 'feat', release: 'minor' },
                    { type: 'fix', release: 'patch' },
                    { type: 'perf', release: 'patch' },
                    { type: 'docs', release: 'patch' },
                    { type: 'refactor', release: 'patch' },
                    { type: 'style', release: 'patch' },
                    { type: 'test', release: 'patch' },
                    { type: 'minor', release: 'minor' },
                    { type: 'patch', release: 'patch' },
                    { breaking: true, release: 'minor' },
                    { release: 'patch' }
                ]
            }
        ],
        '@semantic-release/release-notes-generator',
        [
            '@semantic-release/npm',
            {
                npmPublish: false
            }
        ],
        [
            '@semantic-release/github',
            {
                assets: [
                    {
                        path: 'dist/**',
                        label: 'Distribution'
                    }
                ],
                successComment: false,
                failComment: false
            }
        ]
    ],
    tagFormat: 'v${version}'
};
