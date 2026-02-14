import { normalizePath } from 'obsidian';

/**
 * Join segments into a vault-relative path using forward slashes and normalize.
 */
export function vaultPath(...segments: string[]): string {
	return normalizePath(segments.join('/'));
}

/**
 * Minimal cross-platform basename (works with both "/" and "\\\\").
 */
export function basename(p: string): string {
	const s = (p || '').replace(/\\\\/g, '/');
	const segs = s.split('/');
	return segs[segs.length - 1] || '';
}

/**
 * Minimal cross-platform dirname (returns '.' for top-level).
 */
export function dirname(p: string): string {
	const s = (p || '').replace(/\\\\/g, '/');
	const segs = s.split('/');
	segs.pop();
	if (segs.length === 0) return '.';
	return segs.join('/');
}

/**
 * Compute a path relative to the vault for assets located under pluginDir.
 * If the absolutePath already starts with pluginDir, return a normalized
 * vault-like path. Otherwise fallback to joining pluginDir with the basename.
 */
export function getRelativePathToVault(absolutePath: string, pluginDir: string): string {
	if (!pluginDir) throw new Error('pluginDir not defined');
	const normalizedPluginDir = pluginDir.replace(/\\\\/g, '/');
	const normalizedPath = (absolutePath || '').replace(/\\\\/g, '/');
	if (normalizedPath.startsWith(normalizedPluginDir)) {
		return normalizePath(normalizedPath);
	}
	const fileName = basename(absolutePath);
	return vaultPath(normalizedPluginDir, 'assets', fileName);
}
