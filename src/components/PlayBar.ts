// PlayBar.ts - 底部固定播放栏组件
import { App, setIcon } from "obsidian";
import { createProgressBar } from "./ProgressBar";
import type { ProgressBarElement } from "./ProgressBar.types";

export interface PlayBarOptions {
	app: App;
	onPlayPause: () => void;
	initialPlaying?: boolean;
	getCurrentTime?: () => number; // 获取当前播放时间（毫秒）
	getDuration?: () => number; // 获取总时长（毫秒）
	seekTo?: (position: number) => void; // 跳转到指定位置（毫秒）
}

/**
 * 创建底部固定的播放栏，使用 Obsidian 原生风格
 */

export function createPlayBar(options: PlayBarOptions): HTMLDivElement {
	const {
		onPlayPause,
		initialPlaying = false,
		getCurrentTime = () => 0,
		getDuration = () => 0,
		seekTo = () => {},
	} = options;
	let playing = initialPlaying;

	// 创建主容器
	const bar = document.createElement("div");
	bar.className = "play-bar nav-buttons-container";

	// 左侧控制区
	const leftSection = document.createElement("div");
	leftSection.className = "play-bar-section play-controls";
	bar.appendChild(leftSection);

	// 播放/暂停按钮 (自定义样式)
	const playPauseBtn = document.createElement("button");
	playPauseBtn.className = "clickable-icon";
	playPauseBtn.setAttribute("type", "button");
	playPauseBtn.setAttribute("aria-label", "播放/暂停");

	// 初始图标和文本
	updatePlayPauseButton();

	playPauseBtn.addEventListener("click", () => {
		playing = !playing;
		onPlayPause();
		updatePlayPauseButton();
		updateProgressInterval();
	});
	leftSection.appendChild(playPauseBtn);

	// 创建中间部分 - 进度条区域
	const centerSection = document.createElement("div");
	centerSection.className = "play-bar-section play-progress-container";

	// 时间显示 - 当前时间
	const currentTimeDisplay = document.createElement("span");
	currentTimeDisplay.className = "play-time current-time";
	currentTimeDisplay.textContent = "0:00";
	centerSection.appendChild(currentTimeDisplay);

	// 使用独立的 ProgressBar 组件
	const progressBar = createProgressBar({
		getCurrentTime,
		getDuration,
		seekTo
	}) as ProgressBarElement;
	centerSection.appendChild(progressBar);

	// 时间显示 - 总时长
	const totalTimeDisplay = document.createElement("span");
	totalTimeDisplay.className = "play-time total-time";
	totalTimeDisplay.textContent = "0:00";
	centerSection.appendChild(totalTimeDisplay);

	// 添加中间部分到主容器
	bar.appendChild(centerSection);

	// 右侧状态区 (可添加音量等)
	const rightSection = document.createElement("div");
	rightSection.className = "play-bar-section play-status";
	bar.appendChild(rightSection);

	// 更新播放/暂停按钮图标和文本
	function updatePlayPauseButton() {
		playPauseBtn.innerHTML = "";
		const iconSpan = document.createElement("span");
		setIcon(iconSpan, playing ? "pause" : "play");
		playPauseBtn.appendChild(iconSpan);
		playPauseBtn.setAttribute("aria-label", playing ? "暂停" : "播放");
	}

	// 格式化时间显示（毫秒 -> mm:ss）
	function formatTime(ms: number): string {
		if (isNaN(ms) || ms < 0) return "0:00";
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	}

	// 更新进度条显示（调用子组件方法）
	function updateProgress(currentTimeOverride?: number, durationOverride?: number) {
		try {
			const currentTime = currentTimeOverride !== undefined ? currentTimeOverride : getCurrentTime();
			const duration = durationOverride !== undefined ? durationOverride : getDuration();
			// 更新时间显示
			currentTimeDisplay.textContent = formatTime(currentTime);
			totalTimeDisplay.textContent = formatTime(duration);
			// 调用进度条组件的 updateProgress 方法
			progressBar.updateProgress(currentTime, duration);
		} catch (error) {
			console.error("[PlayBar] 更新进度条出错:", error);
		}
	}

	// 设置/取消进度更新定时器 - 简化版本，依赖外部事件更新
	function updateProgressInterval() {
		// 无论如何都立即更新一次
		updateProgress();
	}

	// ...进度条事件已由 ProgressBar 组件内部处理...

	// 初始化进度显示
	updateProgress();

	// 如果初始状态是播放，启动进度更新
	if (playing) {
		updateProgressInterval();
	}

	// 在组件卸载时清理
	const originalRemove = bar.remove;
	bar.remove = function () {
		originalRemove.call(bar);
	};

	return bar;
}
