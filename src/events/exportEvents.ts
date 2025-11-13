import * as alphaTab from '@coderline/alphatab';
import { convertSamplesToWavBlobUrl } from '../utils';

/**
 * 导出相关事件注册与处理
 * 包括：音频导出、MIDI导出、GP导出、PDF打印
 */

// Extended API type for export methods
interface ExtendedAlphaTabApi {
	exportMidi?: () => Uint8Array;
	renderTarget?: HTMLElement;
}

export interface ExportEventHandlersOptions {
	api: alphaTab.AlphaTabApi;
	getFileName?: () => string; // 可选：自定义文件名
	onExportStart?: (type: string) => void;
	onExportFinish?: (type: string, success: boolean, message?: string) => void;
	app?: unknown; // Obsidian App 实例，用于创建模态框
}

export function registerExportEventHandlers(options: ExportEventHandlersOptions): {
	exportAudio: () => Promise<void>;
	exportMidi: () => void;
	exportGp: () => void;
	exportPdf: () => void;
} {
	const { api, getFileName, onExportStart, onExportFinish } = options;

	// 1. 音频导出（WAV）
	async function exportAudio() {
		try {
			onExportStart?.('audio');
			const options = new alphaTab.synth.AudioExportOptions();
			options.masterVolume = 1;
			options.metronomeVolume = 0;
			options.sampleRate = 44100;
			const exporter = await api.exportAudio(options);
			const chunks: Float32Array[] = [];
			try {
				let chunk;
				while ((chunk = await exporter.render(500))) {
					chunks.push(chunk.samples);
				}
			} finally {
				exporter.destroy();
			}
			const blobUrl = convertSamplesToWavBlobUrl(chunks, options.sampleRate);
			onExportFinish?.('audio', true, blobUrl);
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			onExportFinish?.('audio', false, message);
		}
	}

	// convertSamplesToWavBlobUrl imported from utils/audioUtils

	// 2. MIDI 导出（带自定义文件名）
	function exportMidi() {
		try {
			onExportStart?.('midi');
			const fileName = (getFileName?.() || 'Untitled') + '.mid';
			// 优先使用 exportMidi 以便自定义文件名
			const extendedApi = api as ExtendedAlphaTabApi;
			if (api && typeof extendedApi.exportMidi === 'function') {
				const midiData = extendedApi.exportMidi();
				const a = document.createElement('a');
				a.download = fileName;
				a.href = URL.createObjectURL(new Blob([midiData], { type: 'audio/midi' }));
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			} else if (api && typeof api.downloadMidi === 'function') {
				// 回退到内置下载（可能无法自定义文件名）
				try {
					// @ts-ignore 尝试带文件名（部分版本支持）
					api.downloadMidi(fileName);
				} catch {
					api.downloadMidi();
				}
			}
			onExportFinish?.('midi', true);
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			onExportFinish?.('midi', false, message);
		}
	}

	// 3. GP 导出（Guitar Pro 7）
	function exportGp() {
		try {
			onExportStart?.('gp');
			if (!api.score) throw new Error('乐谱未加载');
			// AlphaTab exporter types are not fully exported
			interface AlphaTabExporter {
				exporter?: {
					Gp7Exporter?: new () => {
						export: (score: unknown, settings: unknown) => Uint8Array;
					};
				};
			}
			const exporter = new ((alphaTab as unknown as AlphaTabExporter).exporter?.Gp7Exporter)();
			const data = exporter.export(api.score, api.settings);
			const a = document.createElement('a');
			a.download = (getFileName?.() || api.score.title || 'Untitled') + '.gp';
			a.href = URL.createObjectURL(new Blob([data]));
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			onExportFinish?.('gp', true);
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			onExportFinish?.('gp', false, message);
		}
	}

	// 4. 打印为 PDF（调用浏览器打印）
	function exportPdf() {
		try {
			onExportStart?.('pdf');
			// 只打印乐谱区域
			// 假设 api.renderTarget 是渲染的 DOM 元素
			const extendedApi = api as ExtendedAlphaTabApi;
			const el = extendedApi.renderTarget || api.container;
			if (!el) throw new Error('找不到乐谱渲染区域');
			// 新建窗口打印
			const win = window.open('', '_blank');
			if (!win) throw new Error('无法打开打印窗口');

			// 使用 DOM API 而不是 document.write
			const htmlEl = win.document.createElement('html');
			const headEl = win.document.createElement('head');
			const titleEl = win.document.createElement('title');
			titleEl.textContent = '乐谱打印';
			headEl.appendChild(titleEl);

			// 复制样式
			document.querySelectorAll('style,link[rel="stylesheet"]').forEach((style) => {
				const clonedStyle = style.cloneNode(true) as HTMLElement;
				headEl.appendChild(clonedStyle);
			});

			const bodyEl = win.document.createElement('body');
			// 复制乐谱元素
			const clonedEl = el.cloneNode(true) as HTMLElement;
			bodyEl.appendChild(clonedEl);

			htmlEl.appendChild(headEl);
			htmlEl.appendChild(bodyEl);
			win.document.appendChild(htmlEl);
			win.document.close();
			win.focus();
			win.print();
			onExportFinish?.('pdf', true);
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			onExportFinish?.('pdf', false, message);
		}
	}

	return { exportAudio, exportMidi, exportGp, exportPdf };
}
