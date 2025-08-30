// AudioPlayer.ts - 原生音频播放器组件，支持 alphaTab 官方外部音频同步
import { App } from "obsidian";
import * as alphaTab from "@coderline/alphatab";

export interface AudioPlayerOptions {
	app: App;
	onAudioCreated: (audioEl: HTMLAudioElement) => void;
	onTimeUpdate?: (currentTime: number, duration: number) => void;
	onPlay?: () => void;
	onPause?: () => void;
	onSeek?: (time: number) => void;
}

/**
 * 创建音频播放器组件，使用原生HTML5 audio元素
 * 实现与alphaTab的双向同步
 */
export function createAudioPlayer(options: AudioPlayerOptions): HTMLDivElement {
	const { onAudioCreated, onTimeUpdate, onPlay, onPause, onSeek } = options;

	// 创建主容器
	const container = document.createElement("div");
	container.className = "audio-player-container";
	// TO FIX: 避免在JavaScript中分配样式，应该将样式移到CSS中
	// 原因: 样式应该在CSS文件中定义，以便主题和代码片段更容易适应
	container.style.display = 'flex';
	container.style.alignItems = 'center';
	container.style.width = '100%';
	container.style.gap = '8px';

	// 创建audio元素
	const audio = document.createElement("audio");
	audio.id = `alphatab-audio-player-${Date.now()}`;
	audio.controls = true;
	// TO FIX: 避免在JavaScript中分配样式，应该将样式移到CSS中
	// 原因: 样式应该在CSS文件中定义，以便主题和代码片段更容易适应
	audio.style.width = '100%';
	audio.style.height = '32px';

	// 添加事件监听器
	audio.addEventListener('timeupdate', () => {
		if (onTimeUpdate) {
			onTimeUpdate(audio.currentTime * 1000, audio.duration * 1000);
		}
	});

	audio.addEventListener('play', () => {
		if (onPlay) onPlay();
	});

	audio.addEventListener('pause', () => {
		if (onPause) onPause();
	});

	audio.addEventListener('seeked', () => {
		if (onSeek) onSeek(audio.currentTime * 1000);
	});

	// 将audio元素添加到容器
	container.appendChild(audio);

	// 通知父组件audio元素已创建
	setTimeout(() => {
		onAudioCreated(audio);
	}, 0);

	return container;
}

/**
 * 设置alphaTab与audio元素的双向同步
 */
export function setupAlphaTabAudioSync(
	api: alphaTab.AlphaTabApi,
	audio: HTMLAudioElement
): void {
	// 设置播放器模式为外部媒体控制
	api.settings.player.playerMode = alphaTab.PlayerMode.EnabledExternalMedia;
	api.updateSettings();

	// 设置外部媒体处理器 (alphaTab -> audio)
	const handler: alphaTab.synth.IExternalMediaHandler = {
		get backingTrackDuration() {
			const duration = audio.duration;
			return Number.isFinite(duration) ? duration * 1000 : 0;
		},
		get playbackRate() {
			return audio.playbackRate;
		},
		set playbackRate(value) {
			audio.playbackRate = value;
		},
		get masterVolume() {
			return audio.volume;
		},
		set masterVolume(value) {
			audio.volume = value;
		},
		seekTo(time) {
			audio.currentTime = time / 1000;
		},
		play() {
			audio.play().catch(e => console.error("Audio play failed:", e));
		},
		pause() {
			audio.pause();
		}
	};

	// 设置处理器
	(api.player!.output as alphaTab.synth.IExternalMediaSynthOutput).handler = handler;

	console.debug("[AudioPlayer] AlphaTab audio synchronization setup completed");
}

/**
 * 设置audio元素的事件监听器 (audio -> alphaTab)
 */
export function setupAudioEventListeners(
	api: alphaTab.AlphaTabApi,
	audio: HTMLAudioElement,
	updateTimerRef: { current: number }
): void {
	// 清理旧的定时器
	if (updateTimerRef.current) {
		window.clearInterval(updateTimerRef.current);
	}

	// 时间更新处理函数
	const onTimeUpdate = () => {
		(api.player!.output as alphaTab.synth.IExternalMediaSynthOutput).updatePosition(
			audio.currentTime * 1000
		);
	};

	// 播放状态处理函数
	const onPlay = () => {
		api.play();
		// 使用定时器保证高频次的位置更新，让光标移动更平滑
		updateTimerRef.current = window.setInterval(onTimeUpdate, 50);
	};

	const onPauseOrEnd = () => {
		api.pause();
		if (updateTimerRef.current) {
			window.clearInterval(updateTimerRef.current);
			updateTimerRef.current = 0;
		}
	};

	// 移除旧的事件监听器
	audio.removeEventListener('timeupdate', onTimeUpdate);
	audio.removeEventListener('seeked', onTimeUpdate);
	audio.removeEventListener('play', onPlay);
	audio.removeEventListener('pause', onPauseOrEnd);
	audio.removeEventListener('ended', onPauseOrEnd);
	audio.removeEventListener('volumechange', onVolumeChange);
	audio.removeEventListener('ratechange', onRateChange);

	// 添加新的事件监听器
	audio.addEventListener('timeupdate', onTimeUpdate);
	audio.addEventListener('seeked', onTimeUpdate);
	audio.addEventListener('play', onPlay);
	audio.addEventListener('pause', onPauseOrEnd);
	audio.addEventListener('ended', onPauseOrEnd);
	audio.addEventListener('volumechange', onVolumeChange);
	audio.addEventListener('ratechange', onRateChange);

	console.debug("[AudioPlayer] Audio event listeners setup completed");
}

// 音量和播放速度变化处理函数
function onVolumeChange(this: HTMLAudioElement) {
	// 这里可以添加音量变化的处理逻辑
	console.debug("[AudioPlayer] Volume changed:", this.volume);
}

function onRateChange(this: HTMLAudioElement) {
	// 这里可以添加播放速度变化的处理逻辑
	console.debug("[AudioPlayer] Playback rate changed:", this.playbackRate);
}
