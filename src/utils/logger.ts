/**
 * Gated debug logging.
 *
 * Obsidian's plugin guidelines ask plugins to keep the developer console quiet
 * by default. Debug messages are therefore routed through this module and only
 * printed when debug logging is explicitly enabled (see the
 * "Toggle debug logging" command).
 */

let debugLoggingEnabled = false;

export function setDebugLoggingEnabled(enabled: boolean): void {
	debugLoggingEnabled = enabled;
}

export function isDebugLoggingEnabled(): boolean {
	return debugLoggingEnabled;
}

export function debugLog(...args: unknown[]): void {
	if (debugLoggingEnabled) {
		console.debug('[TabFlow]', ...args);
	}
}

export function debugWarn(...args: unknown[]): void {
	if (debugLoggingEnabled) {
		console.warn('[TabFlow]', ...args);
	}
}
