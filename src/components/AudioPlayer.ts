// AudioPlayer.ts - 原生音频播放器组件，支持 alphaTab 官方外部音频同步
import { App } from "obsidian";

export interface AudioPlayerOptions {
	app: App;
	/**
	 * 当 audio 元素创建后回调
	 */
	onAudioCreated?: (audioEl: HTMLAudioElement) => void;
	/**
	 * 可选：音频源（URL 或 Blob）
	 */
	src?: string;
	/**
	 * 可选：audio 元素额外属性
	 */
	audioAttributes?: Partial<HTMLAudioElement>;
}

/**
 * 创建一个原生 <audio> 播放器，支持 alphaTab 官方外部音频同步方案
 */
export function createAudioPlayer(options: AudioPlayerOptions): HTMLDivElement {
	const { onAudioCreated, src, audioAttributes } = options;

	// 主容器
	const container = document.createElement("div");
	container.className = "audio-player-container";
	container.style.display = "flex";
	container.style.alignItems = "center";
	container.style.width = "100%";

	// 创建 audio 元素
	const audio = document.createElement("audio");
	audio.controls = true;
	audio.style.width = "100%";
	audio.id = `audio-element-${Date.now()}`;
	if (src) audio.src = src;
	if (audioAttributes) {
		Object.assign(audio, audioAttributes);
	}

	container.appendChild(audio);

	// 回调
	if (onAudioCreated) {
		setTimeout(() => onAudioCreated(audio), 0);
	}

	return container;
}
