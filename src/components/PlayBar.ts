// PlayBar.ts - 底部固定播放栏组件
import { App, setIcon } from "obsidian";
import { createProgressBar } from "./ProgressBar";
import type { ProgressBarElement } from "./ProgressBar.types";
import { createAudioPlayer, AudioPlayerOptions } from "./AudioPlayer";
import * as alphaTab from "@coderline/alphatab";

export interface PlayBarOptions {
	app: App;
	eventBus: { publish: (event: string, payload?: unknown) => void };
	initialPlaying?: boolean;
	getCurrentTime?: () => number; // 获取当前播放时间（毫秒）
	getDuration?: () => number; // 获取总时长（毫秒）
	seekTo?: (position: number) => void; // 跳转到指定位置（毫秒）
	onAudioCreated: (audioEl: HTMLAudioElement) => void; // 新增
	audioPlayerOptions?: Partial<AudioPlayerOptions>; // 可选，透传给 AudioPlayer
}

// 通过此常量控制要加载哪些组件
const ENABLED_COMPONENTS = ["playButton"];

export function createPlayBar(options: PlayBarOptions): HTMLDivElement {
	const {
		app,
		eventBus,
		initialPlaying = false,
		getCurrentTime = () => 0,
		getDuration = () => 0,
		seekTo = () => {},
	} = options;

	let playing = initialPlaying;
	let metronomeOn = false;
	let countInOn = false;

	const bar = document.createElement("div");
	bar.className = "play-bar nav-buttons-container";

    // 控件引用
    let playPauseBtn: HTMLButtonElement | null = null;
    let stopBtn: HTMLButtonElement | null = null;
    let metronomeBtn: HTMLButtonElement | null = null;
    let countInBtn: HTMLButtonElement | null = null;
    let openSettingsBtn: HTMLButtonElement | null = null;

	// 内部函数
	function updatePlayPauseButton() {
		if (!playPauseBtn) return;
		playPauseBtn.innerHTML = "";
		const iconSpan = document.createElement("span");
		setIcon(iconSpan, playing ? "pause" : "play");
		playPauseBtn.appendChild(iconSpan);
		playPauseBtn.setAttribute("aria-label", playing ? "暂停" : "播放");
	}

	function updateMetronomeBtn() {
		if (!metronomeBtn) return;
		metronomeBtn.innerHTML = "";
		const iconSpan = document.createElement("span");
		setIcon(iconSpan, "lucide-music-2");
		metronomeBtn.appendChild(iconSpan);
		metronomeBtn.setAttribute(
			"aria-label",
			metronomeOn ? "关闭节拍器" : "开启节拍器"
		);
		metronomeBtn.classList.toggle("is-active", metronomeOn);
	}

	function updateCountInBtn() {
		if (!countInBtn) return;
		countInBtn.innerHTML = "";
		const iconSpan = document.createElement("span");
		setIcon(iconSpan, countInOn ? "lucide-timer" : "lucide-timer-off");
		countInBtn.appendChild(iconSpan);
		countInBtn.setAttribute(
			"aria-label",
			countInOn ? "关闭预备拍" : "开启预备拍"
		);
		countInBtn.classList.toggle("is-active", countInOn);
	}

    if (ENABLED_COMPONENTS.includes("playButton")) {
		// 播放/暂停按钮
		playPauseBtn = document.createElement("button");
		playPauseBtn.className = "clickable-icon";
		playPauseBtn.setAttribute("type", "button");
		updatePlayPauseButton();
		playPauseBtn.onclick = () => {
			playing = !playing;
			if (eventBus) {
				eventBus.publish("命令:播放暂停");
			}
			updatePlayPauseButton();
		};
        bar.appendChild(playPauseBtn);

		// 停止按钮
		stopBtn = document.createElement("button");
		stopBtn.className = "clickable-icon";
		stopBtn.setAttribute("type", "button");
		const stopIcon = document.createElement("span");
		setIcon(stopIcon, "square");
		stopBtn.appendChild(stopIcon);
		stopBtn.setAttribute("aria-label", "停止");
		stopBtn.onclick = () => {
			playing = false;
			if (eventBus) {
				eventBus.publish("命令:停止");
			}
			updatePlayPauseButton();
		};
        bar.appendChild(stopBtn);

		// 选择音轨按钮
		const tracksBtn = document.createElement("button");
		tracksBtn.className = "clickable-icon";
		tracksBtn.setAttribute("type", "button");
		const tracksIcon = document.createElement("span");
		// 使用 lucide 图标，代表多图层/多音轨
		setIcon(tracksIcon, "lucide-layers");
		tracksBtn.appendChild(tracksIcon);
		tracksBtn.setAttribute("aria-label", "选择音轨");
		tracksBtn.onclick = () => {
			if (eventBus) {
				eventBus.publish("命令:选择音轨");
			}
        };
        bar.appendChild(tracksBtn);

        // 刷新播放器按钮
        const refreshBtn = document.createElement("button");
        refreshBtn.className = "clickable-icon";
        refreshBtn.setAttribute("type", "button");
        const refreshIcon = document.createElement("span");
        // 使用 lucide 刷新图标
        setIcon(refreshIcon, "lucide-refresh-ccw");
        refreshBtn.appendChild(refreshIcon);
        refreshBtn.setAttribute("aria-label", "刷新播放器");
        refreshBtn.onclick = () => {
            if (eventBus) {
                eventBus.publish("命令:重新构造AlphaTabApi");
            }
        };
        bar.appendChild(refreshBtn);

        // 打开设置按钮
        openSettingsBtn = document.createElement("button");
        openSettingsBtn.className = "clickable-icon";
        openSettingsBtn.setAttribute("type", "button");
        const settingsIcon = document.createElement("span");
        setIcon(settingsIcon, "settings");
        openSettingsBtn.appendChild(settingsIcon);
        openSettingsBtn.setAttribute("aria-label", "打开设置");
        openSettingsBtn.onclick = () => {
            try {
                // @ts-ignore Obsidian command id for settings
                app.commands.executeCommandById('app:open-settings');
                // 聚焦到插件页签
                setTimeout(() => {
                    try {
                        const search = document.querySelector('input.setting-search-input') as HTMLInputElement | null;
                        if (search) {
                            search.value = 'Tab Flow';
                            const ev = new Event('input', { bubbles: true });
                            search.dispatchEvent(ev);
                        }
                    } catch {}
                }, 100);
            } catch {}
        };
        bar.appendChild(openSettingsBtn);

		// 节拍器按钮
		metronomeBtn = document.createElement("button");
		metronomeBtn.className = "clickable-icon";
		metronomeBtn.setAttribute("type", "button");
		updateMetronomeBtn();
		metronomeBtn.onclick = () => {
			metronomeOn = !metronomeOn;
			if (eventBus) {
				eventBus.publish("命令:设置节拍器", metronomeOn);
			}
			updateMetronomeBtn();
		};
        bar.appendChild(metronomeBtn);

		// 预备拍按钮
		countInBtn = document.createElement("button");
		countInBtn.className = "clickable-icon";
		countInBtn.setAttribute("type", "button");
		updateCountInBtn();
		countInBtn.onclick = () => {
			countInOn = !countInOn;
			if (eventBus) {
				eventBus.publish("命令:设置预备拍", countInOn);
			}
			updateCountInBtn();
		};
        bar.appendChild(countInBtn);
	}

    // 进度/播放器区域与时间显示（可选，直接追加到 bar）
    let progressBar: ProgressBarElement | null = null;
    let currentTimeDisplay: HTMLSpanElement | null = null;
    let totalTimeDisplay: HTMLSpanElement | null = null;
    if (ENABLED_COMPONENTS.includes("progressBar")) {
        currentTimeDisplay = document.createElement("span");
        currentTimeDisplay.className = "play-time current-time";
        currentTimeDisplay.textContent = "0:00";
        bar.appendChild(currentTimeDisplay);

        progressBar = createProgressBar({
            getCurrentTime,
            getDuration,
            seekTo,
        }) as ProgressBarElement;
        // 外层容器简化为进度条容器
        bar.appendChild(progressBar);

        totalTimeDisplay = document.createElement("span");
        totalTimeDisplay.className = "play-time total-time";
        totalTimeDisplay.textContent = "0:00";
        bar.appendChild(totalTimeDisplay);
    } else if (ENABLED_COMPONENTS.includes("audioPlayer")) {
        // 创建并嵌入原生 <audio> 播放器
        const audioContainer = createAudioPlayer({
            app: options.app,
            onAudioCreated: options.onAudioCreated,
            ...(options.audioPlayerOptions || {}),
        } as AudioPlayerOptions);
        bar.appendChild(audioContainer);
    }

	// 1. 速度选择器
	const speedLabel = document.createElement("label");
	speedLabel.innerText = "速度:";
    bar.appendChild(speedLabel);

	const speedSelect = document.createElement("select");
	["0.5", "0.75", "1.0", "1.25", "1.5", "2.0"].forEach((val) => {
		const opt = document.createElement("option");
		opt.value = val;
		opt.innerText = val + "x";
		if (val === "1.0") opt.selected = true;
		speedSelect.appendChild(opt);
	});
	speedSelect.onchange = () => {
		if (eventBus)
			eventBus.publish("命令:设置速度", parseFloat(speedSelect.value));
	};
    bar.appendChild(speedSelect);

	// 2. 布局模式选择器
	const layoutLabel = document.createElement("label");
	layoutLabel.innerText = "布局:";
	layoutLabel.style.marginLeft = "1em";
    bar.appendChild(layoutLabel);

	const layoutSelect = document.createElement("select");
	const layoutModes = [
		{ name: "页面", value: alphaTab.LayoutMode.Page },
		{ name: "横向", value: alphaTab.LayoutMode.Horizontal },
	];
	layoutModes.forEach((item) => {
		const opt = document.createElement("option");
		opt.value = String(item.value);
		opt.innerText = item.name;
		layoutSelect.appendChild(opt);
	});
	layoutSelect.onchange = () => {
		if (eventBus)
			eventBus.publish("命令:切换布局", parseInt(layoutSelect.value));
	};
    bar.appendChild(layoutSelect);

	// 3. 谱表模式选择器
	const staveLabel = document.createElement("label");
	staveLabel.innerText = "谱表:";
	staveLabel.style.marginLeft = "1em";
    bar.appendChild(staveLabel);

	const staveSelect = document.createElement("select");
	const staveProfiles = [
		{ name: "五线+六线", value: alphaTab.StaveProfile.ScoreTab },
		{ name: "仅五线谱", value: alphaTab.StaveProfile.Score },
		{ name: "仅六线谱", value: alphaTab.StaveProfile.Tab },
		{ name: "混合六线谱", value: alphaTab.StaveProfile.TabMixed },
	];
	staveProfiles.forEach((item) => {
		const opt = document.createElement("option");
		opt.value = String(item.value);
		opt.innerText = item.name;
		staveSelect.appendChild(opt);
	});
	staveSelect.onchange = () => {
		if (eventBus) eventBus.publish("命令:设置谱表", parseInt(staveSelect.value));
	};
    bar.appendChild(staveSelect);

	// 4. 缩放选择器
	const zoomLabel = document.createElement("label");
	zoomLabel.innerText = "缩放:";
	zoomLabel.style.marginLeft = "1em";
    bar.appendChild(zoomLabel);

	const zoomSelect = document.createElement("select");
	[
		{ label: "50%", value: 0.5 },
		{ label: "75%", value: 0.75 },
		{ label: "100%", value: 1 },
		{ label: "125%", value: 1.25 },
		{ label: "150%", value: 1.5 },
		{ label: "200%", value: 2 },
	].forEach(({ label, value }) => {
		const opt = document.createElement("option");
		opt.value = value.toString();
		opt.innerText = label;
		if (value === 1) opt.selected = true;
		zoomSelect.appendChild(opt);
	});
	zoomSelect.onchange = () => {
		if (eventBus)
			eventBus.publish("命令:设置缩放", parseFloat(zoomSelect.value));
	};
    bar.appendChild(zoomSelect);

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
