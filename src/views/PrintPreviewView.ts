import { FileView, WorkspaceLeaf, ButtonComponent, TFile } from 'obsidian';
import type TabFlowPlugin from '../main';
import { t } from '../i18n';
import * as alphaTab from '@coderline/alphatab';
import { PrintTracksPanelDom } from '../player/components/PrintTracksPanel';

export const VIEW_TYPE_PRINT_PREVIEW = 'tab-flow-print-preview';

export class PrintPreviewView extends FileView {
	plugin: TabFlowPlugin;
	private iframe: HTMLIFrameElement | null = null;
	private previewContainer: HTMLElement | null = null;
	private api: alphaTab.AlphaTabApi | null = null;
	private sidebarEl: HTMLElement | null = null;
	private tracksPanel: PrintTracksPanelDom | null = null;
	private isSidebarCollapsed = false;

	constructor(leaf: WorkspaceLeaf, plugin: TabFlowPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_PRINT_PREVIEW;
	}

	getDisplayText(): string {
		// 如果有文件，显示文件名
		if (this.file) {
			return `${this.file.basename} - Print Preview`;
		}
		return t('printPreview.title', undefined, 'Print Preview');
	}

	getIcon(): string {
		return 'printer';
	}

	/**
	 * 获取打印用的显示参数。
	 *
	 * 目前直接返回硬编码默认值，后续可以从插件设置中读取，
	 * 例如：this.plugin.settings.print.scale / stretchForce。
	 */
	private getPrintDisplayConfig(): { scale: number; stretchForce: number } {
		return {
			// 稍微缩小一点，给分页留出安全边距
			scale: 0.95,
			// 轻微降低拉伸力，避免行间过度拥挤
			stretchForce: 0.9,
		};
	}

	// FileView 要求实现：判断是否可以接受文件扩展名
	canAcceptExtension(extension: string): boolean {
		const accepted = ['gp', 'gp3', 'gp4', 'gp5', 'gpx', 'gp7', 'alphatex', 'alphatab'];
		return accepted.includes(extension.toLowerCase());
	}

