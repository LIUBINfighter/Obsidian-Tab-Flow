import type MyPlugin from '../main';
import type { AlphaTabResources } from '../services/ResourceLoaderService';
import { createEmbeddableMarkdownEditor } from '../editor/EmbeddableMarkdownEditor';

export interface AlphaTexPlaygroundOptions {
	placeholder?: string;
	debounceMs?: number;
	readOnly?: boolean;
	onChange?: (value: string) => void;
	/** 额外 alphaTab 渲染参数 (可覆盖内置默认) */
	alphaTabOptions?: Record<string, unknown>;
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
	const { placeholder = '输入 AlphaTex 内容...', debounceMs = 350, readOnly = false, onChange, alphaTabOptions = {} } = options;

	container.empty();
	const wrapper = container.createDiv({ cls: 'alphatex-playground inmarkdown-wrapper' });

	// 编辑器容器
	const editorWrap = wrapper.createDiv({ cls: 'inmarkdown-editor' });
	const editorContainer = editorWrap.createDiv({ cls: 'inmarkdown-editor-cm' });
	const embedded = createEmbeddableMarkdownEditor(plugin.app, editorContainer, {
		value: initialSource,
		placeholder,
		onChange: () => scheduleRender(),
	});
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
			previewWrap.createEl('div', { text: '渲染失败：' + String(e) });
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
