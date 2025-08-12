
// PlayBar.ts - 底部固定播放栏组件
import { App } from "obsidian";

export interface PlayBarOptions {
	app: App;
	onPlayPause: () => void;
	isPlaying: () => boolean;
}

/**
 * 创建底部固定的播放栏
 */
export function createPlayBar(options: PlayBarOptions): HTMLDivElement {
	const { onPlayPause, isPlaying } = options;
	const bar = document.createElement("div");
	bar.className = "play-bar";

	// 播放/暂停按钮
	const playPauseBtn = document.createElement("button");
	playPauseBtn.className = "play-bar-btn play-pause";
	playPauseBtn.innerHTML = getPlayPauseIcon(isPlaying());
	playPauseBtn.onclick = () => {
		onPlayPause();
		playPauseBtn.innerHTML = getPlayPauseIcon(isPlaying());
	};
	bar.appendChild(playPauseBtn);

	// 可扩展：后续可添加进度条、音量等

	return bar;
}

function getPlayPauseIcon(isPlaying: boolean): string {
	// lucide icons SVG
	if (isPlaying) {
		// Pause icon
		return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' stroke='currentColor' fill='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-pause' viewBox='0 0 24 24'><rect x='6' y='4' width='4' height='16' rx='1'/><rect x='14' y='4' width='4' height='16' rx='1'/></svg>`;
	} else {
		// Play icon
		return `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' stroke='currentColor' fill='none' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-play' viewBox='0 0 24 24'><polygon points='5 3 19 12 5 21 5 3'/></svg>`;
	}
}
