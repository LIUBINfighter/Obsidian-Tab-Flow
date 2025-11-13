// <-- ./src/views/TabView.ts -->
import { FileView, TFile, WorkspaceLeaf, Plugin, Notice, ViewStateResult } from 'obsidian';

export const VIEW_TYPE_TAB = 'tab-view';

import * as alphaTab from '@coderline/alphatab';

import { EventBus, isMessy, formatTime, setupHorizontalScroll } from '../utils';
import { AlphaTabService } from '../services/AlphaTabService';
import { ExternalMediaService } from '../services/ExternalMediaService';
import { createPlayBar } from '../components/PlayBar';
// import { ScorePersistenceService } from '../services/ScorePersistenceService'; // 旧的基于 localStorage 的服务，现替换为 TrackStateStore
import { TracksModal } from '../components/TracksModal'; // 导入 TracksModal
import { TrackStateStore } from '../state/TrackStateStore';
import { createDebugBar } from '../components/DebugBar';
import { t } from 'i18n';

export type AlphaTabResources = {
	bravuraUri: string;
	alphaTabWorkerUri: string;
	soundFontUri: string;
};

// 音轨状态持久化接口
interface ITabViewPersistedState extends Record<string, unknown> {
	filePath: string;
	selectedTracks?: number[];
	trackSettings?: Record<
		string,
		{
			solo?: boolean;
			mute?: boolean;
			volume?: number;
			transpose?: number;
			transposeAudio?: number;
		}
	>;
}

export class TabView extends FileView {
	private static instanceId = 0;
	private _styles: HTMLStyleElement;
	private _fontStyle: HTMLStyleElement | null = null;
	private currentFile: TFile | null = null;
	private fileModifyHandler: (file: TFile) => void;
	public eventBus: EventBus; // Public for external interaction
	private alphaTabService: AlphaTabService;
	// private scorePersistenceService: ScorePersistenceService; // 已弃用，使用 trackStateStore
	private trackStateStore: TrackStateStore;
	private _api!: alphaTab.AlphaTabApi;
	private plugin: Plugin;
	private resources: AlphaTabResources;
	private scoreTitle = '';
	private audioEl: HTMLAudioElement | null = null;
	private audioObjectUrl: string | null = null;
	private externalMediaService: ExternalMediaService | null = null;
	private settingsChangeHandler?: () => void;
	private horizontalScrollCleanup?: () => void; // 用于清理横向滚动监听器
	private settingsAction: HTMLElement | null = null;
	private unsubscribeTrackStore?: () => void; // 解除 TrackStateStore 订阅

	/**
	 * 将 TrackStateStore 中持久化的音轨状态应用到当前 API。
	 * 1. 确保存在默认条目（根据当前 score.tracks 初始化缺失项）
	 * 2. 先应用每个轨道的 solo/mute/volume/transpose（不触发重新渲染）
	 * 3. 再根据 selectedTracks 渲染所选轨道
	 */
	private _applyStoredTrackState() {
		try {
			if (!this._api || !this._api.score) return;
			const filePath = this.currentFile?.path || '';
			if (!filePath) return;
			this.trackStateStore.ensureDefaultsFromApi(filePath, this._api);
			const state = this.trackStateStore.getFileState(filePath);
			// 参数应用
			if (state.trackSettings && this._api.score?.tracks) {
				for (const track of this._api.score.tracks) {
					const s = state.trackSettings[String(track.index)];
					if (!s) continue;
					try {
						if (typeof s.solo === 'boolean') this._api.changeTrackSolo([track], s.solo);
						if (typeof s.mute === 'boolean') this._api.changeTrackMute([track], s.mute);
						if (typeof s.volume === 'number')
							this._api.changeTrackVolume(
								[track],
								Math.max(0, Math.min(16, s.volume)) / 16
							);
						if (typeof s.transpose === 'number')
							this._api.changeTrackTranspositionPitch([track], s.transpose);
						// transposeAudio 暂无 API，可后续扩展
					} catch (e) {
						console.warn('[TabView] 应用轨道参数失败', e);
					}
				}
			}
			// 轨道选择（渲染）
			if (state.selectedTracks && state.selectedTracks.length) {
				const tracks = this._api.score.tracks.filter((t) =>
					state.selectedTracks!.includes(t.index)
				);
				if (tracks.length) {
					interface AlphaTabApiWithRenderTracks {
						renderTracks?: (tracks: unknown[]) => void;
					}
					(this._api as unknown as AlphaTabApiWithRenderTracks).renderTracks?.(tracks);
				}
			}
		} catch (e) {
			console.warn('[TabView] _applyStoredTrackState 执行失败', e);
		}
	}

