// PlayBar.ts - 底部固定播放栏组件
import { App, setIcon } from 'obsidian';
import { createProgressBar } from './ProgressBar';
import type { ProgressBarElement } from './ProgressBar.types';
import { createAudioPlayer, AudioPlayerOptions } from './AudioPlayer';
import * as alphaTab from '@coderline/alphatab';
import { formatTime } from '../utils';
import { t } from '../i18n';

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

export function createEditorBar(options: PlayBarOptions): HTMLDivElement {
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

	const bar = document.createElement('div');
	bar.className = 'play-bar nav-buttons-container';

	// 控件引用
	let playPauseBtn: HTMLButtonElement | null = null;
	let stopBtn: HTMLButtonElement | null = null;
	let metronomeBtn: HTMLButtonElement | null = null;
	let countInBtn: HTMLButtonElement | null = null;
	let openSettingsBtn: HTMLButtonElement | null = null;
	// const locateCursorBtn: HTMLButtonElement | null = null; // Not used
	let layoutToggleBtn: HTMLButtonElement | null = null;
	let exportChooserBtn: HTMLButtonElement | null = null;
	// const toTopBtn: HTMLButtonElement | null = null; // Not used
	// const toBottomBtn: HTMLButtonElement | null = null; // Not used

	// 内部函数
	function updatePlayPauseButton() {
		if (!playPauseBtn) return;
		// 使用 DOM API 替代 innerHTML，避免安全风险
		while (playPauseBtn.firstChild) {
			playPauseBtn.removeChild(playPauseBtn.firstChild);
		}
		const iconSpan = document.createElement('span');
		setIcon(iconSpan, playing ? 'pause' : 'play');
		playPauseBtn.appendChild(iconSpan);
		playPauseBtn.setAttribute('aria-label', playing ? t('playback.pause') : t('playback.play'));
	}

	function updateMetronomeBtn() {
		if (!metronomeBtn) return;
		// 使用 DOM API 替代 innerHTML，避免安全风险
		while (metronomeBtn.firstChild) {
			metronomeBtn.removeChild(metronomeBtn.firstChild);
		}
		const iconSpan = document.createElement('span');
		setIcon(iconSpan, 'lucide-music-2');
		metronomeBtn.appendChild(iconSpan);
		metronomeBtn.setAttribute(
			'aria-label',
			metronomeOn ? t('settings.disableMetronome') : t('settings.enableMetronome')
		);
		metronomeBtn.classList.toggle('is-active', metronomeOn);
	}

	function updateCountInBtn() {
		if (!countInBtn) return;
		// 使用 DOM API 替代 innerHTML，避免安全风险
		while (countInBtn.firstChild) {
			countInBtn.removeChild(countInBtn.firstChild);
		}
		const iconSpan = document.createElement('span');
		setIcon(iconSpan, countInOn ? 'lucide-timer' : 'lucide-timer-off');
		countInBtn.appendChild(iconSpan);
		countInBtn.setAttribute(
			'aria-label',
			countInOn ? t('settings.disableCountIn') : t('settings.enableCountIn')
		);
		countInBtn.classList.toggle('is-active', countInOn);
	}

	function updateLayoutToggleBtn() {
		if (!layoutToggleBtn) return;
		// 使用 DOM API 替代 innerHTML，避免安全风险
		while (layoutToggleBtn.firstChild) {
			layoutToggleBtn.removeChild(layoutToggleBtn.firstChild);
		}
		const iconSpan = document.createElement('span');
		const isHorizontal = layoutMode === alphaTab.LayoutMode.Horizontal;
		setIcon(iconSpan, isHorizontal ? 'lucide-panels-top-left' : 'lucide-layout');
		layoutToggleBtn.appendChild(iconSpan);
		layoutToggleBtn.setAttribute(
			'aria-label',
			isHorizontal ? t('settings.horizontalLayout') : t('settings.pageLayout')
		);
		layoutToggleBtn.classList.toggle('is-active', isHorizontal);
	}

	// 从运行期覆盖或全局设置读取可见性（覆盖优先）
	let visibility: Record<string, boolean> | undefined = undefined;
	let runtimeOverride:
		| { components?: Record<string, boolean>; order?: string[] | string }
		| undefined = undefined;
	let plugin: any = undefined;
	try {
		// @ts-ignore - 通过全局 app.plugins 获取本插件实例
		const pluginId = 'tab-flow';
		plugin = (app as any)?.plugins?.getPlugin?.(pluginId);
		visibility = plugin?.settings?.playBar?.components;
		runtimeOverride = plugin?.runtimeUiOverride;
	} catch {
		// Ignore plugin access errors
	}

	const show = (key: string, defaultValue = true): boolean => {
		const overrideVisible = runtimeOverride?.components?.[key];
		if (typeof overrideVisible === 'boolean') return overrideVisible;
		if (!visibility) return defaultValue;
		const v = visibility[key];
		return typeof v === 'boolean' ? v : defaultValue;
	};

	// ---------- 统一按顺序渲染组件 ----------
	let progressBar: ProgressBarElement | null = null;
	let currentTimeDisplay: HTMLSpanElement | null = null;
	let totalTimeDisplay: HTMLSpanElement | null = null;

	const defaultOrder = [
		'playPause',
		'stop',
		'metronome',
		'countIn',
		'tracks',
		'refresh',
		'locateCursor',
		'layoutToggle',
		'exportMenu',
		'toTop',
		'toBottom',
		'openSettings',
		'progressBar',
		'speed',
		'staveProfile',
		'zoom',
		'scrollMode',
		'audioPlayer',
	];

	let order: string[] = defaultOrder;
	try {
		const rawOrder =
			runtimeOverride?.order &&
			((Array.isArray(runtimeOverride.order) && runtimeOverride.order.length > 0) ||
				typeof runtimeOverride.order === 'string')
				? runtimeOverride.order
				: plugin?.settings?.playBar?.order;

		if (Array.isArray(rawOrder) && rawOrder.length > 0) {
			order = rawOrder as string[];
		} else if (typeof rawOrder === 'string' && rawOrder.trim().length > 0) {
			// 解析数字序列，例如 "2,1,3" -> 映射到默认键序列的索引
			const indices = rawOrder
				.split(',')
				.map((s) => parseInt(s.trim(), 10))
				.filter((n) => !isNaN(n));
			// 将 1 基或 0 基的索引都容忍：1..N 或 0..N-1
			const looksOneBased = indices.some((n) => n === 1) || indices.every((n) => n > 0);
			const normalized = indices
				.map((n) => (looksOneBased ? n - 1 : n))
				.filter((n) => n >= 0 && n < defaultOrder.length);
			if (normalized.length > 0) {
				order = normalized.map((i) => defaultOrder[i]);
				// 当使用数字序列时，默认只渲染这组组件：将其它组件视作隐藏
				const currentRuntimeOverride = runtimeOverride || {};
				const currentComponents = currentRuntimeOverride.components || {};
				const allowed = new Set(order);
				defaultOrder.forEach((k) => {
					if (!allowed.has(k)) currentComponents[k] = false;
				});
				// 确保已选择的键默认显示
				order.forEach((k) => (currentComponents[k] = true));
				currentRuntimeOverride.components = currentComponents;
				runtimeOverride = currentRuntimeOverride;
			}
		}
	} catch {
		// Ignore order parsing errors
	}

	const renderers: Record<string, () => void> = {
		playPause: () => {
			if (!show('playPause')) return;
			playPauseBtn = document.createElement('button');
			playPauseBtn.className = 'clickable-icon';
			playPauseBtn.setAttribute('type', 'button');
			updatePlayPauseButton();
			playPauseBtn.onclick = () => {
				playing = !playing;
				eventBus?.publish('命令:播放暂停');
				updatePlayPauseButton();
			};
			bar.appendChild(playPauseBtn);
		},
		stop: () => {
			if (!show('stop')) return;
			stopBtn = document.createElement('button');
			stopBtn.className = 'clickable-icon';
			stopBtn.setAttribute('type', 'button');
			const stopIcon = document.createElement('span');
			setIcon(stopIcon, 'square');
			stopBtn.appendChild(stopIcon);
			stopBtn.setAttribute('aria-label', t('playback.stop'));
			stopBtn.onclick = () => {
				playing = false;
				eventBus?.publish('命令:停止');
				updatePlayPauseButton();
			};
			bar.appendChild(stopBtn);
		},
		metronome: () => {
			if (!show('metronome')) return;
			metronomeBtn = document.createElement('button');
			metronomeBtn.className = 'clickable-icon';
			metronomeBtn.setAttribute('type', 'button');
			updateMetronomeBtn();
			metronomeBtn.onclick = () => {
				metronomeOn = !metronomeOn;
				eventBus?.publish('命令:设置节拍器', metronomeOn);
				updateMetronomeBtn();
			};
			bar.appendChild(metronomeBtn);
		},
		countIn: () => {
			if (!show('countIn')) return;
			countInBtn = document.createElement('button');
			countInBtn.className = 'clickable-icon';
			countInBtn.setAttribute('type', 'button');
			updateCountInBtn();
			countInBtn.onclick = () => {
				countInOn = !countInOn;
				eventBus?.publish('命令:设置预备拍', countInOn);
				updateCountInBtn();
			};
			bar.appendChild(countInBtn);
		},
		tracks: () => {
			if (!show('tracks')) return;
			const btn = document.createElement('button');
			btn.className = 'clickable-icon';
			btn.setAttribute('type', 'button');
			const icon = document.createElement('span');
			setIcon(icon, 'lucide-layers');
			btn.appendChild(icon);
			btn.setAttribute('aria-label', t('tracks.selectTracks'));
			btn.onclick = () => eventBus?.publish('命令:选择音轨');
			bar.appendChild(btn);
		},
		refresh: () => {
			if (!show('refresh')) return;
			const btn = document.createElement('button');
			btn.className = 'clickable-icon';
			btn.setAttribute('type', 'button');
			const icon = document.createElement('span');
			setIcon(icon, 'lucide-refresh-ccw');
			btn.appendChild(icon);
			btn.setAttribute('aria-label', t('navigation.refreshPlayer'));
			btn.onclick = () => eventBus?.publish('命令:重新构造AlphaTabApi');
			bar.appendChild(btn);
		},
		locateCursor: () => {
			if (!show('locateCursor')) return;
			const btn = document.createElement('button');
			btn.className = 'clickable-icon';
			btn.setAttribute('type', 'button');
			const icon = document.createElement('span');
			setIcon(icon, 'lucide-crosshair');
			btn.appendChild(icon);
			btn.setAttribute('aria-label', t('navigation.scrollToCursor'));
			btn.onclick = () => eventBus?.publish('命令:滚动到光标');
			bar.appendChild(btn);
		},
		layoutToggle: () => {
			if (!show('layoutToggle')) return;
			layoutToggleBtn = document.createElement('button');
			layoutToggleBtn.className = 'clickable-icon';
			layoutToggleBtn.setAttribute('type', 'button');
			updateLayoutToggleBtn();
			layoutToggleBtn.onclick = () => {
				layoutMode =
					layoutMode === alphaTab.LayoutMode.Page
						? alphaTab.LayoutMode.Horizontal
						: alphaTab.LayoutMode.Page;
				eventBus?.publish('命令:切换布局', layoutMode);
				updateLayoutToggleBtn();
			};
			bar.appendChild(layoutToggleBtn);
		},
		exportMenu: () => {
			if (!show('exportMenu')) return;
			exportChooserBtn = document.createElement('button');
			exportChooserBtn.className = 'clickable-icon';
			exportChooserBtn.setAttribute('type', 'button');
			const icon = document.createElement('span');
			setIcon(icon, 'lucide-download');
			exportChooserBtn.appendChild(icon);
			exportChooserBtn.setAttribute('aria-label', t('export.export'));
			exportChooserBtn.onclick = () => {
				try {
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					const { ExportChooserModal } = require('./ExportChooserModal');
					const getTitle = () => {
						try {
							return (
								(
									document.querySelector('.view-header-title')?.textContent || ''
								).trim() || 'Untitled'
							);
						} catch {
							return 'Untitled';
						}
					};
					new ExportChooserModal({ app, eventBus, getFileName: getTitle }).open();
				} catch (e) {
					console.error('[PlayBar] 打开导出选择器失败:', e);
				}
			};
			bar.appendChild(exportChooserBtn);
		},
		toTop: () => {
			if (!show('toTop')) return;
			const btn = document.createElement('button');
			btn.className = 'clickable-icon';
			btn.setAttribute('type', 'button');
			const icon = document.createElement('span');
			setIcon(icon, 'lucide-chevrons-up');
			btn.appendChild(icon);
			btn.setAttribute('aria-label', t('navigation.toTop'));
			btn.onclick = () => eventBus?.publish('命令:滚动到顶部');
			bar.appendChild(btn);
		},
		toBottom: () => {
			if (!show('toBottom')) return;
			const btn = document.createElement('button');
			btn.className = 'clickable-icon';
			btn.setAttribute('type', 'button');
			const icon = document.createElement('span');
			setIcon(icon, 'lucide-chevrons-down');
			btn.appendChild(icon);
			btn.setAttribute('aria-label', t('navigation.toBottom'));
			btn.onclick = () => eventBus?.publish('命令:滚动到底部');
			bar.appendChild(btn);
		},
		openSettings: () => {
			if (!show('openSettings')) return;
			openSettingsBtn = document.createElement('button');
			openSettingsBtn.className = 'clickable-icon';
			openSettingsBtn.setAttribute('type', 'button');
			const icon = document.createElement('span');
			setIcon(icon, 'settings');
			openSettingsBtn.appendChild(icon);
			openSettingsBtn.setAttribute('aria-label', t('settings.openSettings'));
			openSettingsBtn.onclick = () => {
				try {
					// 直达本插件SettingTab的“播放器配置”页签
					// @ts-ignore
					app.workspace.trigger('tabflow:open-plugin-settings-player');
				} catch {
					try {
						// 退化处理
						// @ts-ignore
						app.commands.executeCommandById('app:open-settings');
						setTimeout(() => {
							try {
								const search = document.querySelector(
									'input.setting-search-input'
								) as HTMLInputElement | null;
								if (search) {
									search.value = 'Tab Flow';
									const ev = new Event('input', { bubbles: true });
									search.dispatchEvent(ev);
								}
							} catch {
								// Ignore search input errors
							}
						}, 120);
					} catch {
						// Ignore settings fallback errors
					}
				}
			};
			bar.appendChild(openSettingsBtn);
		},
		progressBar: () => {
			if (!show('progressBar', false)) return;
			currentTimeDisplay = document.createElement('span');
			currentTimeDisplay.className = 'play-time current-time';
			currentTimeDisplay.textContent = '0:00';
			bar.appendChild(currentTimeDisplay);
			progressBar = createProgressBar({
				getCurrentTime,
				getDuration,
				seekTo,
			}) as ProgressBarElement;
			bar.appendChild(progressBar);
			totalTimeDisplay = document.createElement('span');
			totalTimeDisplay.className = 'play-time total-time';
			totalTimeDisplay.textContent = '0:00';
			bar.appendChild(totalTimeDisplay);
		},
		speed: () => {
			if (!show('speed')) return;
			const speedIcon = document.createElement('span');
			speedIcon.className = 'speed-icon';
			setIcon(speedIcon, 'lucide-gauge');
			bar.appendChild(speedIcon);
			const select = document.createElement('select');
			['0.5', '0.75', '1.0', '1.25', '1.5', '2.0'].forEach((val) => {
				const opt = document.createElement('option');
				opt.value = val;
				opt.innerText = val + 'x';
				if (val === '1.0') opt.selected = true;
				select.appendChild(opt);
			});
			select.onchange = () => eventBus?.publish('命令:设置速度', parseFloat(select.value));
			bar.appendChild(select);
		},
		staveProfile: () => {
			if (!show('staveProfile')) return;
			const staveIcon = document.createElement('span');
			staveIcon.className = 'stave-icon';
			setIcon(staveIcon, 'lucide-list-music');
			bar.appendChild(staveIcon);
			const select = document.createElement('select');
			[
				{ name: t('settings.scoreTab'), value: alphaTab.StaveProfile.ScoreTab },
				{ name: t('settings.scoreOnly'), value: alphaTab.StaveProfile.Score },
				{ name: t('settings.tabOnly'), value: alphaTab.StaveProfile.Tab },
				{ name: t('settings.tabMixed'), value: alphaTab.StaveProfile.TabMixed },
			].forEach((item) => {
				const opt = document.createElement('option');
				opt.value = String(item.value);
				opt.innerText = item.name;
				select.appendChild(opt);
			});
			select.onchange = () => eventBus?.publish('命令:设置谱表', parseInt(select.value));
			bar.appendChild(select);
		},
		zoom: () => {
			if (!show('zoom')) return;
			const zoomIcon = document.createElement('span');
			zoomIcon.className = 'zoom-icon';
			setIcon(zoomIcon, 'lucide-zoom-in');
			bar.appendChild(zoomIcon);
			const select = document.createElement('select');
			[
				{ label: '50%', value: 0.5 },
				{ label: '75%', value: 0.75 },
				{ label: '100%', value: 1 },
				{ label: '125%', value: 1.25 },
				{ label: '150%', value: 1.5 },
				{ label: '200%', value: 2 },
			].forEach(({ label: l, value }) => {
				const opt = document.createElement('option');
				opt.value = String(value);
				opt.innerText = l;
				if (value === 1) opt.selected = true;
				select.appendChild(opt);
			});
			select.onchange = () => eventBus?.publish('命令:设置缩放', parseFloat(select.value));
			bar.appendChild(select);
		},
		scrollMode: () => {
			if (!show('scrollMode')) return;
			const scrollModeIcon = document.createElement('span');
			scrollModeIcon.className = 'scroll-mode-icon';
			setIcon(scrollModeIcon, 'lucide-scroll');
			bar.appendChild(scrollModeIcon);
			const select = document.createElement('select');
			const scrollModes = [
				{ name: t('settings.scrollContinuous'), value: 'continuous' },
				{ name: t('settings.scrollOffScreen'), value: 'offScreen' },
				{ name: t('settings.scrollOff'), value: 'off' },
			];
			scrollModes.forEach((item) => {
				const opt = document.createElement('option');
				opt.value = item.value;
				opt.innerText = item.name;
				select.appendChild(opt);
			});
			// 设置当前值
			try {
				const pluginId = 'tab-flow';
				// @ts-ignore - 通过全局 app.plugins 获取本插件实例
				const plugin = (app as any)?.plugins?.getPlugin?.(pluginId);
				const currentMode = plugin?.settings?.scrollMode || 'continuous';
				select.value = currentMode;
			} catch {
				select.value = 'continuous';
			}
			select.onchange = () => {
				eventBus?.publish('命令:设置滚动模式', select.value);
			};
			bar.appendChild(select);
		},
		audioPlayer: () => {
			if (!show('audioPlayer')) return;
			const audioPlayer = createAudioPlayer({
				app,
				onAudioCreated: (audioEl: HTMLAudioElement) => {
					// 通知父组件音频元素已创建
					options.onAudioCreated(audioEl);
				},
				onTimeUpdate: (currentTime: number, duration: number) => {
					// 可以在这里处理时间更新
				},
				onPlay: () => {
					// 可以在这里处理播放事件
				},
				onPause: () => {
					// 可以在这里处理暂停事件
				},
				onSeek: (time: number) => {
					// 可以在这里处理跳转事件
				},
			});
			bar.appendChild(audioPlayer);
		},
	};

	order.forEach((key) => {
		try {
			renderers[key]?.();
		} catch {
			// Ignore renderer errors
		}
	});

	// formatTime imported from utils/timeUtils

	// 更新进度条显示
	function updateProgress(currentTimeOverride?: number, durationOverride?: number) {
		if (!progressBar || !currentTimeDisplay || !totalTimeDisplay) return;
		try {
			const currentTime =
				currentTimeOverride !== undefined ? currentTimeOverride : getCurrentTime();
			const duration = durationOverride !== undefined ? durationOverride : getDuration();
			currentTimeDisplay.textContent = formatTime(currentTime);
			totalTimeDisplay.textContent = formatTime(duration);
			progressBar.updateProgress(currentTime, duration);
		} catch (error) {
			console.error('[PlayBar] 更新进度条出错:', error);
		}
	}

	// 初始化进度显示
	updateProgress();

	if (playing) {
		updateProgress();
	}

	const originalRemove = bar.remove;
	bar.remove = function () {
		originalRemove.call(bar);
	};

	return bar;
}
