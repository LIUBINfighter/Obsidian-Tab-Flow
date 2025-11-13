import { FileView, TFile, WorkspaceLeaf } from 'obsidian';
import {
	createEmbeddableMarkdownEditor,
	type EmbeddableMarkdownEditor,
} from '../editor/EmbeddableMarkdownEditor';
import type { ProgressBarElement } from '../components/ProgressBar.types';
import {
	createAlphaTexPlayground,
	AlphaTexPlaygroundHandle,
} from '../components/AlphaTexPlayground';
import { createEditorBar } from '../components/EditorBar';
import { EventBus } from '../utils/EventBus';
import { formatTime } from '../utils';
import ShareCardModal from '../components/ShareCardModal';
import {
	getBarAtOffset,
	extractInitHeader,
	makeFocusedBody,
	getBarNumberAtOffset,
} from '../utils/alphatexParser';
import { t } from '../i18n';
import TabFlowPlugin from '../main';

export const VIEW_TYPE_ALPHATEX_EDITOR = 'alphatex-editor-view';

export class EditorView extends FileView {
	private editor: EmbeddableMarkdownEditor | null = null;
	private playground: AlphaTexPlaygroundHandle | null = null;
	private container: HTMLElement;
	private layout:
		| 'horizontal'
		| 'vertical'
		| 'horizontal-swapped'
		| 'vertical-swapped'
		| 'single-bar' = 'horizontal';
	private fileModifyHandler: (file: TFile) => void;
	private eventBus: EventBus;
	private progressBar: ProgressBarElement | null = null; // 保存进度条引用
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
			const content = (this.editor as EmbeddableMarkdownEditor).value;
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

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: TabFlowPlugin
	) {
		super(leaf);
		this.container = this.contentEl;
		this.eventBus = new EventBus();

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
							if ((this.editor as EmbeddableMarkdownEditor).value !== latest) {
								this.editor!.set(latest, false);
								this.playground?.setValue(latest);
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

		// 监听 EditorBar 设置变化事件，实现实时更新
		// Note: Obsidian's workspace.on may not be available in all contexts
		// Using a try-catch to handle cases where the event system is not ready
		try {
			interface WorkspaceWithOn {
				on?: (event: string, callback: () => void) => () => void;
			}
			const workspaceOn = (this.app.workspace as unknown as WorkspaceWithOn).on;
			if (workspaceOn) {
				const unsubscribe = workspaceOn('tabflow:editorbar-components-changed', () => {
					try {
						console.debug('[EditorView] 检测到 EditorBar 设置变化，正在重新渲染...');
						this._remountEditorBar();
					} catch (e) {
						console.warn('[EditorView] 重新渲染 EditorBar 失败:', e);
					}
				});
				if (unsubscribe) {
					this.registerEvent(unsubscribe);
				}
			}
		} catch (e) {
			console.warn('[EditorView] 无法注册 EditorBar 设置变化监听器:', e);
		}
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

		if (this.playground) {
			this.playground.destroy();
			this.playground = null;
		}
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
			interface WindowWithSettings {
				__tabflow_settings__?: unknown;
			}
			(window as unknown as WindowWithSettings).__tabflow_settings__ =
				(window as unknown as WindowWithSettings).__tabflow_settings__ ||
				this.plugin.settings;
		} catch {
			// ignore
		}

		this.editor = createEmbeddableMarkdownEditor(this.app, editorWrapper, {
			value: content,
			placeholder: t('alphatex.editor.placeholder', undefined, '输入 AlphaTex 内容...'),
			onChange: (update) => {
				// 当编辑器内容变化时，更新预览并触发防抖自动保存
				if (this.playground && this.editor) {
					this.playground.setValue(this.editor.value);
				}
				this.scheduleSave(1000);

				// 在单小节模式下处理光标变化
				if (this.layout === 'single-bar' && update.view) {
					const cursorPos = update.view.state.selection.main.head;
					this.handleCursorChange(cursorPos);
				}
			},
			highlightSettings: this.plugin.settings.editorHighlights || {},
		});

		// 创建 playground 预览
		let initialPreviewContent = content;
		let currentBarInfo = '';
		if (this.layout === 'single-bar') {
			// 在单小节模式下，初始显示第一个小节
			initialPreviewContent = this.generateFocusedContent(content, 0);
			const barNumber = getBarNumberAtOffset(content, 0);
			currentBarInfo =
				barNumber !== null ? t('alphatex.currentBar', { number: barNumber + 1 }) : '';
		}
		this.playground = createAlphaTexPlayground(
			this.plugin,
			previewContainer,
			initialPreviewContent,
			{
				layout: this.layout,
				readOnly: true, // 预览模式为只读
				showEditor: false, // 不显示编辑区
				eventBus: this.eventBus, // 传递 eventBus
				currentBarInfo,
				// 当处于 single-bar 模式时，预览不应写回编辑器（仅单向：编辑器 -> 预览）
				onChange:
					this.layout === 'single-bar'
						? undefined
						: (value: string) => {
								// 预览内容变化时，同步到编辑器（仅在非 single-bar 模式）
								if (this.editor && this.editor.value !== value) {
									this.editor.set(value, false);
								}
							},
			}
		);

		// 创建编辑器栏（EditorBar）
		this._mountEditorBar();

		// 添加统一的设置按钮（右上角 view-action） -> 跳转到 SettingTab 的 editor 子页签
		// NOTE:
		// Obsidian 的 view action 区（addAction）在 DOM 中的插入效果是从右向左排列：
		// 新添加的 action 会出现在已有 action 的左侧（即插入顺序决定从右到左的可视顺序）。
		// 因此若希望某个按钮出现在最右侧（视觉上靠右），需要先添加该按钮，再添加其它按钮。
		try {
			// 先添加“新建文件”按钮，使其显示在最右侧
			if (this.newFileAction && this.newFileAction.parentElement) {
				this.newFileAction.remove();
				this.newFileAction = null;
			}
			const newFileBtn = this.addAction('document', '新建文件', () => {
				const modal = new ShareCardModal(this.plugin);
				modal.open();
			});
			this.newFileAction = newFileBtn as unknown as HTMLElement;

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
			this.settingsAction = settingsBtn as unknown as HTMLElement;
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
			this.layoutToggleAction = btn as unknown as HTMLElement;
		} catch (_) {
			this.layoutToggleAction = null;
		}
	}

	private async reloadFile(): Promise<void> {
		if (this.file) {
			await this.onLoadFile(this.file);
		}
	}

	/**
	 * 挂载或重新挂载 EditorBar
	 */
	private _mountEditorBar(): void {
		// 移除现有的 EditorBar
		const existingBar = this.container.querySelector('.alphatex-editor-bar');
		if (existingBar) {
			existingBar.remove();
		}

		// 创建新的 EditorBar 容器
		const editorBarContainer = this.container.createDiv({ cls: 'alphatex-editor-bar' });
		const editorBar = createEditorBar({
			app: this.app,
			eventBus: this.eventBus,
			initialPlaying: false,
			getCurrentTime: () => {
				const api = this.playground?.getApi();
				interface AlphaTabApiWithTimePosition {
					timePosition?: number;
				}
				return api ? (api as unknown as AlphaTabApiWithTimePosition).timePosition || 0 : 0;
			},
			getDuration: () => {
				const api = this.playground?.getApi();
				return api?.score
					? (api.score as unknown as { durationMillis?: number; duration?: number })
							.durationMillis ||
							(api.score as unknown as { durationMillis?: number; duration?: number })
								.duration ||
							0
					: 0;
			},
			seekTo: (ms: number) => {
				const api = this.playground?.getApi();
				if (api) {
					interface AlphaTabApiWithTimePosition {
						timePosition?: number;
					}
					(api as unknown as AlphaTabApiWithTimePosition).timePosition = ms;
				}
			},
			onAudioCreated: (audioEl: HTMLAudioElement) => {
				// 编辑器视图可能不需要音频集成，暂时留空
			},
			getApi: () => this.playground?.getApi() || null,
			onProgressBarCreated: (progressBar: ProgressBarElement) => {
				this.progressBar = progressBar;
				// 推迟设置事件监听器，直到 API 可用
				const setupProgressUpdate = () => {
					const api = this.playground?.getApi();
					if (api && api.playerPositionChanged) {
						api.playerPositionChanged.on((args: unknown) => {
							interface PlayerPositionArgs {
								currentTime?: number;
								endTime?: number;
							}
							const position = (args as PlayerPositionArgs).currentTime;
							const duration = (args as PlayerPositionArgs).endTime;
							if (this.progressBar && this.progressBar.updateProgress) {
								// 更新进度条
								this.progressBar.updateProgress(position, duration);

								// 同时更新时间显示元素
								const editorBarContainer =
									this.containerEl.querySelector('.alphatex-editor-bar');
								if (editorBarContainer) {
									const currentTimeDisplay = editorBarContainer.querySelector(
										'.play-time.current-time'
									) as HTMLSpanElement;
									const totalTimeDisplay = editorBarContainer.querySelector(
										'.play-time.total-time'
									) as HTMLSpanElement;

									if (currentTimeDisplay && totalTimeDisplay) {
										currentTimeDisplay.textContent = formatTime(position || 0);
										totalTimeDisplay.textContent = formatTime(duration || 0);
									}
								}
							}
						});
						// console.log('[EditorView] 进度条事件监听器已设置');
					} else {
						// 如果 API 还不可用，稍后重试
						setTimeout(setupProgressUpdate, 100);
					}
				};
				setupProgressUpdate();
			},
		});
		editorBarContainer.appendChild(editorBar);
	}

	/**
	 * 重新挂载 EditorBar（用于设置变化时的实时更新）
	 */
	private _remountEditorBar(): void {
		this._mountEditorBar();
	}

	/**
	 * 处理光标变化事件（用于单小节模式）
	 */
	private handleCursorChange(cursorPos: number): void {
		if (this.layout !== 'single-bar' || !this.playground || !this.editor) return;

		try {
			const content = this.editor.value;
			const focusedContent = this.generateFocusedContent(content, cursorPos);
			this.playground.setValue(focusedContent);

			// 更新当前小节信息
			const barNumber = getBarNumberAtOffset(content, cursorPos);
			const currentBarInfo =
				barNumber !== null ? t('alphatex.currentBar', { number: barNumber + 1 }) : '';
			this.playground.updateCurrentBarInfo(currentBarInfo);
		} catch (error) {
			console.warn('[EditorView] 处理光标变化失败:', error);
		}
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
