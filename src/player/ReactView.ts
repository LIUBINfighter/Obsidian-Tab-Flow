import { FileView, TFile, WorkspaceLeaf } from 'obsidian';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { TablatureView } from './components/TablatureView';
import { PlayerController, type PlayerControllerResources } from './PlayerController';
import { StoreFactory, type StoreCollection } from './store/StoreFactory';
import type TabFlowPlugin from '../main';

export const VIEW_TYPE_REACT = 'react-tab-view';

// 全局字体注入标记（避免多次注入冲突）
let fontStyleInjected = false;
let globalFontStyle: HTMLStyleElement | null = null;

export class ReactView extends FileView {
	private currentFile: TFile | null = null;
	private plugin: TabFlowPlugin;
	private root: Root | null = null;
	private reactContainer: HTMLDivElement | null = null;
	private controller: PlayerController | null = null;
	private resources: PlayerControllerResources;
	private static instanceId = 0;

	// Store 管理
	private storeFactory: StoreFactory;
	private stores: StoreCollection | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TabFlowPlugin, resources: PlayerControllerResources) {
		super(leaf);
		this.plugin = plugin;
		this.resources = resources;
		this.storeFactory = new StoreFactory(plugin);
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
		console.log('[ReactView] Opening view...');

		// 1. 创建 stores（使用 StoreFactory）
		this.stores = this.storeFactory.createStores(this);
		console.log('[ReactView] Stores created:', {
			globalConfig: !!this.stores.globalConfig,
			workspaceConfig: !!this.stores.workspaceConfig,
			runtime: !!this.stores.runtime,
			ui: !!this.stores.ui,
		});

		// 2. 全局只注入一次 CSS @font-face（作为 AlphaTab 的备用方案）
		// AlphaTab 主要通过 smuflFontSources 加载字体,但 CSS 可提供后备
		if (!fontStyleInjected && this.resources.bravuraUri) {
			const fontFaceRule = `
				@font-face {
					font-family: 'alphaTab';
					src: url(${this.resources.bravuraUri});
					font-weight: normal;
					font-style: normal;
				}
			`;
			globalFontStyle = this.containerEl.ownerDocument.createElement('style');
			globalFontStyle.id = 'alphatab-font-style-global';
			globalFontStyle.appendChild(document.createTextNode(fontFaceRule));
			this.containerEl.ownerDocument.head.appendChild(globalFontStyle);
			fontStyleInjected = true;
			console.log('[ReactView] Global @font-face injected');
		}

		// 3. 创建 PlayerController（传递 resources 和 stores）
		if (!this.stores) {
			console.error('[ReactView] Stores not initialized! Cannot create controller.');
			return;
		}
		this.controller = new PlayerController(this.plugin, this.resources, this.stores);

		// 创建容器元素
		this.reactContainer = this.contentEl.createDiv({
			cls: 'react-tab-view-container',
			attr: {
				style: 'width: 100%; height: 100%; position: relative;',
			},
		});

		// 4. 创建 React root 并渲染
		this.root = createRoot(this.reactContainer);
		this.renderReactComponent();

		console.log('[ReactView] View opened successfully');
	}

	async onClose() {
		console.log('[ReactView] Closing view...');

		// 注意: 不移除全局字体样式,因为可能有其他实例在使用
		// 字体样式会在插件卸载时自动清理

		// 1. 清理 React root
		if (this.root) {
			this.root.unmount();
			this.root = null;
			console.log('[ReactView] React root unmounted');
		}

		// 2. 清理 PlayerController
		if (this.controller) {
			this.controller.destroy();
			this.controller = null;
			console.log('[ReactView] PlayerController destroyed');
		}

		// 3. 销毁 stores（清理回调）
		if (this.stores) {
			this.storeFactory.destroyStores(this.stores);
			this.stores = null;
			console.log('[ReactView] Stores destroyed');
		}

		// 4. 清理容器
		if (this.reactContainer) {
			this.reactContainer.remove();
			this.reactContainer = null;
		}

		this.currentFile = null;
		console.log('[ReactView] View closed');

		// 注意：controller.destroy() 会清理实例状态，无需额外重置全局状态
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.currentFile = file;

		if (!this.controller) {
			console.error('[ReactView] PlayerController not initialized, cannot load file.');
			return;
		}

		// 直接调用新方法，不再需要等待循环
		this.controller.loadFileWhenReady(file).catch((error) => {
			console.error(`[ReactView] Controller failed to load file:`, error);
		});
	}

	async onUnloadFile(file: TFile): Promise<void> {
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
