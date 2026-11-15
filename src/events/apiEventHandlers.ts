import * as alphaTab from '@coderline/alphatab';
import { debugLog } from '../utils/logger';
import { t } from '../i18n';

export function registerApiEventHandlers(
	api: alphaTab.AlphaTabApi,
	audioStatus: HTMLSpanElement,
	isAudioLoaded: () => boolean
): void {
	// 更新音频状态显示
	const updateAudioStatus = () => {
		const STATUS_CLASSES = ['is-error', 'is-success', 'is-warning'] as const;
		const applyStatus = (text: string, cls: (typeof STATUS_CLASSES)[number]) => {
			audioStatus.innerText = text;
			STATUS_CLASSES.forEach((name) => audioStatus.classList.remove(name));
			audioStatus.classList.add(cls);
		};

		if (!api) {
			applyStatus(t('status.apiNotInitialized'), 'is-error');
			return;
		}
		if (!api.player) {
			applyStatus(t('status.playerNotInitialized'), 'is-error');
			return;
		}
		if (isAudioLoaded()) {
			applyStatus(t('status.audioLoaded'), 'is-success');
		} else {
			applyStatus(t('status.audioLoading'), 'is-warning');
		}
	};

	// 音频相关事件
	api.soundFontLoaded.on(updateAudioStatus);
	api.playerReady.on(updateAudioStatus);
	api.scoreLoaded.on(updateAudioStatus);

	// 错误事件
	api.error.on((err) => console.error('[AlphaTab] Error occurred:', err));

	// 渲染事件
	api.renderStarted.on((isResize) => debugLog('[AlphaTab] Render started, isResize:', isResize));
	api.renderFinished.on(() => debugLog('[AlphaTab] Render finished'));

	// 播放器事件
	// api.playerReady.on(() => debugLog("[AlphaTab] Player ready"));
	// api.playerStateChanged.on((args) => debugLog("[AlphaTab] Player state changed:", args.state));
	// api.playerPositionChanged.on((args) => debugLog(`[AlphaTab] Position changed: ${args.currentTime} / ${args.endTime}`));
	// api.playerFinished.on(() => debugLog("[AlphaTab] Playback finished"));
	api.midiEventsPlayed.on((evt) => {
		// 低级 MIDI 事件，可选处理
		// AlphaTab MIDI event types are not exported, use type assertion
		interface AlphaTabMidiEvent {
			isMetronome?: boolean;
			metronomeNumerator?: number;
		}
		evt.events.forEach((midi: unknown) => {
			const midiEvent = midi as AlphaTabMidiEvent;
			if (midiEvent.isMetronome) {
				debugLog('[AlphaTab] Metronome tick:', midiEvent.metronomeNumerator);
			}
		});
	});

	// 初始检查
	window.setTimeout(updateAudioStatus, 500);
}
