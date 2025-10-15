import { FileView, TFile, WorkspaceLeaf, Plugin } from 'obsidian';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { TablatureView } from './components/TablatureView';
import { PlayerController } from './PlayerController';
import { useRuntimeStore } from './store/runtimeStore';

export const VIEW_TYPE_REACT = 'react-tab-view';

export class ReactView extends FileView {
	private currentFile: TFile | null = null;
	private plugin: Plugin;
	private root: Root | null = null;
	private reactContainer: HTMLDivElement | null = null;
	private controller: PlayerController | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_REACT;
	}

	getDisplayText(): string {
		if (this.currentFile) {
			return this.currentFile.basename;
		}
		return 'Tab Player';
	}

	async onOpen() {
		console.debug('[ReactView] Opening view');

		// 创建 PlayerController
		this.controller = new PlayerController();

		// 创建容器元素
		this.reactContainer = this.contentEl.createDiv({
			cls: 'react-tab-view-container',
			attr: {
				style: 'width: 100%; height: 100%; position: relative;',
			},
		});

		// 创建 React root 并渲染
		this.root = createRoot(this.reactContainer);
		this.renderReactComponent();

		console.debug('[ReactView] View opened');
	}

	async onClose() {
		console.debug('[ReactView] Closing view');

		// 清理 React root
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}

		// 清理 PlayerController
		if (this.controller) {
			this.controller.destroy();
			this.controller = null;
		}

		// 清理容器
		if (this.reactContainer) {
			this.reactContainer.remove();
			this.reactContainer = null;
		}

		this.currentFile = null;
		console.debug('[ReactView] View closed and resources cleaned up');
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.currentFile = file;
		console.debug(`[ReactView] Loading file: ${file.name}`);

		if (!this.controller) {
			console.error('[ReactView] PlayerController not initialized');
			return;
		}

		try {
			// 等待 API 准备好
			const maxRetries = 10;
			let retries = 0;
			while (!useRuntimeStore.getState().apiReady && retries < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				retries++;
			}

			if (!useRuntimeStore.getState().apiReady) {
				console.error('[ReactView] API not ready after retries');
				return;
			}

			// 加载文件内容
			if (file.extension && ['alphatab', 'alphatex'].includes(file.extension.toLowerCase())) {
				const textContent = await this.app.vault.read(file);
				await this.controller.loadScoreFromAlphaTex(textContent);
			} else {
				const inputFile = await this.app.vault.readBinary(file);
				await this.controller.loadScoreFromFile(inputFile, file.name);
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
		if (!this.root || !this.controller) return;

		this.root.render(
			React.createElement(TablatureView, {
				controller: this.controller,
			})
		);
	}
}
