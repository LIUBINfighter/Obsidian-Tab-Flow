import * as alphaTab from '@coderline/alphatab';

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
			api.playbackSpeed = payload.value as number;
			break;
		case 'setStaveProfile':
			api.settings.display.staveProfile = payload.value as alphaTab.StaveProfile;
			api.updateSettings();
			api.render();
			break;
		case 'setMetronome':
			api.metronomeVolume = payload.value ? 1 : 0;
			break;
		case 'setCountIn':
			api.countInVolume = payload.value ? 1 : 0;
			break;
		case 'setZoom':
			api.settings.display.scale = payload.value as number;
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
				api.settings.player.scrollSpeed = payload.value as number;
				api.updateSettings();
			}
			break;
		case 'setScrollOffsetX':
			if (api.settings.player) {
				api.settings.player.scrollOffsetX = payload.value as number;
				api.updateSettings();
			}
			break;
		case 'setScrollOffsetY':
			if (api.settings.player) {
				api.settings.player.scrollOffsetY = payload.value as number;
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