	// FileView 要求实现：加载文件
	async onLoadFile(file: TFile): Promise<void> {
		console.log('[PrintPreview] Loading file:', file.path);

		// 确保视图已经打开
		if (!this.previewContainer) {
			console.warn('[PrintPreview] Preview container not ready, waiting...');
			// 等待视图打开
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		try {
			const extension = file.extension.toLowerCase();
			if (['alphatab', 'alphatex'].includes(extension)) {
				// AlphaTex 文本文件
				const content = await this.app.vault.read(file);
				await this.renderScore('alphatex', content);
			} else {
				// 二进制文件 (gp5, gpx, etc.)
				const arrayBuffer = await this.app.vault.readBinary(file);
				const uint8Array = new Uint8Array(arrayBuffer);
				await this.renderScore('binary', uint8Array);
			}
		} catch (error) {
			console.error('[PrintPreview] Failed to load file:', error);
		}
	}

	// FileView 要求实现：卸载文件
	async onUnloadFile(file: TFile): Promise<void> {
		console.log('[PrintPreview] Unloading file:', file.path);
		// 清理 API
		if (this.api) {
			try {
				this.api.destroy();
			} catch (error) {
				console.warn('[PrintPreview] Error destroying API:', error);
			}
			this.api = null;
		}
	}

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.addClass('tabflow-print-preview-view');
		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.height = '100%';

		// 1. Toolbar
		const toolbar = container.createDiv({ cls: 'print-preview-toolbar' });
		toolbar.style.display = 'flex';
		toolbar.style.gap = '10px';
		toolbar.style.padding = '10px';
		toolbar.style.borderBottom = '1px solid var(--background-modifier-border)';
		toolbar.style.justifyContent = 'space-between';
		toolbar.style.flexShrink = '0';

		const leftToolbar = toolbar.createDiv();
		leftToolbar.style.display = 'flex';
		leftToolbar.style.gap = '8px';

		const rightToolbar = toolbar.createDiv();
		rightToolbar.style.display = 'flex';
		rightToolbar.style.gap = '8px';

		new ButtonComponent(leftToolbar)
			.setIcon('layout-sidebar-left')
			.setTooltip(t('printPreview.toggleTrackPanel', undefined, 'Toggle track panel'))
			.onClick(() => this.toggleSidebar());

		new ButtonComponent(rightToolbar)
			.setButtonText(t('common.print', undefined, 'Print'))
			.setIcon('printer')
			.setCta()
			.onClick(() => {
				this.handlePrint();
			});

		// 2. Body: 左侧轨道面板 + 右侧预览
		const body = container.createDiv({ cls: 'print-preview-body' });
		body.style.flex = '1';
		body.style.display = 'flex';
		body.style.flexDirection = 'row';
		body.style.minHeight = '0';

		// 左侧：打印用 Track/Staff 面板
		this.sidebarEl = body.createDiv('tabflow-print-sidebar');

		// 右侧：iframe 预览区域
		const previewWrapper = body.createDiv('tabflow-print-preview-wrapper');
		previewWrapper.style.flex = '1';
		previewWrapper.style.overflow = 'auto';
		previewWrapper.style.padding = '20px';
		previewWrapper.style.display = 'flex';
		previewWrapper.style.justifyContent = 'center';
		previewWrapper.style.alignItems = 'flex-start';
		previewWrapper.style.backgroundColor = 'var(--background-secondary)';

		// Create iframe for print preview（宽度贴近 A4，内部不再二次添加水平 padding）
		const iframe = previewWrapper.createEl('iframe', {
			cls: 'print-preview-iframe',
		});
		iframe.style.width = '210mm';
		iframe.style.height = 'auto';
		iframe.style.border = 'none';
		iframe.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
		iframe.style.backgroundColor = 'white';
		iframe.style.display = 'block';
		iframe.scrolling = 'no';

		// Wait for iframe to load
		iframe.onload = () => {
			this.setupIframeContent(iframe);
		};

		// Initialize iframe document（仅负责布局，不在此处加载 Bravura 字体）
		const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
		if (iframeDoc) {
			iframeDoc.open();
			iframeDoc.write(`
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="UTF-8">
					<title>Print Preview</title>
					<style>
						* {
							margin: 0;
							padding: 0;
							box-sizing: border-box;
						}
						
						html, body {
							overflow: visible;
							height: auto;
							width: 100%;
						}
						
						body {
							font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
							background: white;
							color: black;
						}
						
						/* A4 page settings：交给打印引擎控制纸张与统一边距 */
						@page {
							size: A4;
							margin: 10mm;
						}
						
						@media print {
							html, body {
								/* 确保打印时可见 */
								overflow: visible !important;
								height: auto !important;
								background: white !important;
							}
							
							.content-area {
								/* 打印时让 AlphaTab 的 page 布局直接贴边由 @page 控制可打印区域 */
								margin: 0;
								padding: 0;
							}
							
							/* 确保 SVG 在打印时可见 */
							svg {
								display: block !important;
								visibility: visible !important;
								opacity: 1 !important;
							}
						}
						
						.content-area {
							/* Content will auto-expand; AlphaTab page 布局负责分页 */
							width: 100%;
							position: relative;
						}
						
						/* 确保 AlphaTab 容器正确显示（字体由 AlphaTab 自己加载） */
						.alphaTab {
							width: 100%;
							position: relative;
						}
					</style>
				</head>
				<body>
					<div class="content-area" id="scoreContent">
						<!-- Content will be inserted here -->
					</div>
				</body>
				</html>
			`);
			iframeDoc.close();
		}
	}

	private setupIframeContent(iframe: HTMLIFrameElement) {
		const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
		if (!iframeDoc) return;

		const contentArea = iframeDoc.getElementById('scoreContent');
		if (!contentArea) return;

		// 内部实际渲染容器：AlphaTab 直接渲染到此处
		this.previewContainer = contentArea;

		// 保存 iframe 引用
		this.iframe = iframe;

		// 设置自动高度调整
		this.setupAutoResize(iframe);

		// 如果已经有 AlphaTab API，建立与轨道面板的连接
		if (this.api && this.sidebarEl) {
			this.ensureTracksPanel();
			this.tracksPanel?.setApi(this.api);
		}

		// 如果已经有文件，加载它
		if (this.file) {
			void this.onLoadFile(this.file);
		}
	}

	/**
	 * 懒创建左侧 Track/Staff 打印面板
	 */
	private ensureTracksPanel() {
		if (!this.sidebarEl) return;
		if (!this.tracksPanel) {
			this.tracksPanel = new PrintTracksPanelDom({
				container: this.sidebarEl,
				api: this.api,
				// 右侧渲染变化时，重新调整 iframe 高度
				onConfigChanged: () => {
					this.adjustIframeHeight();
				},
			});
		} else if (this.api) {
			this.tracksPanel.setApi(this.api);
		}
	}

