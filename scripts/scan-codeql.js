#!/usr/bin/env node
// Lightweight helper to run CodeQL analysis locally from `npm run scan`.
// Behavior:
// - If `codeql` is available on PATH, attempt a simple database create + analyze using project build command.
// - If not available, print installation guidance and exit with code 2.

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function which(cmd) {
  const res = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'pipe' });
  return res.status === 0 ? res.stdout.toString().split(/\r?\n/)[0] : null;
}

function run(cmd, args, opts) {
  console.log('> ' + [cmd].concat(args).join(' '));
  const res = spawnSync(cmd, args, Object.assign({ stdio: 'inherit' }, opts || {}));
  return res.status;
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const codeql = which('codeql');

  if (!codeql) {
    console.error('\nCodeQL CLI not found on PATH.');
    console.error('Install CodeQL CLI from https://codeql.github.com/docs/codeql-cli/getting-started/');
    console.error('Or use the GitHub-hosted CodeQL Action in CI (recommended for PRs).\n');
    process.exit(2);
  }

  // Ensure build step exists
  console.log('CodeQL found at', codeql);

  // Create a temporary database directory
  const dbDir = path.join(repoRoot, 'codeql-db');

  // Use existing build script if present
  // We run `npm run build` to produce compiled artifacts for analysis if the repo needs it.
  const buildStatus = run(process.platform === 'win32' ? 'cmd' : 'npm', process.platform === 'win32' ? ['/c','npm','run','build'] : ['run','build'], { cwd: repoRoot });
  if (buildStatus !== 0) {
    console.error('Build step failed. Aborting CodeQL scan.');
    process.exit(buildStatus);
  }

  // Create DB
  const createArgs = ['database','create', dbDir, '--language=javascript', '--overwrite', '--command', 'npm run build'];
  const createStatus = run(codeql, createArgs, { cwd: repoRoot });
  if (createStatus !== 0) {
    console.error('codeql database create failed');
    process.exit(createStatus);
  }

  // Analyze: include custom queries folder if present
  const customQueriesDir = path.join(repoRoot, '.github', 'codeql-custom-queries');
  const analyzeArgs = ['database','analyze', dbDir, 'javascript', '--format=sarif-latest', '--output', 'codeql-results.sarif'];
  if (fs.existsSync(customQueriesDir)) {
    analyzeArgs.push('--search-path=' + customQueriesDir);
  }

  const analyzeStatus = run(codeql, analyzeArgs, { cwd: repoRoot });
  if (analyzeStatus !== 0) {
    console.error('codeql database analyze failed');
    process.exit(analyzeStatus);
  }

  console.log('\nCodeQL analysis finished. Results written to codeql-results.sarif');
}

main();
