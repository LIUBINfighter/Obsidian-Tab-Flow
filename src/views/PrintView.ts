import { FileView, TFile, WorkspaceLeaf, Notice } from 'obsidian';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import domtoimage from 'dom-to-image-more';
import TabFlowPlugin from '../main';
import { PlayerController, type PlayerControllerResources } from '../player/PlayerController';
import { StoreFactory, type StoreCollection } from '../player/store/StoreFactory';
import { TablatureView } from '../player/components/TablatureView';
import { t } from '../i18n';

export const VIEW_TYPE_PRINT = 'alphatex-print-view';

export class PrintView extends FileView {
	private playerStoreFactory: StoreFactory;
	private playerStores: StoreCollection | null = null;
	private playerController: PlayerController | null = null;
	private playerRoot: Root | null = null;
	private playerContainer: HTMLDivElement | null = null;
	private printContainer: HTMLDivElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: TabFlowPlugin
	) {
		super(leaf);
		this.playerStoreFactory = new StoreFactory(plugin);
	}

	getViewType(): string {
		return VIEW_TYPE_PRINT;
	}

	getDisplayText(): string {
		if (this.file) {
			return `${this.file.basename} (打印预览)`;
		}
		return t('print.view.title', undefined, '打印预览');
	}

	getIcon(): string {
		return 'printer';
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.file = file;
		await this.render();
	}

	async onUnloadFile(_file: TFile): Promise<void> {
		this.cleanup();
	}

	onunload(): void {
		this.cleanup();
	}

	private cleanup(): void {
		if (this.playerRoot) {
			this.playerRoot.unmount();
			this.playerRoot = null;
		}
		if (this.playerController) {
			this.playerController.destroy();
			this.playerController = null;
		}
		if (this.playerStores) {
			this.playerStoreFactory.destroyStores(this.playerStores);
			this.playerStores = null;
		}
		if (this.playerContainer) {
			this.playerContainer.remove();
			this.playerContainer = null;
		}
		this.printContainer = null;
	}

	private getPlayerResources(): PlayerControllerResources | null {
		const resources = this.plugin.resources;
		if (!resources?.bravuraUri || !resources.alphaTabWorkerUri) {
			return null;
		}
		return {
			bravuraUri: resources.bravuraUri || '',
			alphaTabWorkerUri: resources.alphaTabWorkerUri || '',
			soundFontUri: resources.soundFontUri || '',
		};
	}

	private async render(): Promise<void> {
		if (!this.file) return;

		this.cleanup();
		this.contentEl.empty();

		const resources = this.getPlayerResources();
		if (!resources) {
			new Notice(
				t(
					'print.missingResources',
					undefined,
					'AlphaTab 资源缺失，无法显示打印预览。请先下载资源。'
				)
			);
			return;
		}

		let content = '';
		try {
			content = await this.app.vault.read(this.file);
		} catch (e) {
			console.error('[PrintView] 读取文件失败:', e);
			return;
		}

		const wrapper = this.contentEl.createDiv({ cls: 'tabflow-print-view-root' });
		const toolbar = wrapper.createDiv({ cls: 'tabflow-print-toolbar' });
		const previewArea = wrapper.createDiv({ cls: 'tabflow-print-preview-area' });

		const refreshBtn = toolbar.createEl('button', {
			text: t('print.refresh', undefined, '刷新预览'),
		});
		refreshBtn.addEventListener('click', () => {
			void this.render();
		});

		const exportBtn = toolbar.createEl('button', {
			text: t('print.exportPdf', undefined, '导出 PDF'),
		});
		exportBtn.addEventListener('click', () => {
			void this.exportPdf();
		});

		this.printContainer = previewArea.createDiv({ cls: 'tabflow-print-page-container' });
		this.printContainer.style.position = 'relative';
		this.printContainer.style.backgroundColor = 'white';
		this.printContainer.style.padding = '16px';
		this.printContainer.style.boxSizing = 'border-box';

		this.playerStores = this.playerStoreFactory.createStores(this);
		this.playerController = new PlayerController(this.plugin, resources, this.playerStores);
		this.playerContainer = this.printContainer.createDiv({
			cls: 'react-tab-print-container',
			attr: {
				style: 'width: 100%; height: 100%; position: relative;',
			},
		});
		this.playerRoot = createRoot(this.playerContainer);

		this.playerRoot.render(
			React.createElement(TablatureView, {
				controller: this.playerController,
				options: {
					showDebugBar: false,
					showPlayBar: false,
					showSettingsPanel: false,
					showTracksPanel: false,
					showMediaSync: false,
				},
			})
		);

		// 使用控制器内置的懒加载逻辑，等 API ready 后再加载文件
		if (this.playerController && this.file) {
			await this.playerController
				.loadFileWhenReady(this.file)
				.catch((error) => console.error('[PrintView] 预览渲染失败:', error));
		}
	}

	private async exportPdf(): Promise<void> {
		if (!this.printContainer) {
			new Notice(t('print.noPreview', undefined, '没有可导出的预览内容'));
			return;
		}

		try {
			const rect = this.printContainer.getBoundingClientRect();
			const scale = 2;
			const width = rect.width * scale;
			const height = rect.height * scale;

			const dataUrl = await domtoimage.toPng(this.printContainer, {
				width,
				height,
				style: {
					transform: `scale(${scale})`,
					transformOrigin: 'top left',
				},
			});

			const doc = new jsPDF('p', 'pt', 'a4');
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();

			const ratio = Math.min(pageWidth / width, pageHeight / height);
			const pdfWidth = width * ratio;
			const pdfHeight = height * ratio;
			const x = (pageWidth - pdfWidth) / 2;
			const y = (pageHeight - pdfHeight) / 2;

			doc.addImage(dataUrl, 'PNG', x, y, pdfWidth, pdfHeight);
			const baseName = this.file ? this.file.basename : 'score';
			doc.save(`${baseName}.pdf`);
			new Notice(t('print.exportSuccess', undefined, 'PDF 导出成功'));
		} catch (e) {
			console.error('[PrintView] 导出 PDF 失败:', e);
			new Notice(t('print.exportFailed', undefined, '导出 PDF 失败'));
		}
	}
}
