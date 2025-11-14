import { FileView, TFile, WorkspaceLeaf } from 'obsidian';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
	createAlphaTexEditor,
	type AlphaTexCodeMirrorEditor,
} from '../editor/AlphaTexCodeMirrorEditor';
import ShareCardModal from '../components/ShareCardModal';
import {
	getBarAtOffset,
	extractInitHeader,
	makeFocusedBody,
	getBarNumberAtOffset,
} from '../utils/alphatexParser';
import { t } from '../i18n';
import TabFlowPlugin from '../main';
import { PlayerController, type PlayerControllerResources } from '../player/PlayerController';
import { StoreFactory, type StoreCollection } from '../player/store/StoreFactory';
import { TablatureView } from '../player/components/TablatureView';
import { VIEW_TYPE_REACT } from '../player/ReactView';

export const VIEW_TYPE_ALPHATEX_EDITOR = 'alphatex-editor-view';

export class EditorView extends FileView {
	private editor: AlphaTexCodeMirrorEditor | null = null;
	private container: HTMLElement;
	private layout:
		| 'horizontal'
		| 'vertical'
		| 'horizontal-swapped'
		| 'vertical-swapped'
		| 'single-bar' = 'horizontal';
	private fileModifyHandler: (file: TFile) => void;
	private playerStoreFactory: StoreFactory;
	private playerStores: StoreCollection | null = null;
	private playerController: PlayerController | null = null;
	private playerRoot: Root | null = null;
	private playerContainer: HTMLDivElement | null = null;
	private playerApiReadyUnsubscribe: (() => void) | null = null;
	private pendingPlayerTex: string | null = null;
	private currentBarInfoEl: HTMLDivElement | null = null;
	private lastSavedContent = '';
	private pendingSaveTimer: number | null = null;

	private scheduleSave(delay = 1000) {
		try {
			if (this.pendingSaveTimer) window.clearTimeout(this.pendingSaveTimer);
			this.pendingSaveTimer = window.setTimeout(() => {
				this.pendingSaveTimer = null;
				this.flushSave().catch(() => {});
			}, delay);
		} catch (_) {
			// ignore
		}
	}

