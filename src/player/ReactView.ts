import { FileView, TFile, WorkspaceLeaf, Plugin } from 'obsidian';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { TablatureView } from './components/TablatureView';
import { PlayerController, type PlayerControllerResources } from './PlayerController';
import { useRuntimeStore } from './store/runtimeStore';
import { useUIStore } from './store/uiStore';

export const VIEW_TYPE_REACT = 'react-tab-view';

export class ReactView extends FileView {
	private currentFile: TFile | null = null;
	private plugin: Plugin;
	private root: Root | null = null;
	private reactContainer: HTMLDivElement | null = null;
	private controller: PlayerController | null = null;
	private resources: PlayerControllerResources;
	private fontStyle: HTMLStyleElement | null = null;
	private static instanceId = 0;

	constructor(leaf: WorkspaceLeaf, plugin: Plugin, resources: PlayerControllerResources) {
		super(leaf);
		this.plugin = plugin;
		this.resources = resources;
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
		// 在所有操作之前重置状态
		useRuntimeStore.getState().reset();
		useUIStore.getState().reset();

		// 注入字体样式（参考 TabView）
		if (this.resources.bravuraUri) {
			const fontFaceRule = `
				@font-face {
					font-family: 'alphaTab';
					src: url(${this.resources.bravuraUri});
				}
			`;
			this.fontStyle = this.containerEl.ownerDocument.createElement('style');
			this.fontStyle.id = `alphatab-font-style-${ReactView.instanceId++}`;
			this.fontStyle.appendChild(document.createTextNode(fontFaceRule));
			this.containerEl.ownerDocument.head.appendChild(this.fontStyle);
		}

		// 创建 PlayerController（传递 resources）
		this.controller = new PlayerController(this.plugin, this.resources);

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
	}

	async onClose() {
		// 移除字体样式
		if (this.fontStyle) {
			this.fontStyle.remove();
			this.fontStyle = null;
		}

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

		// 在关闭后再次重置，为下一个视图实例提供干净环境
		useRuntimeStore.getState().reset();
		useUIStore.getState().reset();
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
