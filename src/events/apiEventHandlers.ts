import * as alphaTab from '@coderline/alphatab';

export function registerApiEventHandlers(
	api: alphaTab.AlphaTabApi,
	audioStatus: HTMLSpanElement,
	isAudioLoaded: () => boolean
): void {
	// 更新音频状态显示
	const updateAudioStatus = () => {
		if (!api) {
			audioStatus.innerText = '音频：API未初始化';
			audioStatus.style.color = 'red';
			return;
		}
		if (!api.player) {
			audioStatus.innerText = '音频：播放器未初始化';
			audioStatus.style.color = 'red';
			return;
		}
		if (isAudioLoaded()) {
			audioStatus.innerText = '音频：已加载';
			audioStatus.style.color = 'green';
		} else {
			audioStatus.innerText = '音频：加载中...';
			audioStatus.style.color = 'orange';
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
