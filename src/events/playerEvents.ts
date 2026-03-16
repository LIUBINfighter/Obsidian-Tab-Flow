import * as alphaTab from '@coderline/alphatab';
import {
	applyStaveProfileToScore,
	toFiniteClampedNumber,
	toFiniteNumber,
	toStaveProfile,
} from '../utils';

export type PlayerEventType =
	| 'playPause'
	| 'stop'
	| 'setSpeed'
	| 'setStaveProfile'
	| 'setMetronome'
	| 'setCountIn'
	| 'setZoom'
	| 'setLayoutMode'
	| 'setScrollMode'
	| 'setScrollSpeed'
	| 'setScrollOffsetX'
	| 'setScrollOffsetY'
	| 'setNativeBrowserSmoothScroll'
	| 'triggerScrollToCursor';

export interface PlayerEventPayload {
	type: PlayerEventType;
	value?: unknown;
}

export function handlePlayerEvent(api: alphaTab.AlphaTabApi, payload: PlayerEventPayload) {
	switch (payload.type) {
		case 'playPause':
			api.playPause();
			break;
		case 'stop':
			api.stop();
			break;
		case 'setSpeed':
			api.playbackSpeed = toFiniteClampedNumber(payload.value, 1, 0.5, 2);
			break;
		case 'setStaveProfile':
			if (api.score) {
				const nextProfile = toStaveProfile(payload.value);
				if (
					nextProfile !== alphaTab.StaveProfile.Default &&
					applyStaveProfileToScore(api.score, nextProfile)
				) {
					api.render();
				}
			}
			break;
		case 'setMetronome':
			api.metronomeVolume = payload.value ? 1 : 0;
			break;
		case 'setCountIn':
			api.countInVolume = payload.value ? 1 : 0;
			break;
		case 'setZoom':
			api.settings.display.scale = toFiniteClampedNumber(payload.value, 1, 0.5, 2);
			api.updateSettings();
			api.render();
			break;
		case 'setLayoutMode':
			if (api.settings && api.settings.display) {
				api.settings.display.layoutMode = payload.value as alphaTab.LayoutMode;
				// 自动适配 scrollElement
				let scrollElement: HTMLElement | null = null;
				if (typeof document !== 'undefined') {
					// 你可以根据实际 DOM 结构调整选择器
					scrollElement = document.querySelector('.at-viewport') as HTMLElement;
				}
				if (api.settings.player && scrollElement) {
					api.settings.player.scrollElement = scrollElement;
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
		case 'setScrollMode':
			if (api.settings.player) {
				api.settings.player.scrollMode = payload.value as alphaTab.ScrollMode;
				api.updateSettings();
			}
			break;
		case 'setScrollSpeed':
			if (api.settings.player) {
				api.settings.player.scrollSpeed = toFiniteNumber(payload.value, 500);
				api.updateSettings();
			}
			break;
		case 'setScrollOffsetX':
			if (api.settings.player) {
				api.settings.player.scrollOffsetX = toFiniteNumber(payload.value, 25);
				api.updateSettings();
			}
			break;
		case 'setScrollOffsetY':
			if (api.settings.player) {
				api.settings.player.scrollOffsetY = toFiniteNumber(payload.value, -25);
				api.updateSettings();
			}
			break;
		case 'setNativeBrowserSmoothScroll':
			if (api.settings.player) {
				api.settings.player.nativeBrowserSmoothScroll = payload.value as boolean;
				api.updateSettings();
			}
			break;
		case 'triggerScrollToCursor':
			if (typeof api.scrollToCursor === 'function') {
				api.scrollToCursor();
			}
			break;
		default:
			break;
	}
}
