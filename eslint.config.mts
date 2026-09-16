import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'assets',
		'main.js',
		'styles.css',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'package-lock.json',
		'scripts',
		'_debug',
		'.playwright-mcp',
		'docs',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	prettierRecommended
);
