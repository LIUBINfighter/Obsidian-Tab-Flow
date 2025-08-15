// Convenience barrel file for commonly-used utils.
export { EventBus } from './EventBus';
export { isMessy } from './tabViewHelpers';
export { formatTime } from './timeUtils';
export { setupHorizontalScroll } from './scrollUtils';
// fileExists relies on an Obsidian-compatible adapter being provided by callers.
// Prefer passing `app.vault.adapter` to ensure file checks work in Obsidian's
// environment (no direct Node fs dependency at runtime).
//
// Example: fileExists(path, this.app.vault.adapter)
export { fileExists } from './fileUtils';
export { vaultPath, getRelativePathToVault } from './pathUtils';
// Optional exports (uncomment if used widely):
export { convertSamplesToWavBlobUrl } from './audioUtils';
export { parseInlineInit, toScrollMode } from './alphatexParser';
export { requestIdle, scheduleInit } from './concurrency';
export { formatError } from './errorUtils';