	private isAudioLoaded(): boolean {
		try {
			if (!this._api?.player) {
				return false;
			}
			if (
				typeof this._api.player.play === 'function' &&
				typeof this._api.player.pause === 'function'
			) {
				return true;
			}
			interface PlayerWithState {
				state?: number;
				readyForPlayback?: boolean;
			}
			const playerState = (this._api.player as unknown as PlayerWithState).state;
			if (typeof playerState === 'number') {
				return playerState >= 0;
			}
			if ((this._api.player as unknown as PlayerWithState).readyForPlayback === true) {
				return true;
			}
			return false;
		} catch (error) {
			console.error('[TabView] Error checking audio status:', error);
			return false;
		}
	}

	constructor(
		leaf: WorkspaceLeaf,
		plugin: Plugin,
		resources: AlphaTabResources,
		eventBus?: EventBus
	) {
		super(leaf);
		this.plugin = plugin;
		this.resources = resources;
		this.eventBus = eventBus ?? new EventBus();
		// 从插件实例获取 TrackStateStore
		interface PluginWithTrackStateStore {
			trackStateStore?: TrackStateStore;
		}
		this.trackStateStore = (plugin as unknown as PluginWithTrackStateStore)
			.trackStateStore as TrackStateStore;

		this.fileModifyHandler = (file: TFile) => {
			if (this.currentFile && file && file.path === this.currentFile.path) {
				// console.debug(`[TabView] 检测到文件变化: ${file.basename}，正在重新加载...`);
				void this.reloadFile();
			}
		};
	}

	/**
	 * 处理 TrackStateStore 的增量变化，将其翻译为 alphaTab API 调用。
	 */
	private handleTrackStateChange(ev: {
		filePath: string;
		changed: Partial<{
			selectedTracks?: number[];
			trackSettings?: Record<
				string,
				Partial<{
					solo?: boolean;
					mute?: boolean;
					volume?: number;
					transpose?: number;
					transposeAudio?: number;
				}>
			>;
		}> | null;
	}) {
		try {
			if (!this.currentFile || ev.filePath !== this.currentFile.path) return;
			if (!this._api || !this._api.score) return;
			const changed = ev.changed;
			if (!changed) return; // ensureDefaultsFromApi 时可能为 null，只需忽略

			// 1) 渲染所选音轨（空集合按“全部”处理）
			if (changed.selectedTracks && Array.isArray(changed.selectedTracks)) {
				let tracksToRender: alphaTab.model.Track[];
				if (changed.selectedTracks.length === 0) {
					tracksToRender = this._api.score.tracks;
				} else {
					const indices = new Set(changed.selectedTracks);
					tracksToRender = this._api.score.tracks.filter((t) => indices.has(t.index));
				}
				if (tracksToRender.length) {
					try {
						interface AlphaTabApiWithRenderTracks {
							renderTracks?: (tracks: unknown[]) => void;
						}
						(this._api as unknown as AlphaTabApiWithRenderTracks).renderTracks?.(
							tracksToRender
						);
					} catch (e) {
						console.warn('[TabView] 应用选中音轨失败', e);
					}
				}
			}

			// 2) 应用单轨设置变化
			if (changed.trackSettings && this._api.score?.tracks) {
				for (const key of Object.keys(changed.trackSettings)) {
					const idx = Number(key);
					const settingsPatch = changed.trackSettings[key];
					if (!settingsPatch) continue;
					const track = this._api.score.tracks.find((t) => t.index === idx);
					if (!track) continue;
					try {
						if (typeof settingsPatch.solo === 'boolean') {
							this._api.changeTrackSolo([track], settingsPatch.solo);
						}
						if (typeof settingsPatch.mute === 'boolean') {
							this._api.changeTrackMute([track], settingsPatch.mute);
						}
						if (typeof settingsPatch.volume === 'number') {
							const v = Math.max(0, Math.min(16, settingsPatch.volume)) / 16;
							this._api.changeTrackVolume([track], v);
						}
						if (typeof settingsPatch.transpose === 'number') {
							this._api.changeTrackTranspositionPitch(
								[track],
								settingsPatch.transpose
							);
						}
						// transposeAudio 暂无 API，留作将来：settingsPatch.transposeAudio
					} catch (e) {
						console.warn(`[TabView] 应用轨道 ${idx} 参数更新失败`, e);
					}
				}
			}
		} catch (e) {
			console.warn('[TabView] handleTrackStateChange 处理失败', e);
		}
	}