	private toggleSidebar() {
		if (!this.sidebarEl) return;
		this.isSidebarCollapsed = !this.isSidebarCollapsed;
		if (this.isSidebarCollapsed) {
			this.sidebarEl.style.display = 'none';
		} else {
			this.sidebarEl.style.display = 'flex';
		}
		this.adjustIframeHeight();
	}

	/**
	 * 设置 iframe 自动调整高度
	 */
	private setupAutoResize(iframe: HTMLIFrameElement) {
		// 初始调整
		setTimeout(() => this.adjustIframeHeight(), 100);

		// 监听内容变化（使用 MutationObserver）
		const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
		if (iframeDoc?.body) {
			const observer = new MutationObserver(() => {
				this.adjustIframeHeight();
			});

			observer.observe(iframeDoc.body, {
				childList: true,
				subtree: true,
				attributes: true,
			});

			// 清理时断开观察
			iframe.addEventListener('unload', () => {
				observer.disconnect();
			});
		}
	}

	/**
	 * 调整 iframe 高度以适应内容
	 */
	private adjustIframeHeight() {
		if (!this.iframe) return;

		const iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow?.document;
		if (!iframeDoc?.body) return;

		// 直接使用 body scrollHeight 作为 iframe 高度
		const height = iframeDoc.body.scrollHeight;
		this.iframe.style.height = height + 'px';

		console.log('[PrintPreview] Iframe height adjusted to:', height);
	}

	/**
	 * 在 iframe 环境中给 AlphaTab 一点初始化时间
	 * 不再主动通过 document.fonts 拉取字体，由 AlphaTab 自己加载 Bravura
	 */
	private async ensureFontsReady(): Promise<void> {
		if (!this.iframe) return;
		const iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow?.document;
		if (!iframeDoc) return;

		try {
			console.log('[PrintPreview] ensureFontsReady: start');
			// 基础等待：给 AlphaTab 和布局引擎一点时间
			await new Promise((resolve) => setTimeout(resolve, 150));
			console.log('[PrintPreview] ensureFontsReady: done');
		} catch (e) {
			console.warn('[PrintPreview] ensureFontsReady error:', e);
		}
	}

