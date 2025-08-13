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
    let layoutMode: number = alphaTab.LayoutMode.Page;

	const bar = document.createElement("div");
	bar.className = "play-bar nav-buttons-container";

    // 控件引用
    let playPauseBtn: HTMLButtonElement | null = null;
    let stopBtn: HTMLButtonElement | null = null;
    let metronomeBtn: HTMLButtonElement | null = null;
    let countInBtn: HTMLButtonElement | null = null;
    let openSettingsBtn: HTMLButtonElement | null = null;
    let locateCursorBtn: HTMLButtonElement | null = null;
    let layoutToggleBtn: HTMLButtonElement | null = null;
    let exportChooserBtn: HTMLButtonElement | null = null;
    let toTopBtn: HTMLButtonElement | null = null;
    let toBottomBtn: HTMLButtonElement | null = null;

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

    function updateLayoutToggleBtn() {
        if (!layoutToggleBtn) return;
        layoutToggleBtn.innerHTML = "";
        const iconSpan = document.createElement("span");
        const isHorizontal = layoutMode === alphaTab.LayoutMode.Horizontal;
        setIcon(iconSpan, isHorizontal ? "lucide-panels-top-left" : "lucide-layout");
        layoutToggleBtn.appendChild(iconSpan);
        layoutToggleBtn.setAttribute("aria-label", isHorizontal ? "布局: 横向" : "布局: 页面");
        layoutToggleBtn.classList.toggle("is-active", isHorizontal);
    }

    // 从全局设置读取可见性（若获取失败则全部显示）
    let visibility: any = undefined;
    try {
        // @ts-ignore - 通过全局 app.plugins 获取本插件实例
        const pluginId = 'tab-flow';
        const plugin = (app as any)?.plugins?.getPlugin?.(pluginId);
        visibility = plugin?.settings?.playBar?.components;
    } catch {}

    const show = (key: string, defaultValue = true): boolean => {
        if (!visibility) return defaultValue;
        const v = visibility[key];
        return typeof v === 'boolean' ? v : defaultValue;
    };

    if (show("playPause")) {
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
        if (show("tracks")) {
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
        }

        // 刷新播放器按钮
        if (show("refresh")) {
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
        }

        // 滚动到光标
        if (show("locateCursor")) {
        locateCursorBtn = document.createElement("button");
        locateCursorBtn.className = "clickable-icon";
        locateCursorBtn.setAttribute("type", "button");
        const locateIcon = document.createElement("span");
        setIcon(locateIcon, "lucide-crosshair");
        locateCursorBtn.appendChild(locateIcon);
        locateCursorBtn.setAttribute("aria-label", "滚动到光标");
        locateCursorBtn.onclick = () => {
            if (eventBus) {
                eventBus.publish("命令:滚动到光标");
            }
        };
        bar.appendChild(locateCursorBtn);
        }

        // 布局切换（Page <-> Horizontal）
        if (show("layoutToggle")) {
        layoutToggleBtn = document.createElement("button");
        layoutToggleBtn.className = "clickable-icon";
        layoutToggleBtn.setAttribute("type", "button");
        updateLayoutToggleBtn();
        layoutToggleBtn.onclick = () => {
            layoutMode = layoutMode === alphaTab.LayoutMode.Page
                ? alphaTab.LayoutMode.Horizontal
                : alphaTab.LayoutMode.Page;
            if (eventBus) {
                eventBus.publish("命令:切换布局", layoutMode);
            }
            updateLayoutToggleBtn();
        };
        bar.appendChild(layoutToggleBtn);
        }

        // 导出：统一选择器（弹出导出模态框）
        if (show("exportMenu")) {
        exportChooserBtn = document.createElement("button");
        exportChooserBtn.className = "clickable-icon";
        exportChooserBtn.setAttribute("type", "button");
        const exportIcon = document.createElement("span");
        setIcon(exportIcon, "lucide-download");
        exportChooserBtn.appendChild(exportIcon);
        exportChooserBtn.setAttribute("aria-label", "导出");
        exportChooserBtn.onclick = () => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { ExportChooserModal } = require("./ExportChooserModal");
                const getTitle = () => {
                    try {
                        // 视图会设置 score.filePath 与标题，但此处只作为模态展示用途
                        return (document.querySelector('.view-header-title')?.textContent || '').trim() || 'Untitled';
                    } catch { return 'Untitled'; }
                };
                new ExportChooserModal({ app, eventBus, getFileName: getTitle }).open();
            } catch (e) {
                console.error('[PlayBar] 打开导出选择器失败:', e);
            }
        };
        bar.appendChild(exportChooserBtn);
        }

        // 回到顶部
        if (show("toTop")) {
        toTopBtn = document.createElement("button");
        toTopBtn.className = "clickable-icon";
        toTopBtn.setAttribute("type", "button");
        const topIcon = document.createElement("span");
        setIcon(topIcon, "lucide-chevrons-up");
        toTopBtn.appendChild(topIcon);
        toTopBtn.setAttribute("aria-label", "回到顶部");
        toTopBtn.onclick = () => {
            if (eventBus) {
                eventBus.publish("命令:滚动到顶部");
            }
        };
        bar.appendChild(toTopBtn);
        }

        // 回到底部
        if (show("toBottom")) {
        toBottomBtn = document.createElement("button");
        toBottomBtn.className = "clickable-icon";
        toBottomBtn.setAttribute("type", "button");
        const bottomIcon = document.createElement("span");
        setIcon(bottomIcon, "lucide-chevrons-down");
        toBottomBtn.appendChild(bottomIcon);
        toBottomBtn.setAttribute("aria-label", "回到底部");
        toBottomBtn.onclick = () => {
            if (eventBus) {
                eventBus.publish("命令:滚动到底部");
            }
        };
        bar.appendChild(toBottomBtn);
        }

        // 打开设置按钮
        if (show("openSettings")) {
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
        }

		// 节拍器按钮
        if (show("metronome")) {
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
        }

		// 预备拍按钮
        if (show("countIn")) {
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
	}

    // 进度/播放器区域与时间显示（可选，直接追加到 bar）
    let progressBar: ProgressBarElement | null = null;
    let currentTimeDisplay: HTMLSpanElement | null = null;
    let totalTimeDisplay: HTMLSpanElement | null = null;
    if (show("progressBar", false)) {
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
    } else if (show("audioPlayer", false)) {
        // 创建并嵌入原生 <audio> 播放器
        const audioContainer = createAudioPlayer({
            app: options.app,
            onAudioCreated: options.onAudioCreated,
            ...(options.audioPlayerOptions || {}),
        } as AudioPlayerOptions);
        bar.appendChild(audioContainer);
    }

    // 1. 速度选择器
    if (show("speed")) {
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
    }

    // 布局模式下拉已移除，仅保留图标切换按钮

    // 3. 谱表模式选择器
    if (show("staveProfile")) {
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
    }

    // 4. 缩放选择器
    if (show("zoom")) {
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
    }

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