	private clearPendingSave() {
		if (this.pendingSaveTimer) {
			window.clearTimeout(this.pendingSaveTimer);
			this.pendingSaveTimer = null;
		}
	}
	/**
	 * 将当前编辑器内容立即保存（如果有变更）。
	 */
	private async flushSave(): Promise<void> {
		try {
			if (!this.file || !this.editor) return;
			const content = this.editor.value;
			if (content === this.lastSavedContent) return;

			// 使用 Vault.process 以防止在读取与写入之间发生外部更改导致的数据丢失
			const result = await this.app.vault.process(this.file, (currentData: string) => {
				// 如果磁盘内容与我们上次保存的基线不同，说明文件在外部被修改，拒绝覆盖
				if (currentData !== this.lastSavedContent) {
					return currentData; // 保持磁盘版本不变
				}
				return content;
			});

			if (result === content) {
				this.lastSavedContent = content;
				// console.log('[EditorView] flushSave: 保存已完成');
			} else {
				console.warn('[EditorView] flushSave: 磁盘文件已变更，未覆盖。');
				// new Notice(
				// 	t(
				// 		'alphatex.editor.externalChangeConflict',
				// 		undefined,
				// 		'文件在磁盘上被修改，未覆盖以避免数据丢失'
				// 	)
				// );
			}
		} catch (e) {
			console.error('[EditorView] flushSave: 保存失败', e);
			// new Notice(t('alphatex.editor.saveError', undefined, '自动保存失败'));
		}
	}
	private layoutToggleAction: HTMLElement | null = null;
	private newFileAction: HTMLElement | null = null;
	private settingsAction: HTMLElement | null = null;
	private switchToPlayerAction: HTMLElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: TabFlowPlugin
	) {
		super(leaf);
		this.container = this.contentEl;
		this.playerStoreFactory = new StoreFactory(plugin);

		// 从视图状态中读取布局参数，如果没有则使用插件默认设置
		const state = leaf.getViewState();
		const validLayouts = [
			'horizontal',
			'vertical',
			'horizontal-swapped',
			'vertical-swapped',
			'single-bar',
		];
		if (state.state?.layout && validLayouts.includes(state.state.layout as string)) {
			this.layout = state.state.layout as typeof this.layout;
		} else {
			// 使用插件的默认布局设置
			this.layout = this.plugin.settings.editorViewDefaultLayout || 'horizontal';
		}

		this.fileModifyHandler = (file: TFile) => {
			if (this.file && file && file.path === this.file.path) {
				try {
					console.debug(
						`[EditorView] 检测到文件变化: ${file.basename}，正在同步最新内容...`
					);
					this.app.vault
						.cachedRead(file)
						.then((latest) => {
							if (!this.editor) {
								// 如果编辑器不存在，做完整重载
								void this.reloadFile();
								return;
							}
							// 无论是否有本地未保存更改，自动用磁盘最新内容覆盖编辑器视图（按需求自动更新）
							if (this.editor.value !== latest) {
								this.editor.set(latest, false);
								this.updatePlayerWithEditorValue();
								this.lastSavedContent = latest;
								// new Notice(
								// 	t(
								// 		'alphatex.editor.externalUpdated',
								// 		undefined,
								// 		'文件已在磁盘上更改，视图已同步'
								// 	)
								// );
								console.debug('[EditorView] 已将编辑器与磁盘最新内容同步');
							}
						})
						.catch((e) => {
							console.error('[EditorView] 读取修改后的文件失败:', e);
						});
				} catch (e) {
					console.error('[EditorView] 处理文件修改事件失败:', e);
				}
			}
		};
	}

	getViewType(): string {
		return VIEW_TYPE_ALPHATEX_EDITOR;
	}

	getDisplayText(): string {
		if (this.file) {
			return `${this.file.basename} (编辑器)`;
		}
		return t('alphatex.editor.displayText', undefined, 'AlphaTex 编辑器');
	}

	getIcon(): string {
		return 'music';
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.file = file;
		await this.render();

		// 注册文件修改监听器
		this.app.vault.on('modify', this.fileModifyHandler);
	}

	async onUnloadFile(file: TFile): Promise<void> {
		this.cleanup();
	}

	private cleanup(): void {
		// 在清理时触发一次立即保存（flush）
		try {
			// fire-and-forget：确保不会阻塞清理流程
			this.flushSave().catch(() => {
				/* already handled inside flushSave */
			});
		} catch (_) {
			// ignore
		}

		// 清除挂起的自动保存计时器
		this.clearPendingSave();

		this.disposeReactPlayer();
		if (this.editor) {
			this.editor.destroy();
			this.editor = null;
		}

		// 清理布局切换按钮（防止重复实例残留）
		try {
			if (this.layoutToggleAction && this.layoutToggleAction.parentElement) {
				this.layoutToggleAction.remove();
			}
			this.layoutToggleAction = null;
		} catch (_) {
			// ignore
		}

		// 清理设置按钮
		try {
			if (this.settingsAction && this.settingsAction.parentElement) {
				this.settingsAction.remove();
			}
			this.settingsAction = null;
		} catch (_) {
			// ignore
		}

		// 清理新建文件按钮
		try {
			if (this.newFileAction && this.newFileAction.parentElement) {
				this.newFileAction.remove();
			}
			this.newFileAction = null;
		} catch (_) {
			// ignore
		}

		// 清理切换到播放器按钮
		try {
			if (this.switchToPlayerAction && this.switchToPlayerAction.parentElement) {
				this.switchToPlayerAction.remove();
			}
			this.switchToPlayerAction = null;
		} catch (_) {
			// ignore
		}
	}

	private async render(): Promise<void> {
		if (!this.file) return;

		this.cleanup();
		this.container.empty();

		// 读取文件内容
		let content = '';
		try {
			content = await this.app.vault.read(this.file);
			// 记录为已保存内容基线
			this.lastSavedContent = content;
		} catch (error) {
			console.error('[EditorView] 读取文件失败:', error);
			// new Notice(t('alphatex.editor.readError', undefined, '读取文件失败'));
			return;
		}

		// 创建主布局容器
		const mainContainer = this.container.createDiv({ cls: 'alphatex-editor-layout' });

		// 根据布局模式创建编辑器和预览容器
		let editorContainer: HTMLElement;
		let previewContainer: HTMLElement;

		if (this.layout === 'horizontal-swapped') {
			// 左右交换：预览在左，编辑器在右
			previewContainer = mainContainer.createDiv({ cls: 'alphatex-preview-section' });
			editorContainer = mainContainer.createDiv({ cls: 'alphatex-editor-section' });
		} else if (this.layout === 'vertical-swapped') {
			// 上下交换：预览在上，编辑器在下
			previewContainer = mainContainer.createDiv({ cls: 'alphatex-preview-section' });
			editorContainer = mainContainer.createDiv({ cls: 'alphatex-editor-section' });
		} else if (this.layout === 'single-bar') {
			// 单小节模式：左右分栏，但只渲染当前小节
			editorContainer = mainContainer.createDiv({ cls: 'alphatex-editor-section' });
			previewContainer = mainContainer.createDiv({ cls: 'alphatex-preview-section' });
		} else {
			// 默认：编辑器在左/上，预览在右/下
			editorContainer = mainContainer.createDiv({ cls: 'alphatex-editor-section' });
			previewContainer = mainContainer.createDiv({ cls: 'alphatex-preview-section' });
		}

		// 设置布局类（single-bar 使用左右分栏，与默认 horizontal 一致）
		if (
			this.layout === 'horizontal' ||
			this.layout === 'horizontal-swapped' ||
			this.layout === 'single-bar'
		) {
			mainContainer.classList.add('is-horizontal');
		} else {
			mainContainer.classList.add('is-vertical');
		}

		// 保存布局状态到视图状态
		const currentState = this.leaf.getViewState();
		if (currentState.state) {
			currentState.state.layout = this.layout;
			void this.leaf.setViewState(currentState);
		}

		// 创建嵌入式编辑器
		const editorWrapper = editorContainer.createDiv({ cls: 'alphatex-editor-wrapper' });
		// ensure global fallback for older code paths
		try {
			const existingSettings = Reflect.get(window, '__tabflow_settings__');
			if (!existingSettings) {
				Reflect.set(window, '__tabflow_settings__', this.plugin.settings);
			}
		} catch {
			// ignore
		}

		this.editor = createAlphaTexEditor(editorWrapper, {
			value: content,
			placeholder: t('alphatex.editor.placeholder', undefined, '输入 AlphaTex 内容...'),
			onChange: (update) => {
				// 确保编辑器已完全初始化后再访问
				if (!this.editor || !this.editor.loaded) return;
				try {
					const cursorPos = update.view.state.selection.main.head;
					this.updatePlayerWithEditorValue(cursorPos);
					this.scheduleSave(1000);
				} catch (error) {
					// 静默处理编辑器未就绪时的错误
					console.debug('[EditorView] onChange callback skipped:', error);
				}
			},
			highlightSettings: this.plugin.settings.editorHighlights || {},
		});

		// 创建 React 播放器预览
		let initialPreviewContent = content;
		let currentBarInfo = '';
		if (this.layout === 'single-bar') {
			initialPreviewContent = this.generateFocusedContent(content, 0);
			const barNumber = getBarNumberAtOffset(content, 0);
			currentBarInfo =
				barNumber !== null ? t('alphatex.currentBar', { number: barNumber + 1 }) : '';
		}
		this.mountReactPlayer(previewContainer, initialPreviewContent, currentBarInfo);

		// 添加统一的设置按钮（右上角 view-action） -> 跳转到 SettingTab 的 editor 子页签
		// NOTE:
		// Obsidian 的 view action 区（addAction）在 DOM 中的插入效果是从右向左排列：
		// 新添加的 action 会出现在已有 action 的左侧（即插入顺序决定从右到左的可视顺序）。
		// 因此若希望某个按钮出现在最右侧（视觉上靠右），需要先添加该按钮，再添加其它按钮。
		try {
			// 先添加"切换到播放器"按钮，使其显示在最右侧
			if (this.switchToPlayerAction && this.switchToPlayerAction.parentElement) {
				this.switchToPlayerAction.remove();
				this.switchToPlayerAction = null;
			}
			const switchToPlayerBtn = this.addAction('play', '切换到播放器视图', () => {
				if (!this.file) return;
				// 先保存当前编辑器的内容，确保切换到播放器视图时文件是最新的
				const file = this.file; // 保存文件引用，避免在异步函数中 this.file 可能为 null
				void (async () => {
					await this.flushSave();
					if (!file) return; // 再次检查，确保文件仍然存在
					await this.leaf.setViewState({
						type: VIEW_TYPE_REACT,
						state: { file: file.path },
					});
				})();
			});
			this.switchToPlayerAction = switchToPlayerBtn;

			// 添加"新建文件"按钮
			if (this.newFileAction && this.newFileAction.parentElement) {
				this.newFileAction.remove();
				this.newFileAction = null;
			}
			const newFileBtn = this.addAction('document', '新建文件', () => {
				const modal = new ShareCardModal(this.plugin);
				modal.open();
			});
			this.newFileAction = newFileBtn;

			if (this.settingsAction && this.settingsAction.parentElement) {
				this.settingsAction.remove();
				this.settingsAction = null;
			}
			const settingsBtn = this.addAction(
				'settings',
				t('settings.tabs.editor', undefined, '设置'),
				() => {
					try {
						// @ts-ignore
						this.plugin.app.workspace.trigger('tabflow:open-plugin-settings-editor');
					} catch {
						// 忽略触发错误，SettingTab 内会有降级逻辑
					}
				}
			);
			this.settingsAction = settingsBtn;
		} catch (_) {
			// ignore
		}

		// 添加布局切换按钮并保存返回的按钮引用，方便后续移除
		try {
			const layouts = [
				'horizontal',
				'horizontal-swapped',
				'vertical',
				'vertical-swapped',
				'single-bar',
			] as const;
			const currentIndex = layouts.indexOf(this.layout);
			const nextLayout = layouts[(currentIndex + 1) % layouts.length];
			const iconMap = {
				horizontal: 'layout',
				'horizontal-swapped': 'layout',
				vertical: 'sidebar',
				'vertical-swapped': 'sidebar',
				'single-bar': 'music',
			};
			const btn = this.addAction(iconMap[nextLayout], '切换布局', () => {
				this.layout = nextLayout;
				void this.render();
			});
			this.layoutToggleAction = btn;
		} catch (_) {
			this.layoutToggleAction = null;
		}
	}

	private async reloadFile(): Promise<void> {
		if (this.file) {
			await this.onLoadFile(this.file);
		}
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

	private mountReactPlayer(
		previewContainer: HTMLElement,
		initialContent: string,
		currentBarInfo: string
	): void {
		const resources = this.getPlayerResources();
		if (!resources) {
			const holder = previewContainer.createDiv({ cls: 'alphatex-block' });
			holder.createEl('div', { text: t('playground.resourcesMissing') });
			const btn = holder.createEl('button', { text: t('playground.downloadResources') });
			btn.addEventListener(
				'click',
				() =>
					void (async () => {
						btn.setAttr('disabled', 'true');
						btn.setText(t('playground.downloading'));
						try {
							const ok = await this.plugin.downloadAssets();
							btn.removeAttribute('disabled');
							btn.setText(
								ok
									? t('playground.downloadCompleted')
									: t('playground.downloadFailed')
							);
						} catch {
							btn.removeAttribute('disabled');
							btn.setText(t('playground.downloadFailed'));
						}
					})()
			);
			return;
		}

		if (this.layout === 'single-bar') {
			this.currentBarInfoEl = previewContainer.createDiv({ cls: 'alphatex-bar-info' });
			this.setCurrentBarInfo(currentBarInfo);
		}

		this.playerStores = this.playerStoreFactory.createStores(this);
		this.playerController = new PlayerController(this.plugin, resources, this.playerStores);
		this.playerContainer = previewContainer.createDiv({
			cls: 'react-tab-view-container',
			attr: {
				style: 'width: 100%; height: 100%; position: relative;',
			},
		});
		this.playerRoot = createRoot(this.playerContainer);
		// 在 EditorView 中不显示 DebugBar，使用更简洁的界面
		this.playerRoot.render(
			React.createElement(TablatureView, {
				controller: this.playerController,
				options: {
					showDebugBar: false, // EditorView 中不显示 DebugBar
					showPlayBar: true,
					showSettingsPanel: true,
					showTracksPanel: true,
					showMediaSync: true,
				},
			})
		);

		const runtimeStore = this.playerController.getRuntimeStore();
		let lastApiReady = runtimeStore.getState().apiReady;
		if (lastApiReady) {
			this.flushPendingPlayerTex();
		}
		this.playerApiReadyUnsubscribe = runtimeStore.subscribe((state) => {
			if (state.apiReady && !lastApiReady) {
				this.flushPendingPlayerTex();
			}
			lastApiReady = state.apiReady;
		});

		this.queuePlayerRender(initialContent);
	}

	private disposeReactPlayer(): void {
		if (this.playerApiReadyUnsubscribe) {
			this.playerApiReadyUnsubscribe();
			this.playerApiReadyUnsubscribe = null;
		}
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
		if (this.currentBarInfoEl) {
			this.currentBarInfoEl.remove();
			this.currentBarInfoEl = null;
		}
		this.pendingPlayerTex = null;
	}

	private queuePlayerRender(tex: string): void {
		if (!this.playerController) return;
		this.pendingPlayerTex = tex;
		const runtimeStore = this.playerController.getRuntimeStore();
		if (runtimeStore.getState().apiReady) {
			this.flushPendingPlayerTex();
		}
	}

	private flushPendingPlayerTex(): void {
		if (!this.playerController || this.pendingPlayerTex === null) {
			return;
		}
		const tex = this.pendingPlayerTex;
		this.pendingPlayerTex = null;
		this.playerController.loadScoreFromAlphaTex(tex).catch((error) => {
			console.error('[EditorView] Failed to render preview:', error);
		});
	}

	private setCurrentBarInfo(info: string): void {
		if (!this.currentBarInfoEl) return;
		this.currentBarInfoEl.empty();
		this.currentBarInfoEl.createEl('span', { text: info });
	}

	private updatePlayerWithEditorValue(cursorPos?: number): void {
		if (!this.editor) return;
		const content = this.editor.value;
		if (this.layout === 'single-bar') {
			const position = cursorPos ?? 0;
			const focusedContent = this.generateFocusedContent(content, position);
			this.queuePlayerRender(focusedContent);
			const barNumber = getBarNumberAtOffset(content, position);
			const info =
				barNumber !== null ? t('alphatex.currentBar', { number: barNumber + 1 }) : '';
			this.setCurrentBarInfo(info);
		} else {
			this.queuePlayerRender(content);
		}
	}

	/**
	 * 处理光标变化事件（用于单小节模式）
	 */
	private handleCursorChange(cursorPos: number): void {
		if (this.layout !== 'single-bar') return;
		this.updatePlayerWithEditorValue(cursorPos);
	}

	/**
	 * 生成聚焦内容（用于单小节模式）
	 */
	private generateFocusedContent(content: string, cursorPos: number): string {
		try {
			const bar = getBarAtOffset(content, cursorPos);
			if (!bar) {
				// 如果找不到当前小节，返回完整内容
				return content;
			}

			const header = extractInitHeader(content);
			const focusedBody = makeFocusedBody(header.initHeader, bar.text);
			return focusedBody;
		} catch (error) {
			console.warn('[EditorView] 生成聚焦内容失败:', error);
			return content;
		}
	}

	onunload(): void {
		this.cleanup();
		this.app.vault.off('modify', this.fileModifyHandler);
	}
}
