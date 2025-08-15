// Convenience barrel file for commonly-used utils.
export { EventBus } from './EventBus';
export { isMessy } from './tabViewHelpers';
export { formatTime } from './timeUtils';
export { setupHorizontalScroll } from './scrollUtils';
export { fileExists } from './fileUtils';
export { vaultPath, getRelativePathToVault } from './pathUtils';
// Optional exports (uncomment if used widely):
export { convertSamplesToWavBlobUrl } from './audioUtils';
export { parseInlineInit, toScrollMode } from './alphatexParser';
export { requestIdle, scheduleInit } from './concurrency';
export { formatError } from './errorUtils';
