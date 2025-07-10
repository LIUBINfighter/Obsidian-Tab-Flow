// trackEvents.ts
// 统一处理音轨相关的业务逻辑事件（独奏、静音、音量、移调等）
import * as alphaTab from "@coderline/alphatab";

export type TrackEventType = "solo" | "mute" | "volume" | "transpose" | "transposeAudio";

export interface TrackEventPayload {
    type: TrackEventType;
    track: alphaTab.model.Track;
    value: any;
}

export function handleTrackEvent(api: alphaTab.AlphaTabApi, payload: TrackEventPayload) {
    switch (payload.type) {
        case "solo":
            api.changeTrackSolo([payload.track], !!payload.value);
            break;
        case "mute":
            api.changeTrackMute([payload.track], !!payload.value);
            break;
        case "volume":
            // value: 0-16, alphaTab 期望 0-1
            api.changeTrackVolume([payload.track], Math.max(0, Math.min(1, payload.value / 16)));
            break;
        case "transpose":
            // value: -12 ~ 12
            api.changeTrackTranspositionPitch([payload.track], payload.value);
            break;
        case "transposeAudio":
            // 这里可扩展为音频移调逻辑
            // 具体API视alphaTab版本而定
            break;
        default:
            // 未知事件类型
            break;
    }
}
