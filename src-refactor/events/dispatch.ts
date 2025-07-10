import { handleTrackEvent } from "./trackEvents";
import { handlePlayerEvent } from "./playerEvents";
import type { UIEventType } from "./types";
import type * as alphaTab from "@coderline/alphatab";

export function dispatchUIEvent(api: alphaTab.AlphaTabApi, event: UIEventType) {
  switch (event.domain) {
    case "track":
      handleTrackEvent(api, event.payload);
      break;
    case "player":
      handlePlayerEvent(api, event.payload);
      break;
    default:
      // 可加日志
      break;
  }
}