	private async renderScore(type: 'alphatex' | 'binary', content: string | Uint8Array) {
		if (!this.previewContainer) return;

		this.previewContainer.innerHTML = '';

		// 检查资源是否可用
		const resources = this.plugin.resources;
		console.log('[PrintPreview] renderScore resources snapshot:', resources);
		if (!resources?.bravuraUri || !resources.alphaTabWorkerUri || !resources.soundFontUri) {
			const errorDiv = this.previewContainer.createDiv({ cls: 'print-error' });
			errorDiv.setText(t('playground.resourcesMissing'));
			console.error('[PrintPreview] Resources not available');
			return;
		}

		try {
			// 在创建 AlphaTab 之前，尽量等 iframe 内字体准备好
			await this.ensureFontsReady();

			// 销毁旧的 API 实例
			if (this.api) {
				try {
					this.api.destroy();
				} catch (e) {
					console.warn('[PrintPreview] Error destroying old API:', e);
				}
				this.api = null;
			}

			// 创建打印优化的 AlphaTab 配置
			const settings = this.createPrintSettings({
				bravuraUri: resources.bravuraUri,
				alphaTabWorkerUri: resources.alphaTabWorkerUri,
				soundFontUri: resources.soundFontUri,
			});

			// 创建 AlphaTab API 实例
			console.log('[PrintPreview] Creating AlphaTab API with print-optimized settings');
			this.api = new alphaTab.AlphaTabApi(this.previewContainer, settings);

			// 初始化或更新左侧 Track/Staff 面板
			if (this.sidebarEl) {
				this.ensureTracksPanel();
			}

			// 监听渲染完成事件
			this.api.renderFinished.on(() => {
				console.log('[PrintPreview] Render finished');
				this.adjustIframeHeight();
			});

			// 监听错误事件
			this.api.error.on((error: Error) => {
				console.error('[PrintPreview] AlphaTab error:', error);
			});

			// 加载乐谱
			if (type === 'alphatex') {
				const textContent = content as string;
				console.log('[PrintPreview] Loading AlphaTex score, length:', textContent.length);
				this.api.tex(textContent);
			} else if (type === 'binary') {
				const binaryContent = content as Uint8Array;
				console.log('[PrintPreview] Loading binary score, size:', binaryContent.byteLength);
				await this.api.load(binaryContent);
			}
		} catch (error) {
			console.error('[PrintPreview] Failed to render score:', error);
			const errorDiv = this.previewContainer.createDiv({ cls: 'print-error' });
			errorDiv.setText(
				`Failed to render score: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * 创建打印优化的 AlphaTab 设置
	 * 参考 AlphaTab 官方文档的打印优化建议：
	 * - 禁用懒加载
	 * - 使用原始尺寸（scale: 1.0）避免分页错位
	 * - 不压缩拉伸力（stretchForce: 1.0）
	 * - A4 宽度优化
	 */
	private createPrintSettings(resources: {
		bravuraUri: string;
		alphaTabWorkerUri: string;
		soundFontUri: string;
	}): alphaTab.Settings {
		const displayConfig = this.getPrintDisplayConfig();

		// 为打印视图单独构造一个带时间戳的 Bravura 字体 URL，避免与其他视图共享缓存
		// 这样每次打开 PrintPreview，浏览器都会认为是一个"新"的字体请求，
		// 有助于稳定触发一次完整的字体加载流程，降低首开豆腐块概率。
		const ts = Date.now();
		const sep = resources.bravuraUri.includes('?') ? '&' : '?';
		const bravuraWithTs = `${resources.bravuraUri}${sep}_print_ts=${ts}`;

		const settingsJson = {
			core: {
				engine: 'svg' as const,
				useWorkers: true,
				logLevel: 1, // Warning level
				scriptFile: resources.alphaTabWorkerUri,
				fontDirectory: '',
				file: null,
				// ✅ 禁用懒加载（打印优化）
				enableLazyLoading: false,
			},
			player: {
				// ✅ 禁用播放器（仅渲染）
				enablePlayer: false,
				soundFont: resources.soundFontUri,
			},
			display: {
				// ✅ 打印优化：使用可配置的比例和拉伸力
				// 这里不追求像素级“填满整页”，而是尽量减少跨页抖动
				scale: displayConfig.scale,
				// ✅ 轻微降低拉伸力，避免行间过度压缩导致分页临界
				stretchForce: displayConfig.stretchForce,
				// 使用页面布局（A4 纵向）
				layoutMode: alphaTab.LayoutMode.Page,
				// 从第一小节开始
				startBar: 1,
				// 明确控制每行小节数（可选，如果需要更紧凑的布局可以调整）
				// barsPerRow: 4,
			},
		};

		const settings = new alphaTab.Settings();
		settings.fillFromJson(settingsJson);

		// 配置字体：使用带时间戳的 Bravura URL，强制 PrintPreview 每次打开都触发一次字体加载
		if (resources.bravuraUri) {
			settings.core.smuflFontSources = new Map([
				[alphaTab.FontFileFormat.Woff2, bravuraWithTs],
			]);
		}

		console.log('[PrintPreview] Print-optimized settings created:', {
			scale: settings.display.scale,
			stretchForce: settings.display.stretchForce,
			layoutMode: settings.display.layoutMode,
			enableLazyLoading: settings.core.enableLazyLoading,
			enablePlayer: settings.player.enablePlayer,
		});

		return settings;
	}

	private handlePrint() {
		if (!this.iframe?.contentWindow) {
			console.error('[PrintPreview] Iframe not ready');
			return;
		}

		try {
			console.log('[PrintPreview] Triggering print dialog...');

			// 确保 iframe 内容已完全加载
			const iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;
			if (!iframeDoc) {
				console.error('[PrintPreview] Cannot access iframe document');
				return;
			}

			// 打印前确保所有 SVG 元素可见
			const svgElements = iframeDoc.querySelectorAll('svg');
			console.log('[PrintPreview] Found SVG elements:', svgElements.length);

			// 聚焦 iframe 窗口并触发打印
			this.iframe.contentWindow.focus();

			// 使用 setTimeout 确保 focus 生效
			setTimeout(() => {
				if (this.iframe?.contentWindow) {
					this.iframe.contentWindow.print();
				}
			}, 100);
		} catch (e) {
			console.error('[PrintPreview] Print failed:', e);
		}
	}

	async onClose() {
		// 销毁 AlphaTab API
		if (this.api) {
			try {
				this.api.destroy();
			} catch (error) {
				console.warn('[PrintPreview] Error destroying API:', error);
			}
			this.api = null;
		}

		this.iframe = null;
		this.previewContainer = null;
		this.contentEl.empty();
	}
}
