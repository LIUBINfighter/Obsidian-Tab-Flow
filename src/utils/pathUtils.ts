import * as path from 'path';
import { normalizePath } from 'obsidian';

/**
 * Join segments into a vault-relative path using forward slashes and normalize.
 */
export function vaultPath(...segments: string[]): string {
    return normalizePath(segments.join('/'));
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
    const fileName = path.basename(absolutePath);
    return normalizePath(path.join(normalizedPluginDir, 'assets', fileName));
}
