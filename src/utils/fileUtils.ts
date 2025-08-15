type AdapterLike = {
    exists?: (p: string) => Promise<boolean>;
    read?: (p: string) => Promise<string | ArrayBuffer | Uint8Array | unknown>;
};

/**
 * Check whether a file exists using an Obsidian-compatible adapter.
 *
 * Behavior:
 * - If adapter.exists is available, use it.
 * - Else if adapter.read is available, attempt to read the file and treat success as existence.
 * - Otherwise return false.
 *
 * Note: Node's fs dependency intentionally removed to avoid conflicts with Obsidian.
 */
export async function fileExists(path: string, adapter?: AdapterLike): Promise<boolean> {
    if (adapter && typeof adapter.exists === 'function') {
        try {
            return await adapter.exists(path);
        } catch {
            return false;
        }
    }

    if (adapter && typeof adapter.read === 'function') {
        try {
            await adapter.read(path);
            return true;
        } catch {
            return false;
        }
    }

    // No adapter available — we intentionally don't use Node fs here.
    return false;
}
