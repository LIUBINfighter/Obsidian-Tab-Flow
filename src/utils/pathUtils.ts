import { normalizePath } from 'obsidian';

/**
 * Join segments into a vault-relative path using forward slashes and normalize.
 */
export function vaultPath(...segments: string[]): string {
	return normalizePath(segments.join('/'));
}

/**
 * Join path segments without relying on Node's `path` module.
 *
 * The plugin review environment doesn't resolve Node type definitions, so any
 * use of `path.join`/`path.basename` shows up as an unsafe `any` access there.
 */
export function joinPath(...segments: string[]): string {
	const joined = segments
		.filter((segment) => typeof segment === 'string' && segment.length > 0)
		.join('/')
		.replace(/\\/g, '/')
		.replace(/\/{2,}/g, '/');
	return joined ? normalizePath(joined) : '';
}

/**
 * Return the last segment of a path (the file or folder name).
 */
export function baseName(filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/').replace(/\/+$/, '');
	const index = normalized.lastIndexOf('/');
	return index >= 0 ? normalized.slice(index + 1) : normalized;
}

/**
 * Return the parent path of a file or folder path.
 */
export function dirName(filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/').replace(/\/+$/, '');
	const index = normalized.lastIndexOf('/');
	if (index < 0) return '';
	return normalized.slice(0, index);
}

/**
 * Compute a path relative to the vault for assets located under pluginDir.
 * If the absolutePath already starts with pluginDir, return a normalized
 * vault-like path. Otherwise fallback to joining pluginDir with the basename.
 */
export function getRelativePathToVault(absolutePath: string, pluginDir: string): string {
	if (!pluginDir) throw new Error('pluginDir not defined');
	const normalizedPluginDir = pluginDir.replace(/\\/g, '/');
	const normalizedPath = absolutePath.replace(/\\/g, '/');
	if (normalizedPath.startsWith(normalizedPluginDir)) {
		// return the path as-is (should already be vault-relative)
		return normalizePath(normalizedPath);
	}
	const fileName = baseName(absolutePath);
	return joinPath(normalizedPluginDir, 'assets', fileName);
}
