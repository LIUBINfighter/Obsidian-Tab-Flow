import * as alphaTab from '@coderline/alphatab';
import { convertSamplesToWavBlobUrl } from '../utils';

/**
 * 导出相关事件注册与处理
 * 包括：音频导出、MIDI导出、GP导出、PDF打印
 */

export interface ExportEventHandlersOptions {
	api: alphaTab.AlphaTabApi;
	getFileName?: () => string; // 可选：自定义文件名
	onExportStart?: (type: string) => void;
	onExportFinish?: (type: string, success: boolean, message?: string) => void;
	app?: any; // Obsidian App 实例，用于创建模态框
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
				while (true) {
					const chunk = await exporter.render(500);
					if (!chunk) break;
					chunks.push(chunk.samples);
				}
			} finally {
				exporter.destroy();
			}
			const blobUrl = convertSamplesToWavBlobUrl(chunks, options.sampleRate);
			onExportFinish?.('audio', true, blobUrl);
		} catch (e: any) {
			onExportFinish?.('audio', false, e?.message || String(e));
		}
	}

	// convertSamplesToWavBlobUrl imported from utils/audioUtils

	// 2. MIDI 导出（带自定义文件名）
	function exportMidi() {
		try {
			onExportStart?.('midi');
			const fileName = (getFileName?.() || 'Untitled') + '.mid';
			// 优先使用 exportMidi 以便自定义文件名
			if (api && typeof (api as any).exportMidi === 'function') {
				// @ts-ignore
				const midiData = api.exportMidi();
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
		} catch (e: any) {
			onExportFinish?.('midi', false, e?.message || String(e));
		}
	}

	// 3. GP 导出（Guitar Pro 7）
	function exportGp() {
		try {
			onExportStart?.('gp');
			if (!api.score) throw new Error('乐谱未加载');
			const exporter = new (alphaTab as any).exporter.Gp7Exporter();
			const data = exporter.export(api.score, api.settings);
			const a = document.createElement('a');
			a.download = (getFileName?.() || api.score.title || 'Untitled') + '.gp';
			a.href = URL.createObjectURL(new Blob([data]));
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			onExportFinish?.('gp', true);
		} catch (e: any) {
			onExportFinish?.('gp', false, e?.message || String(e));
		}
	}

	// 4. 打印为 PDF（调用浏览器打印）
	function exportPdf() {
		try {
			onExportStart?.('pdf');
			// 只打印乐谱区域
			// 假设 api.renderTarget 是渲染的 DOM 元素
			const el = (api as any).renderTarget || api.container;
			if (!el) throw new Error('找不到乐谱渲染区域');
			// 新建窗口打印
			const win = window.open('', '_blank');
			if (!win) throw new Error('无法打开打印窗口');
			win.document.write('<html><head><title>乐谱打印</title>');
			// 使用 DOM API 替代 outerHTML，避免安全风险
			// 复制样式
			document.querySelectorAll('style,link[rel="stylesheet"]').forEach((style) => {
				const clonedStyle = style.cloneNode(true) as HTMLElement;
				win.document.head.appendChild(clonedStyle);
			});
			win.document.write('</head><body>');
			// 复制乐谱元素
			const clonedEl = el.cloneNode(true) as HTMLElement;
			win.document.body.appendChild(clonedEl);
			win.document.write('</body></html>');
			win.document.close();
			win.focus();
			win.print();
			onExportFinish?.('pdf', true);
		} catch (e: any) {
			onExportFinish?.('pdf', false, e?.message || String(e));
		}
	}

	return { exportAudio, exportMidi, exportGp, exportPdf };
}
