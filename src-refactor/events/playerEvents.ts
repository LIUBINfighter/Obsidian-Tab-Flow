import * as alphaTab from "@coderline/alphatab";

export type PlayerEventType =
  | "playPause"
  | "stop"
  | "setSpeed"
  | "setStaveProfile"
  | "setMetronome"
  | "setCountIn"
  | "setZoom"
  | "setLayoutMode";

export interface PlayerEventPayload {
  type: PlayerEventType;
  value?: any;
}

export function handlePlayerEvent(api: alphaTab.AlphaTabApi, payload: PlayerEventPayload) {
  switch (payload.type) {
    case "playPause":
      api.playPause();
      break;
    case "stop":
      api.stop();
      break;
    case "setSpeed":
      api.playbackSpeed = payload.value;
      break;
    case "setStaveProfile":
      api.settings.display.staveProfile = payload.value;
      api.updateSettings();
      api.render();
      break;
    case "setMetronome":
      api.metronomeVolume = payload.value ? 1 : 0;
      break;
    case "setCountIn":
      api.countInVolume = payload.value ? 1 : 0;
      break;
    case "setZoom":
      api.settings.display.scale = payload.value;
      api.updateSettings();
      api.render();
      break;
    case "setLayoutMode":
      if (api.settings && api.settings.display) {
        api.settings.display.layoutMode = payload.value;
        api.updateSettings();
        api.render();
      }
      break;
    default:
      break;
  }
}
