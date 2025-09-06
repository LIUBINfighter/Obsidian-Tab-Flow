import type TabFlowPlugin from '../main';
import { setIcon, normalizePath, TFile, Notice } from 'obsidian';
import type { AlphaTabResources } from '../services/ResourceLoaderService';
import { createEmbeddableMarkdownEditor } from '../editor/EmbeddableMarkdownEditor';
import { t } from '../i18n';
import * as alphaTab from '@coderline/alphatab';
import type { AlphaTexMountHandle } from '../markdown/AlphaTexBlock';

interface EventBus {
	subscribe(event: string, callback: (...args: unknown[]) => void): void;
}

export interface AlphaTexPlaygroundOptions {
	placeholder?: string;
	debounceMs?: number;
	readOnly?: boolean;
	/** 额外 alphaTab 渲染参数 (可覆盖内置默认) */
	alphaTabOptions?: Record<string, unknown>;
	/** 布局：vertical(上下) 或 horizontal(左右) */
	layout?: 'vertical' | 'horizontal' | 'horizontal-swapped' | 'vertical-swapped' | 'single-bar';
	/** 附加到根容器的自定义类名（可用于主题/自定义布局） */
	className?: string;
	/** 是否显示编辑区 */
	showEditor?: boolean;
	/** EventBus for handling commands */
	eventBus?: EventBus;

	/**
	 * 回调：当 playground 内部内容发生变更时触发（例如 playground 内部编辑器、格式化按钮、或工具
	 * 操作导致的内容修改）。注意：
	 * - 在常规模式下（非 single-bar）该回调通常用于将 playground 内部的调整同步回宿主编辑器（双向绑定）。
	 * - 在 `single-bar`（单小节聚焦）模式下，playground 的内容通常只包含局部片段（当前小节）。
	 *   如果在该模式下启用 `onChange` 并把返回的局部文本直接写回源编辑器，会导致源文件被覆盖为局部片段，
	 *   从而丢失其他小节。调用方必须在 single-bar 模式下避免传入 `onChange`，或在回调内部对写回操作做保护性合并。
	 */
	onChange?: (value: string) => void;
}

export interface AlphaTexPlaygroundHandle {
	getValue(): string;
	setValue(v: string): void;
	destroy(): void;
	refresh(): void; // 强制重新渲染
	getApi(): alphaTab.AlphaTabApi | null;
}

/**
 * 创建一个 AlphaTex playground：上方 Obsidian Markdown(AlphaTex) 编辑器，下方实时曲谱渲染。
 * 只需提供初始 AlphaTex 文本即可。
 */
