import type MyPlugin from '../main';
import { setIcon, normalizePath, TFile, Notice } from 'obsidian';
import type { AlphaTabResources } from '../services/ResourceLoaderService';
import { createEmbeddableMarkdownEditor } from '../editor/EmbeddableMarkdownEditor';

export interface AlphaTexPlaygroundOptions {
	placeholder?: string;
	debounceMs?: number;
	readOnly?: boolean;
	onChange?: (value: string) => void;
	/** 额外 alphaTab 渲染参数 (可覆盖内置默认) */
	alphaTabOptions?: Record<string, unknown>;
	/** 布局：vertical(上下) 或 horizontal(左右) */
	layout?: 'vertical' | 'horizontal';
	/** 附加到根容器的自定义类名（可用于主题/自定义布局） */
	className?: string;
}

export interface AlphaTexPlaygroundHandle {
	getValue(): string;
	setValue(v: string): void;
	destroy(): void;
	refresh(): void; // 强制重新渲染
}

/**
 * 创建一个 AlphaTex playground：上方 Obsidian Markdown(AlphaTex) 编辑器，下方实时曲谱渲染。
 * 只需提供初始 AlphaTex 文本即可。
 */
export function createAlphaTexPlayground(
	plugin: MyPlugin,
	container: HTMLElement,
	initialSource: string,
	options: AlphaTexPlaygroundOptions = {}
): AlphaTexPlaygroundHandle {
	const { placeholder = '输入 AlphaTex 内容...', debounceMs = 350, readOnly = false, onChange, alphaTabOptions = {}, layout = 'vertical', className = '' } = options;

	container.empty();
	const wrapper = container.createDiv({ cls: 'alphatex-playground inmarkdown-wrapper' });
	if (layout === 'horizontal') wrapper.classList.add('is-horizontal'); else wrapper.classList.add('is-vertical');
	if (className) wrapper.classList.add(className);

	// 编辑器容器
	const editorWrap = wrapper.createDiv({ cls: 'inmarkdown-editor' });
	const editorContainer = editorWrap.createDiv({ cls: 'inmarkdown-editor-cm' });
	const embedded = createEmbeddableMarkdownEditor(plugin.app, editorContainer, {
		value: initialSource,
		placeholder,
		onChange: () => scheduleRender(),
	});

	// Editor toolbar (top-right icons)
	const toolbar = editorWrap.createDiv({ cls: 'inmarkdown-editor-toolbar' });
	const btnCopy = toolbar.createEl('button', { attr: { type: 'button' }, cls: 'clickable-icon' });
	const iCopy = document.createElement('span'); setIcon(iCopy, 'copy'); btnCopy.appendChild(iCopy); btnCopy.setAttr('aria-label', '复制到剪贴板');
	btnCopy.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(embedded.value);
		} catch {
			try {
				const ta = document.createElement('textarea'); ta.value = embedded.value; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
			} catch {}
		}
		// feedback: turn into green check briefly
		try {
			setIcon(iCopy, 'check'); btnCopy.classList.add('is-success'); btnCopy.setAttr('aria-label', '已复制');
			setTimeout(() => { setIcon(iCopy, 'copy'); btnCopy.classList.remove('is-success'); btnCopy.setAttr('aria-label', '复制到剪贴板'); }, 1200);
		} catch {}
	});

	const btnReset = toolbar.createEl('button', { attr: { type: 'button' }, cls: 'clickable-icon' });
	const iReset = document.createElement('span'); setIcon(iReset, 'rotate-ccw'); btnReset.appendChild(iReset); btnReset.setAttr('aria-label', '重置为默认内容');
	btnReset.addEventListener('click', () => { try { embedded.set(initialSource, false); scheduleRender(); } catch {} });

	const btnNewNote = toolbar.createEl('button', { attr: { type: 'button' }, cls: 'clickable-icon' });
	const iNew = document.createElement('span'); setIcon(iNew, 'file-plus'); btnNewNote.appendChild(iNew); btnNewNote.setAttr('aria-label', '根据此文本创建新的笔记');
	btnNewNote.addEventListener('click', async () => {
		try {
			const now = new Date();
			const pad = (n: number) => String(n).padStart(2, '0');
			const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
			const folder = 'Alphatex Playground';
			const baseName = `Playground-${stamp}.md`;
			const filePath = normalizePath(`${folder}/${baseName}`);
			// ensure folder
			try { if (!(await plugin.app.vault.adapter.exists(folder))) await plugin.app.vault.createFolder(folder); } catch {}
			const content = `\`\`\`alphatex\n${embedded.value}\n\`\`\``.replace(/`/g, '`');
			const file = await plugin.app.vault.create(filePath, content) as TFile;
			const leaf = plugin.app.workspace.getLeaf(true);
			await leaf.openFile(file);
		} catch (e) { console.warn('[Playground] 创建笔记失败', e); }
	});

	// Format init JSON button
	const btnFormat = toolbar.createEl('button', { attr: { type: 'button' }, cls: 'clickable-icon' });
	const iFmt = document.createElement('span'); setIcon(iFmt, 'code'); btnFormat.appendChild(iFmt); btnFormat.setAttr('aria-label', '格式化 init JSON');
	btnFormat.addEventListener('click', () => {
		try {
			const formatted = formatInitHeader(embedded.value);
			if (formatted && formatted !== embedded.value) {
				embedded.set(formatted, false);
				new Notice('已格式化 init JSON');
				scheduleRender();
			} else {
				new Notice('未检测到 init 或无需格式化');
			}
		} catch (e) {
			console.warn('[Playground] 格式化 init 失败:', e);
			new Notice('格式化失败');
		}
	});

	function formatInitHeader(sourceText: string): string | null {
		let s = sourceText;
		if (!s) return null;
		if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
		const startMatch = s.match(/^\s*%%\{\s*init\s*:/);
		if (!startMatch) return null;
		let cursor = startMatch[0].length;
		const objStart = s.indexOf('{', cursor);
		if (objStart < 0) return null;
		let i = objStart, depth = 0, inStr = false, quote: '"' | "'" | null = null;
		while (i < s.length) {
			const ch = s[i];
			if (inStr) {
				if (ch === '\\') { i += 2; continue; }
				if (ch === quote) { inStr = false; quote = null; }
				i++; continue;
			} else {
				if (ch === '"' || ch === "'") { inStr = true; quote = ch as '"' | "'"; i++; continue; }
				if (ch === '{') { depth++; i++; continue; }
				if (ch === '}') { depth--; i++; if (depth === 0) break; continue; }
				i++;
			}
		}
		if (depth !== 0) return null;
		const jsonText = s.slice(objStart, i);
		let obj: any;
		try { obj = JSON.parse(jsonText); } catch { return null; }
		const pretty = JSON.stringify(obj, null, 2);
		// consume trailing wrapper up to closing %% and optional newline
		let k = i;
		while (k < s.length && /\s/.test(s[k])) k++;
		if (s[k] === '}') { k++; while (k < s.length && /\s/.test(s[k])) k++; }
		if (s.slice(k, k + 2) === '%%') k += 2;
		if (s[k] === '\r') k++;
		if (s[k] === '\n') k++;
		const consumed = k + (sourceText.length - s.length);
		const rest = sourceText.slice(consumed);
		const header = `%%{init: ${pretty} }%%\n`;
		return header + rest;
	}
	if (readOnly) {
		// 简单只读（利用 CodeMirror DOM 属性）
		editorContainer.addClass('read-only');
		const cmEl = editorContainer.querySelector('.cm-content') as HTMLElement | null;
		if (cmEl) cmEl.setAttr('contenteditable', 'false');
	}

	// 预览容器
	const previewWrap = wrapper.createDiv({ cls: 'inmarkdown-preview tabflow-doc-main-content' });

	let mounted: { destroy?: () => void } | null = null;
	let debounceTimer: number | null = null;

	function scheduleRender() {
		if (debounceTimer) window.clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(() => renderPreview(), debounceMs);
		onChange?.(embedded.value);
	}

	async function renderPreview() {
		// 清理旧实例
		try { mounted?.destroy?.(); } catch (e) { /* ignore */ }
		previewWrap.empty();

		const resources: AlphaTabResources | undefined = (plugin as unknown as { resources?: AlphaTabResources }).resources;
		if (!resources || !resources.bravuraUri || !resources.alphaTabWorkerUri) {
			const holder = previewWrap.createDiv({ cls: 'alphatex-block' });
			holder.createEl('div', { text: 'AlphaTab 资源缺失，无法渲染预览。' });
			const btn = holder.createEl('button', { text: '下载资源' });
			btn.addEventListener('click', async () => {
				btn.setAttr('disabled', 'true');
				btn.setText('下载中...');
				try {
					interface Downloader { downloadAssets?: () => Promise<boolean> }
					const ok = await (plugin as unknown as Downloader).downloadAssets?.();
					btn.removeAttribute('disabled');
					btn.setText(ok ? '下载完成，点击重新渲染' : '下载失败，重试');
				} catch (e) {
					btn.removeAttribute('disabled');
					btn.setText('下载失败，重试');
				}
			});
			return;
		}

		// 动态加载渲染函数
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { mountAlphaTexBlock } = require('../markdown/AlphaTexBlock');
		try {
			mounted = mountAlphaTexBlock(previewWrap, embedded.value, resources, {
				scale: 1,
				speed: 1,
				scrollMode: 'Continuous',
				metronome: false,
				...alphaTabOptions,
			});
		} catch (e) {
			console.warn('[Playground] AlphaTex 渲染失败:', e);
			const err = previewWrap.createDiv({ cls: 'alphatex-block' });
			err.createEl('div', { cls: 'alphatex-error', text: 'AlphaTab 引擎报错：' + String((e as any)?.message || e) });
		}
	}

	// 初次渲染
	renderPreview();

	// 观察移除，销毁实例
	const observer = new MutationObserver(() => {
		if (!document.body.contains(wrapper)) {
			try { mounted?.destroy?.(); } catch (e) { /* ignore */ }
			observer.disconnect();
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });

	return {
		getValue: () => embedded.value,
		setValue: (v: string) => { embedded.set(v, false); scheduleRender(); },
		destroy: () => {
			try { mounted?.destroy?.(); } catch (e) { /* silent */ }
			observer.disconnect();
			wrapper.detach();
		},
		refresh: () => renderPreview(),
	};
}
