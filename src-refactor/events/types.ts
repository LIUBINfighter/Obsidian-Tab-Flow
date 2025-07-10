// src-refactor/events/types.ts
import type { TrackEventPayload, TrackEventType } from "./trackEvents";
import type { PlayerEventPayload, PlayerEventType } from "./playerEvents";

export type UIEventType =
  | { domain: "track"; type: TrackEventType; payload: TrackEventPayload }
  | { domain: "player"; type: PlayerEventType; payload: PlayerEventPayload };
