// PlayBar.ts - 底部固定播放栏组件
import { App, setIcon } from "obsidian";
import { createProgressBar } from "./ProgressBar";
import type { ProgressBarElement } from "./ProgressBar.types";
import { createAudioPlayer, AudioPlayerOptions } from "./AudioPlayer";

export interface PlayBarOptions {
	app: App;
	onPlayPause: () => void;
	initialPlaying?: boolean;
	getCurrentTime?: () => number; // 获取当前播放时间（毫秒）
	getDuration?: () => number; // 获取总时长（毫秒）
	seekTo?: (position: number) => void; // 跳转到指定位置（毫秒）
	onAudioCreated: (audioEl: HTMLAudioElement) => void; // 新增
	audioPlayerOptions?: Partial<AudioPlayerOptions>; // 可选，透传给 AudioPlayer
}

// 通过此常量控制要加载哪些组件
// const ENABLED_COMPONENTS = ["playButton", "progressBar"];
const ENABLED_COMPONENTS = ["playButton"];

export function createPlayBar(options: PlayBarOptions): HTMLDivElement {
	const {
		onPlayPause,
		initialPlaying = false,
		getCurrentTime = () => 0,
		getDuration = () => 0,
		seekTo = () => {},
	} = options;
	let playing = initialPlaying;

	const bar = document.createElement("div");
	bar.className = "play-bar nav-buttons-container";

	// 左侧控制区
	let leftSection: HTMLDivElement | null = null;
	let playPauseBtn: HTMLButtonElement | null = null;
	if (ENABLED_COMPONENTS.includes("playButton")) {
		leftSection = document.createElement("div");
		leftSection.className = "play-bar-section play-controls";
		bar.appendChild(leftSection);

		playPauseBtn = document.createElement("button");
		playPauseBtn.className = "clickable-icon";
		playPauseBtn.setAttribute("type", "button");

		function updatePlayPauseButton() {
			playPauseBtn!.innerHTML = "";
			const iconSpan = document.createElement("span");
			setIcon(iconSpan, playing ? "pause" : "play");
			playPauseBtn!.appendChild(iconSpan);
			playPauseBtn!.setAttribute("aria-label", playing ? "暂停" : "播放");
		}
		updatePlayPauseButton();

		playPauseBtn.addEventListener("click", () => {
			playing = !playing;
			onPlayPause();
			updatePlayPauseButton();
			updateProgressInterval();
		});
		leftSection.appendChild(playPauseBtn);
	}

	// 中间进度条区域
	let centerSection: HTMLDivElement | null = null;
	let progressBar: ProgressBarElement | null = null;
	let currentTimeDisplay: HTMLSpanElement | null = null;
	let totalTimeDisplay: HTMLSpanElement | null = null;
	if (ENABLED_COMPONENTS.includes("progressBar")) {
		centerSection = document.createElement("div");
		centerSection.className = "play-bar-section play-progress-container";

		currentTimeDisplay = document.createElement("span");
		currentTimeDisplay.className = "play-time current-time";
		currentTimeDisplay.textContent = "0:00";
		centerSection.appendChild(currentTimeDisplay);

		progressBar = createProgressBar({
			getCurrentTime,
			getDuration,
			seekTo,
		}) as ProgressBarElement;
		centerSection.appendChild(progressBar);

		totalTimeDisplay = document.createElement("span");
		totalTimeDisplay.className = "play-time total-time";
		totalTimeDisplay.textContent = "0:00";
		centerSection.appendChild(totalTimeDisplay);

		bar.appendChild(centerSection);
	}

	// 右侧状态区（可选）
	const rightSection = document.createElement("div");
	rightSection.className = "play-bar-section play-status";
	bar.appendChild(rightSection);

	// 格式化时间显示（毫秒 -> mm:ss）
	function formatTime(ms: number): string {
		if (isNaN(ms) || ms < 0) return "0:00";
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	}

	// 更新进度条显示
	function updateProgress(
		currentTimeOverride?: number,
		durationOverride?: number
	) {
		if (!progressBar || !currentTimeDisplay || !totalTimeDisplay) return;
		try {
			const currentTime =
				currentTimeOverride !== undefined
					? currentTimeOverride
					: getCurrentTime();
			const duration =
				durationOverride !== undefined
					? durationOverride
					: getDuration();
			currentTimeDisplay.textContent = formatTime(currentTime);
			totalTimeDisplay.textContent = formatTime(duration);
			progressBar.updateProgress(currentTime, duration);
		} catch (error) {
			console.error("[PlayBar] 更新进度条出错:", error);
		}
	}

	function updateProgressInterval() {
		updateProgress();
	}

	// 初始化进度显示
	updateProgress();

	if (playing) {
		updateProgressInterval();
	}

	const originalRemove = bar.remove;
	bar.remove = function () {
		originalRemove.call(bar);
	};

	return bar;
}
