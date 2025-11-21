import { Notice, App } from 'obsidian';
import * as alphaTab from '@coderline/alphatab';
// import { dispatchUIEvent } from "../events/dispatch";
import { ScrollEventManager } from '../events/scrollEvents';
import { AudioExportModal } from './AudioExportModal';
import { t } from '../i18n';

// Extend Window interface for alphaTab global
declare global {
	interface Window {
		alphaTab?: {
			LayoutMode?: {
				Page?: number;
				Horizontal?: number;
			};
		};
	}
}

// Extend HTMLDivElement for audioStatus property
interface DebugBarElement extends HTMLDivElement {
	audioStatus?: HTMLSpanElement;
}

export interface DebugBarOptions {
	app: App; // 新增
	api: alphaTab.AlphaTabApi;
	isAudioLoaded: () => boolean;
	eventBus: { publish: (event: string, payload?: unknown) => void };
	getScoreTitle: () => string;
}

export function createDebugBar(options: DebugBarOptions): HTMLDivElement {
	const { app, api, isAudioLoaded, eventBus, getScoreTitle } = options;
	const debugBar = document.createElement('div');
	debugBar.className = 'debug-bar';

	// 创建滚动配置管理器
	const scrollManager = new ScrollEventManager(api);
	scrollManager.setEventHandlers({
		onScrollConfigChange: (event) => {
			// console.debug(`[DebugBar] 滚动配置变更: ${event.property} = ${event.newValue}`);
			new Notice(t('settings.scrollSettingUpdated', { property: event.property }));
		},
	});

	// 布局模式切换按钮
	const layoutLabel = document.createElement('label');
	layoutLabel.className = 'control-label';
	layoutLabel.innerText = t('settings.layout');
	debugBar.appendChild(layoutLabel);
	const layoutSelect = document.createElement('select');
	const layoutModes = [
		{ name: t('settings.pageLayout'), value: window.alphaTab?.LayoutMode?.Page ?? 0 },
		{ name: t('settings.horizontalLayout'), value: window.alphaTab?.LayoutMode?.Horizontal ?? 1 },
	];
	layoutModes.forEach((item, idx) => {
		const opt = document.createElement('option');
		opt.value = String(item.value);
		opt.innerText = item.name;
		if (idx === 0) opt.selected = true;
		layoutSelect.appendChild(opt);
	});
	layoutSelect.onchange = () => {
		if (!api) return;
		const val = parseInt(layoutSelect.value);
		eventBus.publish('命令:切换布局', val);
	};
	debugBar.appendChild(layoutSelect);

	// TrackModal 按钮
	const tracksBtn = document.createElement('button');
	tracksBtn.innerText = t('tracks.selectTracks');
	tracksBtn.onclick = () => {
		eventBus.publish('命令:选择音轨');
	};
	debugBar.appendChild(tracksBtn);

	// 播放/暂停按钮
	const playPause = document.createElement('button');
	playPause.innerText = t('playback.playPause');
	playPause.onclick = () => {
		if (!api) {
			new Notice(t('status.apiNotInitialized'));
			return;
		}
		if (!isAudioLoaded()) {
			new Notice(t('status.cannotPlayWithoutAudio'));
			return;
		}
		eventBus.publish('命令:播放暂停');
	};
	debugBar.appendChild(playPause);

	// 停止按钮
	const stopBtn = document.createElement('button');
	stopBtn.innerText = t('playback.stop');
	stopBtn.onclick = () => {
		if (!api) {
			new Notice(t('status.apiNotInitialized'));
			return;
		}
		if (!isAudioLoaded()) {
			new Notice(t('status.cannotStopWithoutAudio'));
			return;
		}
		eventBus.publish('命令:停止');
	};
	debugBar.appendChild(stopBtn);

	// 速度选择
	const speedLabel = document.createElement('label');
	speedLabel.innerText = t('settings.speed');
	speedLabel.classList.add('control-label');
	debugBar.appendChild(speedLabel);
	const speedSelect = document.createElement('select');
	['0.5', '0.75', '1.0', '1.25', '1.5', '2.0'].forEach((val) => {
		const opt = document.createElement('option');
		opt.value = val;
		opt.innerText = val + 'x';
		if (val === '1.0') opt.selected = true;
		speedSelect.appendChild(opt);
	});
	speedSelect.onchange = () => {
		if (!api) return;
		const speed = parseFloat(speedSelect.value);
		if (!isNaN(speed)) {
			eventBus.publish('命令:设置速度', speed);
		}
	};
	debugBar.appendChild(speedSelect);

	// 谱表模式切换
	const staveLabel = document.createElement('label');
	staveLabel.innerText = t('settings.stave');
	staveLabel.classList.add('control-label');
	debugBar.appendChild(staveLabel);
	const staveSelect = document.createElement('select');
	const staveProfiles = [
		{ name: t('settings.scoreTab'), value: alphaTab.StaveProfile.ScoreTab },
		{ name: t('settings.scoreOnly'), value: alphaTab.StaveProfile.Score },
		{ name: t('settings.tabOnly'), value: alphaTab.StaveProfile.Tab },
		{ name: t('settings.tabMixed'), value: alphaTab.StaveProfile.TabMixed },
	];
	staveProfiles.forEach((item, idx) => {
		const opt = document.createElement('option');
		opt.value = String(item.value);
		opt.innerText = item.name;
		if (idx === 0) opt.selected = true;
		staveSelect.appendChild(opt);
	});
	staveSelect.onchange = () => {
		if (!api) return;
		const val = parseInt(staveSelect.value);
		eventBus.publish('命令:设置谱表', val);
	};
	debugBar.appendChild(staveSelect);

	// Metronome 节拍器开关
	const metronomeLabel = document.createElement('label');
	metronomeLabel.innerText = t('settings.metronome');
	metronomeLabel.classList.add('control-label');
	debugBar.appendChild(metronomeLabel);
	const metronomeToggle = document.createElement('input');
	metronomeToggle.type = 'checkbox';
	metronomeToggle.checked = false;
	// 初始同步 API
	if (api) api.metronomeVolume = 0;
	metronomeToggle.onchange = () => {
		if (!api) return;
		eventBus.publish('命令:设置节拍器', metronomeToggle.checked);
	};
	debugBar.appendChild(metronomeToggle);

	// Count-in 预备拍开关
	const countInLabel = document.createElement('label');
	countInLabel.innerText = t('settings.countIn');
	countInLabel.classList.add('control-label');
	debugBar.appendChild(countInLabel);
	const countInToggle = document.createElement('input');
	countInToggle.type = 'checkbox';
	countInToggle.checked = false;
	// 初始同步 API
	if (api) api.countInVolume = 0;
	countInToggle.onchange = () => {
		if (!api) return;
		eventBus.publish('命令:设置预备拍', countInToggle.checked);
	};
	debugBar.appendChild(countInToggle);

	// Zoom 缩放滑块
	const zoomLabel = document.createElement('label');
	zoomLabel.innerText = t('settings.zoom');
	zoomLabel.classList.add('control-label');
	debugBar.appendChild(zoomLabel);
	const zoomSlider = document.createElement('input');
	zoomSlider.type = 'range';
	zoomSlider.min = '0.5';
	zoomSlider.max = '2.0';
	zoomSlider.step = '0.05';
	zoomSlider.value = '1.0';
	zoomSlider.classList.add('slider-control');
	zoomSlider.oninput = () => {
		if (!api) return;
		eventBus.publish('命令:设置缩放', parseFloat(zoomSlider.value));
	};
	debugBar.appendChild(zoomSlider);

	// 导出相关按钮
	const exportLabel = document.createElement('label');
	exportLabel.innerText = t('export.export') + ':';
	exportLabel.classList.add('control-label');
	debugBar.appendChild(exportLabel);

	// 动态加载导出事件注册器
	type ExportHandlers = {
		exportAudio: () => Promise<void>;
		exportMidi: () => void;
		exportGp: () => void;
		exportPdf: () => void;
	};
	let exportHandlers: ExportHandlers | null = null;
	async function ensureExportHandlers() {
		if (!exportHandlers) {
			// Dynamically import to avoid circular dependency with events module
			const { registerExportEventHandlers } = await import('../events/exportEvents');
			exportHandlers = registerExportEventHandlers({
				api,
				getFileName: () => {
					// 优先用 getScoreTitle，保证 CJK 友好
					const title = getScoreTitle?.();
					if (title && title.trim()) return title;
					if (api.score && api.score.title) return api.score.title;
					return 'Untitled';
				},
				app, // 传递 app
				onExportStart: (type: string) => {
					// console.debug(`[Export] 开始导出: ${type}`);
					// console.debug(`[Export] 开始导出: ${type}`);
				},
					onExportFinish: (type: string, success: boolean, msg?: string) => {
					if (type === 'audio' && success && msg) {
						// 弹出 Obsidian 原生 Modal
						const fileName = (getScoreTitle?.() || 'audio') + '.wav';
						new AudioExportModal(app, msg, fileName).open();
						new Notice(t('export.audioExportCompleted'));
					}
					if (success) {
						// console.debug(`[Export] 导出${type}成功`);
						// console.debug(`[Export] 导出${type}成功`);
					} else {
						// console.debug(`[Export] 导出${type}失败: ${msg || '未知错误'}`);
						// console.debug(`[Export] 导出${type}失败: ${msg || '未知错误'}`);
					}
				},
			});
		}
		return exportHandlers;
	}

	// 音频导出按钮
	const audioBtn = document.createElement('button');
	audioBtn.innerText = t('export.exportAudio');
	audioBtn.onclick = () => {
		void (async () => {
			await (await ensureExportHandlers()).exportAudio();
		})();
	};
	debugBar.appendChild(audioBtn);

	// MIDI 导出按钮
	const midiBtn = document.createElement('button');
	midiBtn.innerText = t('export.exportMidi');
	midiBtn.onclick = () => {
		void (async () => {
			(await ensureExportHandlers()).exportMidi();
		})();
	};
	debugBar.appendChild(midiBtn);

	// GP 导出按钮
	const gpBtn = document.createElement('button');
	gpBtn.innerText = t('export.exportGp');
	gpBtn.onclick = () => {
		void (async () => {
			(await ensureExportHandlers()).exportGp();
		})();
	};
	debugBar.appendChild(gpBtn);

	// PDF 打印按钮
	const pdfBtn = document.createElement('button');
	pdfBtn.innerText = t('export.printPdf');
	pdfBtn.onclick = () => {
		void (async () => {
			(await ensureExportHandlers()).exportPdf();
		})();
	};
	debugBar.appendChild(pdfBtn);

	// 音频状态（由外部负责更新）
	const audioStatus = document.createElement('span');
	audioStatus.classList.add('audio-status');
	audioStatus.innerText = t('settings.audioStatusNotLoaded');
	debugBar.appendChild(audioStatus);

	// 提供音频状态元素给外部更新
	(debugBar as DebugBarElement).audioStatus = audioStatus;

	// 在现有控件后添加滚动控制区域
	// 滚动控制分隔符
	const scrollSeparator = document.createElement('span');
	scrollSeparator.innerText = ' | ';
	scrollSeparator.classList.add('scroll-separator');
	debugBar.appendChild(scrollSeparator);

	// 滚动模式选择
	const scrollModeLabel = document.createElement('label');
	scrollModeLabel.innerText = t('settings.scroll');
	scrollModeLabel.classList.add('control-label--tight');
	debugBar.appendChild(scrollModeLabel);

	const scrollModeSelect = document.createElement('select');
	const scrollModes = [
		{ name: t('settings.scrollOff'), value: alphaTab.ScrollMode.Off },
		{ name: t('settings.scrollContinuous'), value: alphaTab.ScrollMode.Continuous },
		{ name: t('settings.scrollOffScreen'), value: alphaTab.ScrollMode.OffScreen },
	];
	scrollModes.forEach((item, idx) => {
		const opt = document.createElement('option');
		opt.value = String(item.value);
		opt.innerText = item.name;
		// 默认选择连续滚动
		if (item.value === alphaTab.ScrollMode.Continuous) opt.selected = true;
		scrollModeSelect.appendChild(opt);
	});
	scrollModeSelect.onchange = () => {
		const mode = parseInt(scrollModeSelect.value) as alphaTab.ScrollMode;
		scrollManager.setScrollMode(mode);
	};
	debugBar.appendChild(scrollModeSelect);

	// 滚动速度控制
	const scrollSpeedLabel = document.createElement('label');
	scrollSpeedLabel.innerText = t('settings.scrollSpeed');
	scrollSpeedLabel.classList.add('control-label--tight');
	debugBar.appendChild(scrollSpeedLabel);

	const scrollSpeedSlider = document.createElement('input');
	scrollSpeedSlider.type = 'range';
	scrollSpeedSlider.min = '100';
	scrollSpeedSlider.max = '1000';
	scrollSpeedSlider.step = '50';
	scrollSpeedSlider.value = '500';
	scrollSpeedSlider.classList.add('small-slider');
	scrollSpeedSlider.title = '滚动动画时长(ms)';
	scrollSpeedSlider.oninput = () => {
		const speed = parseInt(scrollSpeedSlider.value);
		scrollManager.setScrollSpeed(speed);
		scrollSpeedLabel.innerText = `${t('settings.scrollSpeed')}${speed}ms`;
	};
	debugBar.appendChild(scrollSpeedSlider);

	// Y轴偏移控制
	const offsetYLabel = document.createElement('label');
	offsetYLabel.innerText = t('settings.yOffset');
	offsetYLabel.classList.add('control-label--tight');
	debugBar.appendChild(offsetYLabel);

	const offsetYSlider = document.createElement('input');
	offsetYSlider.type = 'range';
	offsetYSlider.min = '-100';
	offsetYSlider.max = '100';
	offsetYSlider.step = '5';
	offsetYSlider.value = '0';
	offsetYSlider.classList.add('small-slider');
	offsetYSlider.oninput = () => {
		const offset = parseInt(offsetYSlider.value);
		scrollManager.setScrollOffsetY(offset);
		offsetYLabel.innerText = `${t('settings.yOffset')}${offset}`;
	};
	debugBar.appendChild(offsetYSlider);

	// X轴偏移控制
	const offsetXLabel = document.createElement('label');
	offsetXLabel.innerText = t('settings.xOffset');
	offsetXLabel.classList.add('control-label--tight');
	debugBar.appendChild(offsetXLabel);

	const offsetXSlider = document.createElement('input');
	offsetXSlider.type = 'range';
	offsetXSlider.min = '-100';
	offsetXSlider.max = '100';
	offsetXSlider.step = '5';
	offsetXSlider.value = '0';
	offsetXSlider.classList.add('small-slider');
	offsetXSlider.oninput = () => {
		const offset = parseInt(offsetXSlider.value);
		scrollManager.setScrollOffsetX(offset);
		offsetXLabel.innerText = `${t('settings.xOffset')}${offset}`;
	};
	debugBar.appendChild(offsetXSlider);

	// 原生滚动开关
	const nativeScrollLabel = document.createElement('label');
	nativeScrollLabel.innerText = t('settings.nativeScroll');
	nativeScrollLabel.classList.add('control-label--tight');
	debugBar.appendChild(nativeScrollLabel);

	const nativeScrollToggle = document.createElement('input');
	nativeScrollToggle.type = 'checkbox';
	nativeScrollToggle.checked = false; // 默认使用自定义滚动
	nativeScrollToggle.title = '使用浏览器原生平滑滚动';
	nativeScrollToggle.onchange = () => {
		scrollManager.setNativeBrowserSmoothScroll(nativeScrollToggle.checked);
		// 如果启用原生滚动，禁用速度滑块
		scrollSpeedSlider.disabled = nativeScrollToggle.checked;
		scrollSpeedLabel.classList.toggle('disabled-label', nativeScrollToggle.checked);
	};
	debugBar.appendChild(nativeScrollToggle);

	// 手动滚动到光标按钮
	const scrollToCursorBtn = document.createElement('button');
	scrollToCursorBtn.innerText = t('settings.scrollToCursor');
	scrollToCursorBtn.title = t('settings.scrollToCursorTitle');
	scrollToCursorBtn.onclick = () => {
		scrollManager.triggerScrollToCursor();
		new Notice(t('status.scrolledToCursor'));
	};
	debugBar.appendChild(scrollToCursorBtn);

	return debugBar;
}