	getViewType(): string {
		return VIEW_TYPE_TAB;
	}

	getDisplayText(): string {
		if (this.scoreTitle && this.scoreTitle.trim()) {
			return this.scoreTitle;
		}
		if (this.currentFile) {
			return this.currentFile.basename;
		}
		return 'alphaTab';
	}

	public getScoreTitle(): string {
		if (this.scoreTitle && this.scoreTitle.trim() && !isMessy(this.scoreTitle)) {
			return this.scoreTitle;
		}
		if (this.currentFile) return this.currentFile.basename;
		return 'alphaTab';
	}

	/**
	 * 获取当前视图的状态用于持久化。
	 * 当 Obsidian 序列化布局时调用此方法。
	 */
	getState(): ITabViewPersistedState {
		const state: ITabViewPersistedState = {
			filePath: this.currentFile?.path || '',
		};

		// 保存选中的音轨
		if (this._api?.score?.tracks && this._api.tracks) {
			// 通过检查音轨是否在渲染的音轨列表中来确定选中的音轨
			const renderedTrackIndices = new Set(this._api.tracks.map((track) => track.index));
			const selectedTracks = this._api.score.tracks.filter((track) =>
				renderedTrackIndices.has(track.index)
			);
			if (selectedTracks.length > 0) {
				state.selectedTracks = selectedTracks.map((track) => track.index);
			}
		}

		// 视图持久化不再保存 trackSettings（交由 TrackStateStore 插件级处理）

		return state;
	}

	/**
	 * 设置视图的状态。
	 * 当 Obsidian 反序列化布局时调用此方法。
	 */
	async setState(state: ITabViewPersistedState, result: unknown): Promise<void> {
		// 应用文件路径
		if (state.filePath && state.filePath !== this.currentFile?.path) {
			try {
				const file = this.app.vault.getAbstractFileByPath(state.filePath);
				if (file instanceof TFile) {
					await this.onLoadFile(file);
				}
			} catch (e) {
				console.warn('[TabView] 设置文件路径状态失败:', e);
			}
		}

		// 应用选中的音轨（在乐谱加载完成后通过事件处理）
		if (state.selectedTracks && Array.isArray(state.selectedTracks)) {
			// 保存选中的音轨索引，等待乐谱加载完成后应用
			const selectedTrackIndices = new Set(state.selectedTracks);

			// 监听乐谱加载事件来应用音轨选择
			const applyTrackSelection = () => {
				if (this._api?.score?.tracks) {
					const tracksToRender = this._api.score.tracks.filter((track) =>
						selectedTrackIndices.has(track.index)
					);
					if (tracksToRender.length > 0) {
						interface AlphaTabApiWithRenderTracks {
							renderTracks?: (tracks: unknown[]) => void;
						}
						(this._api as unknown as AlphaTabApiWithRenderTracks).renderTracks?.(
							tracksToRender
						);
					}
				}
			};

			// 如果 API 已经就绪，立即应用
			if (this._api && this._api.score) {
				applyTrackSelection();
			} else if (this._api && this._api.scoreLoaded) {
				// 监听乐谱加载完成事件
				this._api.scoreLoaded.on(applyTrackSelection);
			}
		}

		// 调用父类的 setState
		await super.setState(state, result as ViewStateResult);
	}

	/**
	 * 设置外部音频集成。导出音频为 WAV 并建立与 alphaTab 的同步。
	 */
	private async _setupAudioIntegrationInternal(): Promise<void> {
		if (!this._api || !this.audioEl) return;

		if (!this.externalMediaService) {
			this.externalMediaService = new ExternalMediaService(this._api, this.eventBus);
		} else {
			this.externalMediaService.disconnectMedia();
		}
		this.externalMediaService.connectMedia(this.audioEl);

		try {
			new Notice('正在生成音频，请稍候...');
			if (this.audioObjectUrl && this.audioObjectUrl.startsWith('blob:')) {
				URL.revokeObjectURL(this.audioObjectUrl);
				this.audioObjectUrl = null;
			}
			const wavUrl = await this.alphaTabService.exportAudioToWav({
				masterVolume: 1,
				metronomeVolume: 0,
				sampleRate: 44100,
			});
			this.audioObjectUrl = wavUrl;
			this.audioEl.src = wavUrl;
			this.audioEl.load();
			new Notice('音频已加载！');
		} catch (e) {
			console.error('[TabView] 导出音频失败:', e);
			throw e;
		}
	}

