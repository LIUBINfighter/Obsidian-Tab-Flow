// src-refactor/events/types.ts
import type { PlayerEventPayload, PlayerEventType } from './playerEvents';
import type { ScrollConfigChangeEvent } from './scrollEvents';

export type UIEventType =
	| { domain: 'player'; type: PlayerEventType; payload: PlayerEventPayload }
	| { domain: 'scroll'; type: 'configChange'; payload: ScrollConfigChangeEvent };
