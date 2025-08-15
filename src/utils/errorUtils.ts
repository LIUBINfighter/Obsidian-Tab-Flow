export function formatError(err: unknown): string {
    try {
        const anyErr = err as any;
        if (anyErr && typeof anyErr.message === 'string') return anyErr.message;
        return String(err);
    } catch {
        return 'Unknown error';
    }
}