	/**
	 * 挂载底部播放栏 PlayBar。
	 */
	private _mountPlayBarInternal(): void {
		const existingPlayBar = document.querySelector('.play-bar');
		if (existingPlayBar) existingPlayBar.remove();

		const playBar = createPlayBar({
			app: this.app,
			eventBus: this.eventBus,
			initialPlaying: false,
			getCurrentTime: () => {
				interface AlphaTabApiWithTimePosition {
					timePosition?: number;
				}
				return this._api?.tickPosition !== undefined && this._api.score
					? (this._api as unknown as AlphaTabApiWithTimePosition).timePosition || 0
					: 0;
			},
			getDuration: () => {
				interface ScoreWithDuration {
					duration?: number;
				}
				return this._api?.score
					? (this._api.score as unknown as ScoreWithDuration).duration || 0
					: 0;
			},
			seekTo: (ms) => {
				if (this._api) {
					interface AlphaTabApiWithPlayerPosition {
						playerPosition?: number;
					}
					(this._api as unknown as AlphaTabApiWithPlayerPosition).playerPosition = ms;
				}
			},
			onAudioCreated: (audioEl: HTMLAudioElement) => {
				this.audioEl = audioEl;
				this._setupAudioIntegrationInternal().catch((err) => {
					console.error('[TabView] 外部音频集成失败:', err);
					new Notice(t('errors.audioLoadFailed', undefined, '音频加载失败，无法播放。'));
				});
			},
		});

		this.containerEl.appendChild(playBar);

		if (this._api && this._api.playerPositionChanged) {
			this._api.playerPositionChanged.on((args) => {
				window.requestAnimationFrame(() => {
					const progressFill = playBar.querySelector('.progress-fill') as HTMLElement;
					const progressHandle = playBar.querySelector('.progress-handle') as HTMLElement;
					const currentTimeDisplay = playBar.querySelector(
						'.current-time'
					) as HTMLElement;
					const totalTimeDisplay = playBar.querySelector('.total-time') as HTMLElement;

					if (progressFill && progressHandle && currentTimeDisplay && totalTimeDisplay) {
						const currentTime = args.currentTime || 0;
						const duration = args.endTime || 0;

						currentTimeDisplay.textContent = formatTime(currentTime);
						totalTimeDisplay.textContent = formatTime(duration);

						if (duration > 0) {
							const progress = (currentTime / duration) * 100;
							progressFill.style.width = `${progress}%`;
							const handlePos = progress;
							progressHandle.style.left = `${handlePos}%`;
						}
					}
				});
			});
		}
	}

	/**
	 * 渲染 DebugBar（根据插件设置控制可见性）。
	 */
	private _renderDebugBarIfEnabled(): void {
		try {
			interface PluginWithSettings {
				settings?: {
					showDebugBar?: boolean;
				};
			}
			const show =
				(this.plugin as unknown as PluginWithSettings)?.settings?.showDebugBar === true;
			const existing = this.contentEl.querySelector('.debug-bar');
			if (!show) {
				if (existing) (existing as HTMLElement).remove();
				return;
			}
			if (existing) return;

			const debugBar = createDebugBar({
				app: this.app,
				api: this.alphaTabService.getApi(),
				isAudioLoaded: this.isAudioLoaded.bind(this),
				eventBus: this.eventBus,
				getScoreTitle: this.getScoreTitle.bind(this),
			});
			this.contentEl.insertBefore(debugBar, this.contentEl.firstChild);
		} catch (e) {
			console.warn('[TabView] 恢复轨道设置时发生错误', e);
		}
	}

