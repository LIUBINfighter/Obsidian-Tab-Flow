// 示例面板：InMarkdownRender
import type MyPlugin from '../../main';
import type { AlphaTabResources } from '../../services/ResourceLoaderService';

const SAMPLE = `%%{init: {"scale":1,"speed":2,"scrollMode":"Continuous","metronome":false,"player":"disable"}}%%

\\title "Canon Rock"
\\subtitle "JerryC"
\\tempo 90
.
:2 19.2{v f} 17.2{v f} | `;

export default {
	id: 'in-markdown',
	title: '文本与曲谱预览',
	render(container: HTMLElement, plugin?: MyPlugin) {
		container.empty();

	const wrapper = container.createDiv({ cls: 'inmarkdown-wrapper' });

	// Stack vertically: editor on top, preview below
	const editorWrap = wrapper.createDiv({ cls: 'inmarkdown-editor' });
	// textarea for alphatex source (top)
	const ta = editorWrap.createEl('textarea');
	ta.style.width = '100%';
	ta.style.height = '220px';
	ta.value = SAMPLE;

	// preview container (bottom)
	const previewWrap = wrapper.createDiv({ cls: 'inmarkdown-preview tabflow-doc-main-content' });

		// helper to render using mountAlphaTexBlock
		let mounted: { destroy?: () => void } | null = null;
		const renderPreview = async () => {
			// destroy previous
			try { if (mounted && mounted.destroy) mounted.destroy(); } catch (e) { console.warn('destroy previous preview failed', e); }
			previewWrap.empty();

			if (!plugin) {
				previewWrap.createEl('div', { text: '缺少 plugin 上下文，无法渲染' });
				return;
			}

			const resources = (plugin as unknown as { resources?: AlphaTabResources | undefined }).resources;
			if (!resources || !resources.bravuraUri || !resources.alphaTabWorkerUri) {
				const holder = previewWrap.createDiv({ cls: 'alphatex-block' });
				holder.createEl('div', { text: 'AlphaTab 资源缺失，无法渲染预览。' });
				const btn = holder.createEl('button', { text: '下载资源' });
				btn.addEventListener('click', async () => {
					btn.setAttr('disabled', 'true');
					btn.setText('下载中...');
					try {
						const downloader = plugin as unknown as { downloadAssets?: () => Promise<boolean> };
						let ok = false;
						if (downloader && typeof downloader.downloadAssets === 'function') {
							ok = await downloader.downloadAssets();
						}
						btn.removeAttribute('disabled');
						btn.setText(ok ? '下载完成，请重新渲染' : '下载失败，重试');
					} catch (e) {
						btn.removeAttribute('disabled');
						btn.setText('下载失败，重试');
						console.warn('downloadAssets failed', e);
					}
				});
				return;
			}

			// dynamic require to avoid heavy deps at module load
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { mountAlphaTexBlock } = require('../../markdown/AlphaTexBlock');
			try {
				mounted = mountAlphaTexBlock(previewWrap, ta.value, resources, {
					scale: 1,
					speed: 1,
					scrollMode: 'Continuous',
					metronome: false,
				});
			} catch (e) {
				console.warn('mountAlphaTexBlock failed', e);
				previewWrap.createEl('div', { text: '渲染失败：' + String(e) });
			}
		};

		// initial render
		renderPreview();

		// re-render on change with debounce
		let t: number | null = null;
		ta.addEventListener('input', () => {
			if (t) clearTimeout(t);
			t = window.setTimeout(() => renderPreview(), 350);
		});

		// cleanup when container is removed
		// observe DOM removal to destroy mounted block
		const observer = new MutationObserver(() => {
			if (!document.body.contains(wrapper)) {
				try { if (mounted && mounted.destroy) mounted.destroy(); } catch (e) { console.warn('destroy on remove failed', e); }
				observer.disconnect();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}
};


