import { Notice, App } from 'obsidian';
import * as alphaTab from '@coderline/alphatab';
// import { dispatchUIEvent } from "../events/dispatch";
import { ScrollConfigProxy } from '../services/ScrollConfigProxy';
import { AudioExportModal } from './AudioExportModal';

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

	// 创建滚动配置代理
	const scrollProxy = new ScrollConfigProxy(api);

	// 监听滚动配置变更事件
	scrollProxy.onConfigChange((event) => {
		// console.debug(`[DebugBar] 滚动配置变更: ${event.property} = ${event.newValue}`);
		new Notice(`滚动设置已更新: ${event.property}`);
	});

	// 布局模式切换按钮
	const layoutLabel = document.createElement('label');
	layoutLabel.className = 'control-label';
	layoutLabel.innerText = '布局:';
	debugBar.appendChild(layoutLabel);
	const layoutSelect = document.createElement('select');
	const layoutModes = [
		{ name: '页面', value: (window as any).alphaTab?.LayoutMode?.Page ?? 0 },
		{ name: '横向', value: (window as any).alphaTab?.LayoutMode?.Horizontal ?? 1 },
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
	tracksBtn.innerText = '选择音轨';
	tracksBtn.onclick = () => {
		eventBus.publish('命令:选择音轨');
	};
	debugBar.appendChild(tracksBtn);

	// 播放/暂停按钮
	const playPause = document.createElement('button');
	playPause.innerText = '播放/暂停';
	playPause.onclick = () => {
		if (!api) {
			new Notice('AlphaTab API 未初始化');
			return;
		}
		if (!isAudioLoaded()) {
			new Notice('音频资源未加载，无法播放。请等待音频加载完成。');
			return;
		}
		eventBus.publish('命令:播放暂停');
	};
	debugBar.appendChild(playPause);

	// 停止按钮
	const stopBtn = document.createElement('button');
	stopBtn.innerText = '停止';
	stopBtn.onclick = () => {
		if (!api) {
			new Notice('AlphaTab API 未初始化');
			return;
		}
		if (!isAudioLoaded()) {
			new Notice('音频资源未加载，无法停止');
			return;
		}
		eventBus.publish('命令:停止');
	};
	debugBar.appendChild(stopBtn);

	// 速度选择
	const speedLabel = document.createElement('label');
	speedLabel.innerText = '速度:';
	speedLabel.style.marginLeft = '1em';
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
	staveLabel.innerText = '谱表:';
	staveLabel.style.marginLeft = '1em';
	debugBar.appendChild(staveLabel);
	const staveSelect = document.createElement('select');
	const staveProfiles = [
		{ name: '五线+六线', value: alphaTab.StaveProfile.ScoreTab },
		{ name: '仅五线谱', value: alphaTab.StaveProfile.Score },
		{ name: '仅六线谱', value: alphaTab.StaveProfile.Tab },
		{ name: '混合六线谱', value: alphaTab.StaveProfile.TabMixed },
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
	metronomeLabel.innerText = '节拍器:';
	metronomeLabel.style.marginLeft = '1em';
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
	countInLabel.innerText = '预备拍:';
	countInLabel.style.marginLeft = '1em';
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
	zoomLabel.innerText = '缩放:';
	zoomLabel.style.marginLeft = '1em';
	debugBar.appendChild(zoomLabel);
	const zoomSlider = document.createElement('input');
	zoomSlider.type = 'range';
	zoomSlider.min = '0.5';
	zoomSlider.max = '2.0';
	zoomSlider.step = '0.05';
	zoomSlider.value = '1.0';
	zoomSlider.style.width = '80px';
	zoomSlider.oninput = () => {
		if (!api) return;
		eventBus.publish('命令:设置缩放', parseFloat(zoomSlider.value));
	};
	debugBar.appendChild(zoomSlider);

	// 导出相关按钮
	const exportLabel = document.createElement('label');
	exportLabel.innerText = '导出:';
	exportLabel.style.marginLeft = '1em';
	debugBar.appendChild(exportLabel);

	// 动态加载导出事件注册器
	let exportHandlers: any = null;
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
				},
				onExportFinish: (type: string, success: boolean, msg?: string) => {
					if (type === 'audio' && success && msg) {
						// 弹出 Obsidian 原生 Modal
						const fileName = (getScoreTitle?.() || 'audio') + '.wav';
						new AudioExportModal(app, msg, fileName).open();
						new Notice('音频导出完成，已弹出播放器');
					}
					if (success) {
						// console.debug(`[Export] 导出${type}成功`);
					} else {
						// console.debug(`[Export] 导出${type}失败: ${msg || '未知错误'}`);
					}
				},
			});
		}
		return exportHandlers;
	}

	// 音频导出按钮
	const audioBtn = document.createElement('button');
	audioBtn.innerText = '导出音频';
	audioBtn.onclick = async () => {
		(await ensureExportHandlers()).exportAudio();
	};
	debugBar.appendChild(audioBtn);

	// MIDI 导出按钮
	const midiBtn = document.createElement('button');
	midiBtn.innerText = '导出MIDI';
	midiBtn.onclick = async () => {
		(await ensureExportHandlers()).exportMidi();
	};
	debugBar.appendChild(midiBtn);

	// GP 导出按钮
	const gpBtn = document.createElement('button');
	gpBtn.innerText = '导出GP';
	gpBtn.onclick = async () => {
		(await ensureExportHandlers()).exportGp();
	};
	debugBar.appendChild(gpBtn);

	// PDF 打印按钮
	const pdfBtn = document.createElement('button');
	pdfBtn.innerText = '打印PDF';
	pdfBtn.onclick = async () => {
		(await ensureExportHandlers()).exportPdf();
	};
	debugBar.appendChild(pdfBtn);

	// 音频状态（由外部负责更新）
	const audioStatus = document.createElement('span');
	audioStatus.style.marginLeft = '1em';
	audioStatus.style.fontSize = '0.9em';
	audioStatus.innerText = '音频：未加载';
	debugBar.appendChild(audioStatus);

	// 提供音频状态元素给外部更新
	(debugBar as any).audioStatus = audioStatus;

	// 在现有控件后添加滚动控制区域
	// 滚动控制分隔符
	const scrollSeparator = document.createElement('span');
	scrollSeparator.innerText = ' | ';
	scrollSeparator.style.margin = '0 0.5em';
	debugBar.appendChild(scrollSeparator);

	// 滚动模式选择
	const scrollModeLabel = document.createElement('label');
	scrollModeLabel.innerText = '滚动:';
	scrollModeLabel.style.marginLeft = '0.5em';
	debugBar.appendChild(scrollModeLabel);

	const scrollModeSelect = document.createElement('select');
	const scrollModes = [
		{ name: '关闭', value: alphaTab.ScrollMode.Off },
		{ name: '连续', value: alphaTab.ScrollMode.Continuous },
		{ name: '超出时', value: alphaTab.ScrollMode.OffScreen },
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
		eventBus.publish('命令:设置滚动模式', mode);
	};
	debugBar.appendChild(scrollModeSelect);

	// 滚动速度控制
	const scrollSpeedLabel = document.createElement('label');
	scrollSpeedLabel.innerText = '速度:';
	scrollSpeedLabel.style.marginLeft = '0.5em';
	debugBar.appendChild(scrollSpeedLabel);

	const scrollSpeedSlider = document.createElement('input');
	scrollSpeedSlider.type = 'range';
	scrollSpeedSlider.min = '100';
	scrollSpeedSlider.max = '1000';
	scrollSpeedSlider.step = '50';
	scrollSpeedSlider.value = '500';
	scrollSpeedSlider.style.width = '60px';
	scrollSpeedSlider.title = '滚动动画时长(ms)';
	scrollSpeedSlider.oninput = () => {
		const speed = parseInt(scrollSpeedSlider.value);
		scrollProxy.setScrollSpeed(speed);
		scrollSpeedLabel.innerText = `速度:${speed}ms`;
	};
	debugBar.appendChild(scrollSpeedSlider);

	// Y轴偏移控制
	const offsetYLabel = document.createElement('label');
	offsetYLabel.innerText = 'Y偏移:';
	offsetYLabel.style.marginLeft = '0.5em';
	debugBar.appendChild(offsetYLabel);

	const offsetYSlider = document.createElement('input');
	offsetYSlider.type = 'range';
	offsetYSlider.min = '-100';
	offsetYSlider.max = '100';
	offsetYSlider.step = '5';
	offsetYSlider.value = '-25';
	offsetYSlider.style.width = '60px';
	offsetYSlider.title = '垂直滚动偏移';
	offsetYSlider.oninput = () => {
		const offset = parseInt(offsetYSlider.value);
		scrollProxy.setScrollOffsetY(offset);
		offsetYLabel.innerText = `Y偏移:${offset}`;
	};
	debugBar.appendChild(offsetYSlider);

	// 原生滚动开关
	const nativeScrollLabel = document.createElement('label');
	nativeScrollLabel.innerText = '原生滚动:';
	nativeScrollLabel.style.marginLeft = '0.5em';
	debugBar.appendChild(nativeScrollLabel);

	const nativeScrollToggle = document.createElement('input');
	nativeScrollToggle.type = 'checkbox';
	nativeScrollToggle.checked = false; // 默认使用自定义滚动
	nativeScrollToggle.title = '使用浏览器原生平滑滚动';
	nativeScrollToggle.onchange = () => {
		scrollProxy.setNativeBrowserSmoothScroll(nativeScrollToggle.checked);
		// 如果启用原生滚动，禁用速度滑块
		scrollSpeedSlider.disabled = nativeScrollToggle.checked;
		if (nativeScrollToggle.checked) {
			scrollSpeedLabel.style.opacity = '0.5';
		} else {
			scrollSpeedLabel.style.opacity = '1';
		}
	};
	debugBar.appendChild(nativeScrollToggle);

	// 手动滚动到光标按钮
	const scrollToCursorBtn = document.createElement('button');
	scrollToCursorBtn.innerText = '滚动到光标';
	scrollToCursorBtn.title = '手动触发滚动到当前播放位置';
	scrollToCursorBtn.onclick = () => {
		eventBus.publish('命令:滚动到光标');
		new Notice('已滚动到当前光标位置');
	};
	debugBar.appendChild(scrollToCursorBtn);

	return debugBar;
}
