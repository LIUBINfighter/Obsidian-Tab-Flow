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
        // 自动适配 scrollElement
        let scrollElement: HTMLElement | null = null;
        if (typeof document !== 'undefined') {
          // 你可以根据实际 DOM 结构调整选择器
          scrollElement = document.querySelector('.at-viewport') as HTMLElement;
        }
        if (api.settings.player) {
          api.settings.player.scrollElement = scrollElement || undefined;
        }
        api.updateSettings();
        api.render();
        // 切换后强制滚动到当前光标
        setTimeout(() => {
          if (typeof api.scrollToCursor === 'function') {
            api.scrollToCursor();
          }
        }, 100);
      }
      break;
    default:
      break;
  }
}
