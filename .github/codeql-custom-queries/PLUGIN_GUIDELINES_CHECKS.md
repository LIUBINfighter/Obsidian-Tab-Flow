# Mapping Obsidian Plugin Guidelines to CodeQL / ESLint checks

This document explains how the included CodeQL queries and ESLint integration map to common Obsidian plugin review guidelines and how to customize or run the checks.

Included checks

- CodeQL custom queries (.github/codeql-custom-queries/javascript)
  - innerhtml-warning.ql — flags use of `innerHTML`, `outerHTML`, `insertAdjacentHTML` patterns
  - global-app-usage.ql — flags references to a global `app` identifier or `window.app`
  - console-logging-warning.ql — flags `console.log`, `console.info`, `console.debug`

- ESLint — used to detect general code smells, `var` usage, promise vs async/await patterns, and style issues. Configure ESLint rules in your repo's `.eslintrc`.

How each guideline is covered

- Avoid using global app instance: flagged by `global-app-usage.ql`. Consider adding more heuristics if your code uses `app` as a local name.
- Avoid unnecessary logging to console: flagged by `console-logging-warning.ql`. Keep `console.error` where appropriate.
- Avoid innerHTML/outerHTML/insertAdjacentHTML: flagged by `innerhtml-warning.ql` to prevent unsafe DOM insertion.
- Prefer `const`/`let` over `var`: enforce via ESLint rule `no-var`.
- Prefer async/await over raw Promise chains: enforce via ESLint `promise/prefer-await-to-then` (requires eslint-plugin-promise).

## Running locally

1. Install dependencies:

  npm ci

2. Run ESLint locally:

  npx eslint "src/**/*.ts" "src/**/*.js"

3. Run CodeQL analysis locally (basic):

  - You need the CodeQL CLI. Follow: [CodeQL CLI getting started](https://codeql.github.com/docs/codeql-cli/getting-started/)

  - Create a database for JavaScript:

    codeql database create codeql-db --language=javascript --command="npm run build"

  - Run queries including your custom queries folder:

    codeql database analyze codeql-db "javascript" --format=sarif-latest --output=results.sarif --search-path=./.github/codeql-custom-queries


## Customizing queries

- Place any additional .ql or .qls files into `.github/codeql-custom-queries/javascript/`.
- In `codeql-eslint.yml`, the `queries` option in the `init` step points to this folder and will include them in analysis.

## Notes and limitations

- The provided CodeQL queries are lightweight examples. For low false positives/negatives, refine them against your codebase.
- CodeQL is powerful for dataflow and taint analysis; cover more cases (e.g., template literals or DOM wrappers) by extending queries.