export function createAlphaTexPlayground(
	plugin: TabFlowPlugin,
	container: HTMLElement,
	initialSource: string,
	options: AlphaTexPlaygroundOptions = {}
): AlphaTexPlaygroundHandle {
	const {
		placeholder = t('playground.placeholder'),
		debounceMs = 350,
		readOnly = false,
		onChange,
		alphaTabOptions = {},
		layout = 'horizontal', // 默认改为左右布局
		className = '',
		showEditor = true,
		eventBus,
	} = options;

	container.empty();
	const wrapper = container.createDiv({ cls: 'alphatex-playground inmarkdown-wrapper' });
	if (layout === 'horizontal' || layout === 'horizontal-swapped' || layout === 'single-bar')
		wrapper.classList.add('is-horizontal');
	else wrapper.classList.add('is-vertical');
	if (className) wrapper.classList.add(className);

	let currentValue = initialSource;
	let embedded: ReturnType<typeof createEmbeddableMarkdownEditor> | null = null;

	function formatInitHeader(sourceText: string): string | null {
		let s = sourceText;
		if (!s) return null;
		if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
		const startMatch = s.match(/^\s*%%\{\s*init\s*:/);
		if (!startMatch) return null;
		const cursor = startMatch[0].length;
		const objStart = s.indexOf('{', cursor);
		if (objStart < 0) return null;
		let i = objStart;
		let depth = 0;
		let inStr = false;
		let quote: '"' | "'" | null = null;
		while (i < s.length) {
			const ch = s[i];
			if (inStr) {
				if (ch === '\\') {
					i += 2;
					continue;
				}
				if (ch === quote) {
					inStr = false;
					quote = null;
				}
				i++;
				continue;
			} else {
				if (ch === '"' || ch === "'") {
					inStr = true;
					quote = ch as '"' | "'";
					i++;
					continue;
				}
				if (ch === '{') {
					depth++;
					i++;
					continue;
				}
				if (ch === '}') {
					depth--;
					i++;
					if (depth === 0) break;
					continue;
				}
				i++;
			}
		}
		if (depth !== 0) return null;
		const jsonText = s.slice(objStart, i);
		let parsed: unknown;
		try {
			parsed = JSON.parse(jsonText);
		} catch {
			return null;
		}
		if (typeof parsed !== 'object' || parsed === null) return null;
		const pretty = JSON.stringify(parsed, null, 2);
		let k = i;
		while (k < s.length && /\s/.test(s[k])) k++;
		if (s[k] === '}') {
			k++;
			while (k < s.length && /\s/.test(s[k])) k++;
		}
		if (s.slice(k, k + 2) === '%%') k += 2;
		if (s[k] === '\r') k++;
		if (s[k] === '\n') k++;
		const consumed = k + (sourceText.length - s.length);
		const rest = sourceText.slice(consumed);
		return `%%{init: ${pretty} }%%\n` + rest;
	}

	if (showEditor) {
		const editorWrap = wrapper.createDiv({ cls: 'inmarkdown-editor' });
		const editorContainer = editorWrap.createDiv({ cls: 'inmarkdown-editor-cm' });
		embedded = createEmbeddableMarkdownEditor(plugin.app, editorContainer, {
			value: initialSource,
			placeholder,
			onChange: () => {
				if (embedded) currentValue = embedded.value;
				scheduleRender();
			},
		});

		// Editor toolbar (top-right icons)
		const toolbar = editorWrap.createDiv({ cls: 'inmarkdown-editor-toolbar' });
		const btnCopy = toolbar.createEl('button', {
			attr: { type: 'button' },
			cls: 'clickable-icon',
		});
		const iCopy = document.createElement('span');
		setIcon(iCopy, 'copy');
		btnCopy.appendChild(iCopy);
		btnCopy.setAttr('aria-label', t('playground.copyToClipboard'));
		btnCopy.addEventListener('click', async () => {
			try {
				if (embedded) await navigator.clipboard.writeText(embedded.value);
			} catch {
				try {
					const ta = document.createElement('textarea');
					ta.value = embedded ? embedded.value : currentValue;
					document.body.appendChild(ta);
					ta.select();
					document.execCommand('copy');
					ta.remove();
				} catch {
					// Ignore clipboard fallback errors
				}
			}
			// feedback: turn into green check briefly
			try {
				setIcon(iCopy, 'check');
				btnCopy.classList.add('is-success');
				btnCopy.setAttr('aria-label', t('playground.copied'));
				setTimeout(() => {
					setIcon(iCopy, 'copy');
					btnCopy.classList.remove('is-success');
					btnCopy.setAttr('aria-label', t('playground.copyToClipboard'));
				}, 1200);
			} catch {
				// Ignore UI feedback errors
			}
		});

		const btnReset = toolbar.createEl('button', {
			attr: { type: 'button' },
			cls: 'clickable-icon',
		});
		const iReset = document.createElement('span');
		setIcon(iReset, 'rotate-ccw');
		btnReset.appendChild(iReset);
		btnReset.setAttr('aria-label', t('playground.resetToDefault'));
		btnReset.addEventListener('click', () => {
			try {
				if (embedded) embedded.set(initialSource, false);
				currentValue = initialSource;
				scheduleRender();
			} catch {
				// Ignore reset errors
			}
		});

		const btnNewNote = toolbar.createEl('button', {
			attr: { type: 'button' },
			cls: 'clickable-icon',
		});
		const iNew = document.createElement('span');
		setIcon(iNew, 'file-plus');
		btnNewNote.appendChild(iNew);
		btnNewNote.setAttr('aria-label', t('playground.createNewNote'));
		btnNewNote.addEventListener('click', async () => {
			try {
				const now = new Date();
				const pad = (n: number) => String(n).padStart(2, '0');
				const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
				const folder = 'Alphatex Playground';
				const baseName = `Playground-${stamp}.md`;
				const filePath = normalizePath(`${folder}/${baseName}`);
				// ensure folder
				try {
					if (!(await plugin.app.vault.adapter.exists(folder)))
						await plugin.app.vault.createFolder(folder);
				} catch {
					// Ignore folder creation errors
				}
				const content =
					`\`\`\`alphatex\n${embedded ? embedded.value : currentValue}\n\`\`\``.replace(
						/`/g,
						'`'
					);
				// vault.create() 已经返回 Promise<TFile>，不需要类型转换
				const file = await plugin.app.vault.create(filePath, content);
				// 使用类型守卫确保是 TFile 实例
				if (!(file instanceof TFile)) {
					throw new Error('创建的文件不是有效的 TFile 实例');
				}
				const leaf = plugin.app.workspace.getLeaf(true);
				await leaf.openFile(file);
			} catch (e) {
				console.warn('[Playground] 创建笔记失败', e);
			}
		});

		// Format init JSON button (使用顶层 formatInitHeader)
		const btnFormat = toolbar.createEl('button', {
			attr: { type: 'button' },
			cls: 'clickable-icon',
		});
		const iFmt = document.createElement('span');
		setIcon(iFmt, 'code');
		btnFormat.appendChild(iFmt);
		btnFormat.setAttr('aria-label', t('playground.formatInitJson'));
		btnFormat.addEventListener('click', () => {
			if (!embedded) return;
			try {
				const formatted = formatInitHeader(embedded.value);
				if (formatted && formatted !== embedded.value) {
					embedded.set(formatted, false);
					currentValue = embedded.value;
					new Notice(t('playground.initJsonFormatted'));
					scheduleRender();
				} else {
					new Notice(t('playground.noInitDetected'));
				}
			} catch (e) {
				console.warn('[Playground] 格式化 init 失败:', e);
				new Notice(t('playground.formatFailed'));
			}
		});

		if (readOnly) {
			// 简单只读（利用 CodeMirror DOM 属性）
			editorContainer.addClass('read-only');
			const cmEl = editorContainer.querySelector('.cm-content') as HTMLElement | null;
			if (cmEl) cmEl.setAttr('contenteditable', 'false');
		}
	}

	// 预览容器
	const previewWrap = wrapper.createDiv({ cls: 'inmarkdown-preview tabflow-doc-main-content' });

	let mounted: AlphaTexMountHandle | null = null;
	let debounceTimer: number | null = null;

	function scheduleRender() {
		if (debounceTimer) window.clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(() => {
			const win = window as unknown as {
				requestIdleCallback?: (
					cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void
				) => number;
			};
			if (typeof win.requestIdleCallback === 'function')
				win.requestIdleCallback(() => renderPreview());
			else renderPreview();
		}, debounceMs);
		onChange?.(currentValue);
	}

	async function renderPreview() {
		// 清理旧实例
		try {
			mounted?.destroy?.();
		} catch (e) {
			/* ignore */
		}
		previewWrap.empty();

		const resources: AlphaTabResources | undefined = (
			plugin as unknown as { resources?: AlphaTabResources }
		).resources;
		if (!resources || !resources.bravuraUri || !resources.alphaTabWorkerUri) {
			const holder = previewWrap.createDiv({ cls: 'alphatex-block' });
			holder.createEl('div', { text: t('playground.resourcesMissing') });
			const btn = holder.createEl('button', { text: t('playground.downloadResources') });
			btn.addEventListener('click', async () => {
				btn.setAttr('disabled', 'true');
				btn.setText(t('playground.downloading'));
				try {
					interface Downloader {
						downloadAssets?: () => Promise<boolean>;
					}
					const ok = await (plugin as unknown as Downloader).downloadAssets?.();
					btn.removeAttribute('disabled');
					btn.setText(
						ok ? t('playground.downloadCompleted') : t('playground.downloadFailed')
					);
				} catch (e) {
					btn.removeAttribute('disabled');
					btn.setText(t('playground.downloadFailed'));
				}
			});
			return;
		}

		// 动态加载渲染函数
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { mountAlphaTexBlock } = require('../markdown/AlphaTexBlock');
		try {
			mounted = mountAlphaTexBlock(previewWrap, currentValue, resources, {
				scale: 1,
				speed: 1,
				scrollMode: 'Continuous',
				metronome: false,
				...alphaTabOptions,
			});
		} catch (e) {
			console.warn('[Playground] AlphaTex 渲染失败:', e);
			const err = previewWrap.createDiv({ cls: 'alphatex-block' });
			const msg = e instanceof Error ? e.message : String(e);
			err.createEl('div', {
				cls: 'alphatex-error',
				text: t('playground.engineError') + msg,
			});
		}
	}

	// 初次渲染
	renderPreview();

	// 订阅事件
	if (eventBus) {
		eventBus.subscribe('命令:播放暂停', () => {
			const api = mounted?.api;
			if (api) api.playPause();
		});

		eventBus.subscribe('命令:停止', () => {
			const api = mounted?.api;
			if (api) api.stop();
		});

		eventBus.subscribe('命令:设置速度', (speed: number) => {
			const api = mounted?.api;
			if (api) api.playbackSpeed = speed;
		});

		eventBus.subscribe('命令:设置谱表', (profile: number) => {
			const api = mounted?.api;
			if (api) {
				(api.settings.display as any).staveProfile = profile;
				api.updateSettings();
				api.render();
			}
		});

		eventBus.subscribe('命令:设置缩放', (scale: number) => {
			const api = mounted?.api;
			if (api) {
				api.settings.display.scale = scale;
				api.updateSettings();
				api.render();
			}
		});

		eventBus.subscribe('命令:设置滚动模式', (mode: string) => {
			const api = mounted?.api;
			if (api) {
				(api.settings.player as any).scrollMode = mode;
				api.updateSettings();
			}
		});

		eventBus.subscribe('命令:滚动到顶部', () => {
			const api = mounted?.api;
			if (api) api.tickPosition = 0;
		});

		eventBus.subscribe('命令:滚动到底部', () => {
			const api = mounted?.api;
			if (api && api.score) {
				const masterBars = api.score.masterBars;
				if (masterBars && masterBars.length > 0) {
					const lastBar = masterBars[masterBars.length - 1];
					const endTick = lastBar.start + lastBar.calculateDuration();
					api.tickPosition = endTick;
				}
			}
		});

		eventBus.subscribe('命令:滚动到光标', () => {
			const api = mounted?.api;
			if (api) (api as any).scrollToCursor?.();
		});

		eventBus.subscribe('命令:重新构造AlphaTabApi', () => {
			renderPreview();
		});
	}

	// 观察移除，销毁实例
	const observer = new MutationObserver(() => {
		if (!document.body.contains(wrapper)) {
			try {
				mounted?.destroy?.();
			} catch (e) {
				/* ignore */
			}
			observer.disconnect();
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });

	return {
		getValue: () => currentValue,
		setValue: (v: string) => {
			currentValue = v;
			if (embedded) embedded.set(v, false);
			scheduleRender();
		},
		destroy: () => {
			try {
				mounted?.destroy?.();
			} catch (e) {
				/* silent */
			}
			observer.disconnect();
			wrapper.detach();
		},
		refresh: () => renderPreview(),
		getApi: () => mounted?.api || null,
	};
}