	async onOpen() {
		// --- 字体注入逻辑 ---
		const fontFaceRule = `
			@font-face {
				font-family: 'alphaTab';
				src: url(${this.resources.bravuraUri});
			}
		`;
		this._fontStyle = this.containerEl.ownerDocument.createElement('style');
		this._fontStyle.id = `alphatab-font-style-${TabView.instanceId}`;

		this._fontStyle.appendChild(document.createTextNode(fontFaceRule));
		this.containerEl.ownerDocument.head.appendChild(this._fontStyle);

		const cls = `alphatab-${TabView.instanceId++}`;
		const styles = this.containerEl.createEl('style');

		const styleContent = `
		.${cls} .at-cursor-bar {
			background: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
			opacity: 0.2
		}
		.${cls} .at-selection div {
			background: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
			opacity: 0.4
		}
		.${cls} .at-cursor-beat {
			background: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
			width: 3px;
		}
		.${cls} .at-highlight * {
			fill: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
			stroke: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
		}
		`;
		styles.appendChild(document.createTextNode(styleContent));

		const additionalStyle = `.tabflow-hide-statusbar .status-bar { display: none !important; }`;
		styles.appendChild(document.createTextNode(additionalStyle));
		this._styles = styles;

		// 添加标记类以隐藏状态栏
		document.body.classList.add('tabflow-hide-statusbar');

		// 注册文件变更监听
		this.registerFileWatcher();

		// 创建主内容容器和样式
		const element = this.contentEl.createDiv({ cls: cls });
		this.alphaTabService = new AlphaTabService(
			this.app,
			element,
			this.resources,
			this.eventBus
		);
		this._api = this.alphaTabService.getApi();

		// 渲染 DebugBar
		this._renderDebugBarIfEnabled();

		// 监听 scoreLoaded：首次加载时挂载播放栏并应用持久化音轨状态
		if (this._api && this._api.scoreLoaded) {
			this._api.scoreLoaded.on(() => {
				setTimeout(() => {
					this._mountPlayBarInternal();
					this.configureScrollElement(); // 确保在 PlayBar 挂载后配置滚动元素
					this._applyStoredTrackState(); // 首次加载应用音轨状态
				}, 100);
			});
		} else {
			// 兜底：如果未能监听到 scoreLoaded，延迟挂载
			setTimeout(() => {
				this._mountPlayBarInternal();
				this.configureScrollElement();
				this._applyStoredTrackState();
			}, 500);
		}

		// 长期订阅 TrackStateStore，响应状态变化
		if (!this.unsubscribeTrackStore) {
			this.unsubscribeTrackStore = this.trackStateStore.on((storeEv) => {
				// 保持轻量：仅在相关文件变化时才处理
				if (storeEv.filePath === this.currentFile?.path) {
					this.handleTrackStateChange(storeEv);
					// 可选：布局保存
					this.app.workspace.requestSaveLayout();
				}
			});
		}

		// 订阅刷新播放器命令：对当前文件执行完整重载
		this.eventBus.subscribe('命令:刷新播放器', () => {
			void (async () => {
				if (this.currentFile) {
					await this.reloadFile();
				} else if (this._api) {
					this._api.render();
				}
			})();
		});

		// 设置变化时重新挂载 PlayBar（组件可见性变更）
		// 使用 layout-change 作为较通用的 workspace 事件替代自定义事件名，避免类型不匹配
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this._mountPlayBarInternal();
			})
		);

		// Listen for playbar components/order changes triggered by settings UI
		interface WorkspaceWithOn {
			on?: (event: string, callback: () => void) => () => void;
		}
		const workspaceOn = (this.app.workspace as unknown as WorkspaceWithOn).on;
		if (workspaceOn) {
			this.registerEvent(
				workspaceOn('tabflow:playbar-components-changed', () => {
					try {
						this._mountPlayBarInternal();
						this.configureScrollElement();
					} catch (e) {
						console.warn('[TabView] Failed to apply playbar components change:', e);
					}
				})
			);
		}

		// Listen for scroll mode changes triggered by settings UI or playbar
		interface WorkspaceWithOnScrollMode {
			on?: (event: string, callback: (newMode: string) => void) => () => void;
		}
		const workspaceOn2 = (this.app.workspace as unknown as WorkspaceWithOnScrollMode).on;
		if (workspaceOn2) {
			this.registerEvent(
				workspaceOn2('tabflow:scroll-mode-changed', (newMode: string) => {
					try {
						// console.debug(`[TabView] 滚动模式变更: ${newMode}`);
						this.configureScrollElement();
					} catch (e) {
						console.warn('[TabView] Failed to apply scroll mode change:', e);
					}
				})
			);
		}

		// 监听设置变化，实时响应 Debug Bar 挂载/卸载
		this.settingsChangeHandler = () => {
			this._renderDebugBarIfEnabled();
		};
		// Listen for debugbar toggle events from SettingTab
		interface WorkspaceWithOnDebugbar {
			on?: (event: string, callback: (_visible: boolean) => void) => () => void;
		}
		const workspaceOn3 = (this.app.workspace as unknown as WorkspaceWithOnDebugbar).on;
		if (workspaceOn3) {
			this.registerEvent(
				workspaceOn3('tabflow:debugbar-toggle', (_visible: boolean) => {
					try {
						this._renderDebugBarIfEnabled();
					} catch (e) {
						console.warn('[TabView] Failed to apply debugbar toggle:', e);
					}
				})
			);
		}
		// Debugbar 可见性通过 settingsChangeHandler 响应，这里监听通用的 layout-change 以重新评估
		this.registerEvent(this.app.workspace.on('layout-change', this.settingsChangeHandler));

		// 布局切换后更新滚轮绑定
		this.eventBus.subscribe('命令:切换布局', () => {
			setTimeout(() => this.configureScrollElement(), 10);
		});

		// 监听手动刷新事件 - 使用事件总线
		this.eventBus.subscribe('命令:手动刷新', () => {
			// console.debug('[TabView] 收到手动刷新事件');
			this._mountPlayBarInternal();
			this.configureScrollElement();
		});

		// 订阅加载乐谱：由视图读取文件并下发数据给 AlphaTabService
		this.eventBus.subscribe('命令:加载当前文件', () => {
			void (async () => {
				if (!this.currentFile) return;
				try {
					if (
						this.currentFile.extension &&
						['alphatab', 'alphatex'].includes(this.currentFile.extension.toLowerCase())
					) {
						const textContent = await this.app.vault.read(this.currentFile);
						this.eventBus.publish('命令:加载AlphaTex乐谱', textContent);
					} else {
						const inputFile = await this.app.vault.readBinary(this.currentFile);
						this.eventBus.publish('命令:加载乐谱', new Uint8Array(inputFile));
					}
				} catch (e) {
					console.warn('[TabView] 加载当前文件失败:', e);
				}
			})();
		});

		// 订阅重建 API：触发服务层重建
		this.eventBus.subscribe('命令:重新构造AlphaTabApi', () => {
			this.eventBus.publish('命令:重建AlphaTabApi');
		});

		// 服务层 API 重建完成后，更新本视图引用并重新加载当前文件，并应用 TrackStateStore 状态
		this.eventBus.subscribe('状态:API已重建', (newApi: alphaTab.AlphaTabApi) => {
			try {
				this._api = newApi;
				this.configureScrollElement();

				if (this._api && this._api.scoreLoaded) {
					this._api.scoreLoaded.on(() => {
						const score = this._api.score;
						if (score) {
							if (score.title && !isMessy(score.title)) {
								this.scoreTitle = score.title;
							} else if (this.currentFile) {
								this.scoreTitle = this.currentFile.basename;
							}
							// 使用更具体的断言以避免 any
							(score as unknown as { filePath?: string }).filePath =
								this.currentFile?.path;
						}
						// API 重建后再次应用持久化音轨状态
						this._applyStoredTrackState();

						this.leaf?.setViewState(
							{
								type: VIEW_TYPE_TAB,
								state: { file: this.currentFile?.path },
							},
							{ history: false }
						);

						this._mountPlayBarInternal();
						this._renderDebugBarIfEnabled();
						this.configureScrollElement(); // Reconfigure after potential layout changes
					});
				}
				this.eventBus.publish('命令:加载当前文件');
			} catch (e) {
				console.warn('[TabView] 处理 API 重建事件失败:', e);
			}
		});

		// 导航命令：滚动到顶部/底部
		this.eventBus.subscribe('命令:滚动到顶部', () => {
			if (this._api) {
				this._api.tickPosition = 0;
				this._api.scrollToCursor?.();
			}
		});
		this.eventBus.subscribe('命令:滚动到底部', () => {
			this.scrollToBottom();
		});

		// 订阅 UI:showTracksModal 事件，弹出 TracksModal（使用 TrackStateStore 即时模式）
		this.eventBus.subscribe('UI:showTracksModal', () => {
			const api = this._api || this.alphaTabService.getApi();
			const tracks = api.score?.tracks || [];
			if (!tracks.length) {
				new Notice('没有可用的音轨');
				return;
			}
			const filePath = this.currentFile?.path || '';
			const modal = new TracksModal(
				this.app,
				tracks,
				filePath,
				api,
				this.eventBus,
				this.trackStateStore
			);
			modal.open();
		});

		// 已通过 unsubscribeTrackStore 订阅进行处理与保存布局，这里移除重复订阅避免重复操作

		// 订阅设置滚动模式事件
		this.eventBus.subscribe('命令:设置滚动模式', (mode: string) => {
			try {
				interface TabFlowPluginLike {
					settings?: {
						scrollMode?: string;
					};
					saveSettings?: () => Promise<void>;
				}
				const plugin = this.plugin as unknown as TabFlowPluginLike;
				if (plugin.settings) {
					plugin.settings.scrollMode = mode;
					if (plugin.saveSettings) {
						void plugin.saveSettings();
					}
					// 应用新的滚动模式
					this.configureScrollElement();
					// 触发滚动模式变更事件
					this.app.workspace.trigger('tabflow:scroll-mode-changed', mode);
					// console.debug(`[TabView] 滚动模式已更新为: ${mode}`);
				}
			} catch (e) {
				console.warn('[TabView] 更新滚动模式失败:', e);
			}
		});
		// 添加右上角设置按钮，跳转到 SettingTab 的 player 子页签
		try {
			if (this.settingsAction && this.settingsAction.parentElement) {
				this.settingsAction.remove();
				this.settingsAction = null;
			}
			const btn = this.addAction(
				'settings',
				t('settings.tabs.player', undefined, '设置'),
				() => {
					try {
						this.app.workspace.trigger('tabflow:open-plugin-settings-player');
					} catch {
						// ignore
					}
				}
			);
			this.settingsAction = btn as unknown as HTMLElement;
		} catch (e) {
			// ignore
		}
	}

	async onClose() {
		// console.debug('[TabView] Starting cleanup process');

		document.body.classList.remove('tabflow-hide-statusbar');

		if (this._fontStyle) {
			this._fontStyle.remove();
			// console.debug('[TabView] Removed injected @font-face style.');
		}

		this.unregisterFileWatcher();

		if (this._api) {
			try {
				this._api.destroy();
				// console.debug('[TabView] AlphaTab API destroyed successfully');
			} catch (error) {
				console.error('[TabView] Error destroying AlphaTab API:', error);
			}
		}

		if (this._styles) {
			this._styles.remove();
		}

		// 清理右上角设置按钮
		try {
			if (this.settingsAction && this.settingsAction.parentElement) {
				this.settingsAction.remove();
			}
			this.settingsAction = null;
		} catch (e) {
			// ignore
		}

		try {
			if (this.externalMediaService) {
				this.externalMediaService.destroy();
				this.externalMediaService = null;
			}
			if (this.audioEl) {
				try {
					this.audioEl.pause();
				} catch {
					// Ignore audio pause errors
				}
			}
			if (this.audioObjectUrl && this.audioObjectUrl.startsWith('blob:')) {
				URL.revokeObjectURL(this.audioObjectUrl);
				this.audioObjectUrl = null;
			}
		} catch (e) {
			console.warn('[TabView] 清理外部音频资源失败:', e);
		}

		// 解绑滚轮事件
		if (this.horizontalScrollCleanup) {
			this.horizontalScrollCleanup();
			this.horizontalScrollCleanup = undefined;
		}

		// 解绑 TrackStateStore 订阅
		try {
			if (this.unsubscribeTrackStore) {
				this.unsubscribeTrackStore();
				this.unsubscribeTrackStore = undefined;
			}
		} catch {
			// ignore
		}

		this.currentFile = null;

		// console.debug('[TabView] View unloaded and resources cleaned up');
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.currentFile = file;
		try {
			// console.debug(`[TabView] Loading file: ${file.name}`);

			// 使用 AlphaTabService 加载文件
			if (file.extension && ['alphatab', 'alphatex'].includes(file.extension.toLowerCase())) {
				const textContent = await this.app.vault.read(file);
				await this.alphaTabService.loadAlphaTexScore(textContent);
			} else {
				const inputFile = await this.app.vault.readBinary(file);
				await this.alphaTabService.loadScore(new Uint8Array(inputFile));
			}
			// 配置滚动元素 - 在乐谱加载后设置
			this.configureScrollElement();
			// console.debug(`[TabView] File loaded successfully: ${file.name}`);
		} catch (error) {
			console.error('[TabView] Failed to load file:', error);
			new Notice(`加载乐谱文件失败: ${error.message || '未知错误'}`);
		}
	}

	/**
	 * 配置 Obsidian 环境的滚动容器，并设置横向滚轮转写。
	 */
	private configureScrollElement(): void {
		const selectors = [
			'.workspace-leaf-content.mod-active',
			'.view-content',
			'.workspace-leaf-content',
		];

		let scrollElement: HTMLElement | null = null;
		for (const selector of selectors) {
			scrollElement = document.querySelector(selector) as HTMLElement;
			if (scrollElement) {
				break;
			}
		}

		if (scrollElement) {
			this._api.settings.player.scrollElement = scrollElement;
			// console.debug('[TabView] 设置滚动容器:', scrollElement.className);
		} else {
			this._api.settings.player.scrollElement = 'html,body';
			// console.debug('[TabView] 使用默认滚动容器');
		}

		this._api.updateSettings();

		// 延迟应用滚动模式及智能阈值设置
		setTimeout(() => {
			if (this._api.settings.player) {
				// 根据用户设置选择滚动模式
				interface PluginWithSettings {
					settings?: {
						scrollMode?: string;
					};
				}
				const mode =
					(this.plugin as unknown as PluginWithSettings).settings?.scrollMode ||
					'continuous';
				let sm: alphaTab.ScrollMode;
				switch (mode) {
					case 'continuous':
						sm = alphaTab.ScrollMode.Continuous;
						break;
					case 'offScreen':
						sm = alphaTab.ScrollMode.OffScreen;
						break;
					case 'off':
						sm = alphaTab.ScrollMode.Off;
						break;
					default:
						sm = alphaTab.ScrollMode.Continuous;
				}
				this._api.settings.player.scrollMode = sm;
				this._api.settings.player.enableCursor = true;
				this._api.updateSettings();
				// console.debug(`[TabView] 应用滚动模式: ${mode}`);
			}
		}, 100);

		// 绑定横向滚动事件
		if (this.horizontalScrollCleanup) {
			this.horizontalScrollCleanup(); // 先清理旧的绑定
		}
		if (scrollElement) {
			this.horizontalScrollCleanup = setupHorizontalScroll(scrollElement, this._api);
		}
	}

	private registerFileWatcher(): void {
		this.app.vault.on('modify', this.fileModifyHandler);
		// console.debug('[TabView] 已注册文件监听');
	}

	private unregisterFileWatcher(): void {
		this.app.vault.off('modify', this.fileModifyHandler);
		// console.debug('[TabView] 已注销文件监听');
	}

	private async reloadFile(): Promise<void> {
		if (!this.currentFile || !this._api) {
			return;
		}

		try {
			if (
				this.currentFile.extension &&
				['alphatab', 'alphatex'].includes(this.currentFile.extension.toLowerCase())
			) {
				const textContent = await this.app.vault.read(this.currentFile);
				await this.alphaTabService.loadAlphaTexScore(textContent);
			} else {
				const inputFile = await this.app.vault.readBinary(this.currentFile);
				this._api.load(new Uint8Array(inputFile));
			}
			// console.debug(`[TabView] 已重新加载文件: ${this.currentFile.basename}`);
		} catch (error) {
			console.error('[TabView] 重新加载文件失败', error);
		}
	}

	override async onUnloadFile(file: TFile): Promise<void> {
		// console.debug(`[TabView] Unloading file: ${file.name}`);
		this.currentFile = null;
		await super.onUnloadFile(file);
	}

	public scrollToBottom(): void {
		if (!this._api || !this._api.score) {
			console.warn('[TabView] 乐谱未加载，无法滚动到底部');
			return;
		}

		try {
			const masterBars = this._api.score.masterBars;
			if (!masterBars || masterBars.length === 0) {
				return;
			}

			const lastBar = masterBars[masterBars.length - 1];
			const endTick = lastBar.start + lastBar.calculateDuration();

			this._api.tickPosition = endTick;

			setTimeout(() => {
				if (this._api) {
					this._api.scrollToCursor();
				}
			}, 100);
		} catch (error) {
			console.warn('[TabView] 滚动到底部失败:', error);
		}
	}
}
