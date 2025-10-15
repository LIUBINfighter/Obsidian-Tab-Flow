import { FileView, TFile, WorkspaceLeaf, Plugin } from 'obsidian';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { TablatureView } from './components/TablatureView';
import { usePlayerStore } from './store/playerStore';

export const VIEW_TYPE_REACT = 'react-tab-view';

export type AlphaTabResources = {
	bravuraUri: string;
	alphaTabWorkerUri: string;
	soundFontUri: string;
};

export class ReactView extends FileView {
	private currentFile: TFile | null = null;
	private plugin: Plugin;
	private resources: AlphaTabResources;
	private root: Root | null = null;
	private reactContainer: HTMLDivElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		plugin: Plugin,
		resources: AlphaTabResources
	) {
		super(leaf);
		this.plugin = plugin;
		this.resources = resources;
	}

	getViewType(): string {
		return VIEW_TYPE_REACT;
	}

	getDisplayText(): string {
		const scoreTitle = usePlayerStore.getState().scoreTitle;
		if (scoreTitle && scoreTitle.trim()) {
			return scoreTitle;
		}
		if (this.currentFile) {
			return this.currentFile.basename;
		}
		return 'React Tab View';
	}

	async onOpen() {
		// 创建容器元素
		this.reactContainer = this.contentEl.createDiv({ 
			cls: 'react-tab-view-container',
			attr: {
				style: 'width: 100%; height: 100%; position: relative;'
			}
		});

		// 创建 React root 并渲染
		this.root = createRoot(this.reactContainer);
		this.renderReactComponent();

		console.debug('[ReactView] View opened');
	}

	async onClose() {
		// 清理 React root
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}

		// 清理容器
		if (this.reactContainer) {
			this.reactContainer.remove();
			this.reactContainer = null;
		}

		// 清理 store 中的 API
		const { api, setApi } = usePlayerStore.getState();
		if (api) {
			try {
				api.destroy();
			} catch (error) {
				console.error('[ReactView] Error destroying AlphaTab API:', error);
			}
			setApi(null);
		}

		this.currentFile = null;
		console.debug('[ReactView] View closed and resources cleaned up');
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.currentFile = file;
		console.debug(`[ReactView] Loading file: ${file.name}`);

		try {
			const { api } = usePlayerStore.getState();
			
			if (!api) {
				console.warn('[ReactView] AlphaTab API not ready yet, waiting...');
				// 等待 API 初始化
				await new Promise(resolve => setTimeout(resolve, 500));
			}

			const currentApi = usePlayerStore.getState().api;
			if (!currentApi) {
				console.error('[ReactView] AlphaTab API still not available');
				return;
			}

			// 加载文件内容
			if (file.extension && ['alphatab', 'alphatex'].includes(file.extension.toLowerCase())) {
				const textContent = await this.app.vault.read(file);
				currentApi.tex(textContent);
			} else {
				const inputFile = await this.app.vault.readBinary(file);
				currentApi.load(new Uint8Array(inputFile));
			}

			console.debug(`[ReactView] File loaded successfully: ${file.name}`);
		} catch (error) {
			console.error('[ReactView] Failed to load file:', error);
		}
	}

	async onUnloadFile(file: TFile): Promise<void> {
		console.debug(`[ReactView] Unloading file: ${file.name}`);
		this.currentFile = null;
		await super.onUnloadFile(file);
	}

	private renderReactComponent() {
		if (!this.root) return;

		this.root.render(
			React.createElement(TablatureView, {
				resources: this.resources
			})
		);
	}
}
