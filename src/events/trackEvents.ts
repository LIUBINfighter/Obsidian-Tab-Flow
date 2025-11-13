// trackEvents.ts
// 统一处理音轨相关的业务逻辑事件（独奏、静音、音量、移调等）
import * as alphaTab from '@coderline/alphatab';

export type TrackEventType = 'solo' | 'mute' | 'volume' | 'transpose' | 'transposeAudio';

export interface TrackEventPayload {
	type: TrackEventType;
	track: alphaTab.model.Track;
	value: unknown;
}

export function handleTrackEvent(
	api: alphaTab.AlphaTabApi | undefined,
	payload: TrackEventPayload
) {
	if (!api) {
		console.warn('[handleTrackEvent] AlphaTabApi 未定义，事件被忽略:', payload);
		return;
	}
	// Type guard for value based on event type
	const value = payload.value;
	switch (payload.type) {
		case 'solo':
			api.changeTrackSolo([payload.track], !!value);
			break;
		case 'mute':
			api.changeTrackMute([payload.track], !!value);
			break;
		case 'volume': {
			// value: 0-16, alphaTab 期望 0-1
			const volValue = typeof value === 'number' ? value : 0;
			api.changeTrackVolume([payload.track], Math.max(0, Math.min(1, volValue / 16)));
			break;
		}
		case 'transpose': {
			// value: -12 ~ 12
			const transposeValue = typeof value === 'number' ? value : 0;
			api.changeTrackTranspositionPitch([payload.track], transposeValue);
			break;
		}
		case 'transposeAudio':
			// 这里可扩展为音频移调逻辑
			// 具体API视alphaTab版本而定
			break;
		default:
			// 未知事件类型
			break;
	}
}
