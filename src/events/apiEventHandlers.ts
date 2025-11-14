import * as alphaTab from '@coderline/alphatab';

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
			applyStatus('音频：API未初始化', 'is-error');
			return;
		}
		if (!api.player) {
			applyStatus('音频：播放器未初始化', 'is-error');
			return;
		}
		if (isAudioLoaded()) {
			applyStatus('音频：已加载', 'is-success');
		} else {
			applyStatus('音频：加载中...', 'is-warning');
		}
	};

	// 音频相关事件
	api.soundFontLoaded.on(updateAudioStatus);
	api.playerReady.on(updateAudioStatus);
	api.scoreLoaded.on(updateAudioStatus);

	// 错误事件
	api.error.on((err) => console.error('[AlphaTab] Error occurred:', err));

	// 渲染事件
	api.renderStarted.on((isResize) =>
		console.debug('[AlphaTab] Render started, isResize:', isResize)
	);
	api.renderFinished.on(() => console.debug('[AlphaTab] Render finished'));

	// 播放器事件
	// api.playerReady.on(() => console.debug("[AlphaTab] Player ready"));
	// api.playerStateChanged.on((args) => console.debug("[AlphaTab] Player state changed:", args.state));
	// api.playerPositionChanged.on((args) => console.debug(`[AlphaTab] Position changed: ${args.currentTime} / ${args.endTime}`));
	// api.playerFinished.on(() => console.debug("[AlphaTab] Playback finished"));
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
				console.debug('[AlphaTab] Metronome tick:', midiEvent.metronomeNumerator);
			}
		});
	});

	// 初始检查
	setTimeout(updateAudioStatus, 500);
}
