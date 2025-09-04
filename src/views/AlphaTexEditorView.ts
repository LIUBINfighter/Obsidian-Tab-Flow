import { FileView, TFile, WorkspaceLeaf, Notice } from 'obsidian';
import {
	createEmbeddableMarkdownEditor,
	EmbeddableMarkdownEditor,
} from '../editor/EmbeddableMarkdownEditor';
import {
	createAlphaTexPlayground,
	AlphaTexPlaygroundHandle,
} from '../components/AlphaTexPlayground';
import { createPlayBar } from '../components/PlayBar';
import { EventBus } from '../utils/EventBus';
import { t } from '../i18n';
import TabFlowPlugin from '../main';

export const VIEW_TYPE_ALPHATEX_EDITOR = 'alphatex-editor-view';

export class AlphaTexEditorView extends FileView {
	private editor: EmbeddableMarkdownEditor | null = null;
	private playground: AlphaTexPlaygroundHandle | null = null;
	private container: HTMLElement;
	private layout: 'vertical' | 'horizontal' = 'horizontal';
	private fileModifyHandler: (file: TFile) => void;
	private eventBus: EventBus;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: TabFlowPlugin
	) {
		super(leaf);
		this.container = this.contentEl;
		this.eventBus = new EventBus();

		// 从视图状态中读取布局参数
		const state = leaf.getViewState();
		if (state.state?.layout === 'horizontal') {
			this.layout = 'horizontal';
		}

		this.fileModifyHandler = (file: TFile) => {
			if (this.file && file && file.path === this.file.path) {
				console.debug(
					`[AlphaTexEditorView] 检测到文件变化: ${file.basename}，正在重新加载...`
				);
				this.reloadFile();
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

		// 添加布局切换按钮到标题栏
		this.addAction(this.layout === 'vertical' ? 'layout' : 'sidebar', '切换布局', () => {
			this.layout = this.layout === 'vertical' ? 'horizontal' : 'vertical';
			this.render();
		});
	}

	async onUnloadFile(file: TFile): Promise<void> {
		this.cleanup();
	}

	private cleanup(): void {
		if (this.playground) {
			this.playground.destroy();
			this.playground = null;
		}
		if (this.editor) {
			this.editor.destroy();
			this.editor = null;
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
		} catch (error) {
			console.error('[AlphaTexEditorView] 读取文件失败:', error);
			new Notice(t('alphatex.editor.readError', undefined, '读取文件失败'));
			return;
		}

		// 创建主布局容器
		const mainContainer = this.container.createDiv({ cls: 'alphatex-editor-layout' });

		// 创建播放栏
		const playBarContainer = this.container.createDiv({ cls: 'alphatex-editor-playbar' });
		const playBar = createPlayBar({
			app: this.app,
			eventBus: this.eventBus,
			initialPlaying: false,
			getCurrentTime: () => {
				const api = this.playground?.getApi();
				return api?.tickPosition !== undefined ? api.tickPosition : 0;
			},
			getDuration: () => {
				const api = this.playground?.getApi();
				return api?.score ? (api.score as any).duration || 0 : 0;
			},
			seekTo: (ms: number) => {
				const api = this.playground?.getApi();
				if (api) {
					api.tickPosition = ms;
				}
			},
			onAudioCreated: (audioEl: HTMLAudioElement) => {
				// 编辑器视图可能不需要音频集成，暂时留空
			},
		});
		playBarContainer.appendChild(playBar);

		// 创建编辑器和预览容器
		const editorContainer = mainContainer.createDiv({ cls: 'alphatex-editor-section' });
		const previewContainer = mainContainer.createDiv({ cls: 'alphatex-preview-section' });

		// 设置布局类
		mainContainer.classList.toggle('is-vertical', this.layout === 'vertical');
		mainContainer.classList.toggle('is-horizontal', this.layout === 'horizontal');

		// 创建嵌入式编辑器
		const editorWrapper = editorContainer.createDiv({ cls: 'alphatex-editor-wrapper' });
		this.editor = createEmbeddableMarkdownEditor(this.app, editorWrapper, {
			value: content,
			placeholder: t('alphatex.editor.placeholder', undefined, '输入 AlphaTex 内容...'),
			onChange: () => {
				// 当编辑器内容变化时，更新预览
				if (this.playground && this.editor) {
					this.playground.setValue(this.editor.value);
				}
			},
		});

		// 创建 playground 预览
		this.playground = createAlphaTexPlayground(this.plugin, previewContainer, content, {
			layout: this.layout,
			readOnly: true, // 预览模式为只读
			showEditor: false, // 不显示编辑区
			onChange: (value: string) => {
				// 预览内容变化时，同步到编辑器
				if (this.editor && this.editor.value !== value) {
					this.editor.set(value, false);
				}
			},
		});

		// 订阅播放栏事件
		this.eventBus.subscribe('命令:播放暂停', () => {
			const api = this.playground?.getApi();
			if (api) {
				api.playPause();
			}
		});

		this.eventBus.subscribe('命令:停止', () => {
			const api = this.playground?.getApi();
			if (api) {
				api.stop();
			}
		});

		this.eventBus.subscribe('命令:设置速度', (speed: number) => {
			const api = this.playground?.getApi();
			if (api) {
				api.playbackSpeed = speed;
			}
		});

		this.eventBus.subscribe('命令:设置谱表', (profile: number) => {
			const api = this.playground?.getApi();
			if (api) {
				(api.settings.display as any).staveProfile = profile;
				api.updateSettings();
				api.render();
			}
		});

		this.eventBus.subscribe('命令:设置缩放', (scale: number) => {
			const api = this.playground?.getApi();
			if (api) {
				api.settings.display.scale = scale;
				api.updateSettings();
				api.render();
			}
		});

		this.eventBus.subscribe('命令:设置滚动模式', (mode: string) => {
			const api = this.playground?.getApi();
			if (api) {
				(api.settings.player as any).scrollMode = mode;
				api.updateSettings();
			}
		});

		this.eventBus.subscribe('命令:滚动到顶部', () => {
			const api = this.playground?.getApi();
			if (api) {
				api.tickPosition = 0;
			}
		});

		this.eventBus.subscribe('命令:滚动到底部', () => {
			const api = this.playground?.getApi();
			if (api && api.score) {
				const masterBars = api.score.masterBars;
				if (masterBars && masterBars.length > 0) {
					const lastBar = masterBars[masterBars.length - 1];
					const endTick = lastBar.start + lastBar.calculateDuration();
					api.tickPosition = endTick;
				}
			}
		});

		this.eventBus.subscribe('命令:滚动到光标', () => {
			const api = this.playground?.getApi();
			if (api) {
				(api as any).scrollToCursor?.();
			}
		});

		this.eventBus.subscribe('命令:选择音轨', () => {
			// 暂时留空，可以添加音轨选择逻辑
		});

		this.eventBus.subscribe('命令:重新构造AlphaTabApi', () => {
			// 重新渲染预览
			this.playground?.refresh();
		});
	}

	private async reloadFile(): Promise<void> {
		if (this.file) {
			await this.onLoadFile(this.file);
		}
	}

	onunload(): void {
		this.cleanup();
		this.app.vault.off('modify', this.fileModifyHandler);
	}
}
