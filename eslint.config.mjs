import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default [
	{
		ignores: ['node_modules/**', 'assets/**', 'main.js', 'styles.css'],
	},
	{
		files: ['src/**/*.{ts,tsx}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: './tsconfig.eslint.json',
				sourceType: 'module',
				ecmaVersion: 2020,
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
			obsidianmd,
		},
		rules: {
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/require-await': 'error',
			'@typescript-eslint/await-thenable': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/unbound-method': 'error',
			'@typescript-eslint/no-unnecessary-type-assertion': 'error',
			'@typescript-eslint/no-redundant-type-constituents': 'error',
			'@typescript-eslint/no-base-to-string': 'error',
			'@typescript-eslint/no-deprecated': 'error',
			'@typescript-eslint/ban-ts-comment': [
				'error',
				{
					'ts-ignore': 'allow-with-description',
					'ts-expect-error': 'allow-with-description',
					minimumDescriptionLength: 3,
				},
			],
			'obsidianmd/ui/sentence-case': ['error', { enforceCamelCaseLower: true }],
			'obsidianmd/no-static-styles-assignment': 'error',
			'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
			'no-alert': 'error',
			'no-restricted-properties': [
				'error',
				{ object: 'document', property: 'write' },
				{ object: 'document', property: 'writeln' },
			],
		},
	},
];
