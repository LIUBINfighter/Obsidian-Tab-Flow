import { promises as fs } from 'fs';

type AdapterLike = { exists?: (p: string) => Promise<boolean> };

/**
 * Check whether a file exists. If an Obsidian adapter is provided and exposes
 * an `exists` method, it will be used. Otherwise falls back to Node fs.stat.
 *
 * @param path - file path to check
 * @param adapter - optional Obsidian vault adapter (adapter.exists(path): Promise<boolean>)
 */
export async function fileExists(path: string, adapter?: AdapterLike): Promise<boolean> {
    if (adapter && typeof adapter.exists === 'function') {
        try {
            return await adapter.exists(path);
        } catch {
            return false;
        }
    }

    try {
        const st = await fs.stat(path);
        return !!st;
    } catch {
        return false;
    }
}
