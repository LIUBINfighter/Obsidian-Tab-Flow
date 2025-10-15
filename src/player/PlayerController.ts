/**
 * Player Controller - 播放器控制器（架构中的中台层）
 *
 * 职责：
 * 1. 监听 configStore 的变化，自动重建 alphaTab API
 * 2. 监听 alphaTab API 事件，同步到 runtimeStore
 * 3. 提供播放控制命令接口（play, pause, stop, seek）
 * 4. 管理 alphaTab API 生命周期
 *
 * 独立于 React 组件，可被任何视图层使用
 */

import type { AlphaTabApi } from '@coderline/alphatab';
import { useConfigStore } from './store/configStore';
import { createRuntimeStore, type RuntimeStore } from './store/runtimeStore';
import { createUIStore, type UIStore } from './store/uiStore';
import type { AlphaTabPlayerConfig } from './types/config-schema';
import type { Plugin, TFile } from 'obsidian';
import * as alphaTab from '@coderline/alphatab';
import * as convert from 'color-convert';

export interface PlayerControllerResources {
	bravuraUri: string;
	alphaTabWorkerUri: string;
	soundFontUri: string;
}

export class PlayerController {
	private api: AlphaTabApi | null = null;
	private container: HTMLElement | null = null;
	private unsubscribeConfig: (() => void) | null = null;
	private lastConfig: AlphaTabPlayerConfig | null = null;
	private plugin: Plugin;
	private resources: PlayerControllerResources;
	private pendingFileLoad: (() => Promise<void>) | null = null; // 添加待处理加载任务
	private eventHandlers: Map<string, any> = new Map(); // 事件处理器引用管理

	// 独立的 store 实例（工厂模式）
	private runtimeStore: ReturnType<typeof createRuntimeStore>;
	private uiStore: ReturnType<typeof createUIStore>;

	constructor(plugin: Plugin, resources: PlayerControllerResources) {
		this.plugin = plugin;
		this.resources = resources;

		// 创建独立的 store 实例
		this.runtimeStore = createRuntimeStore();
		this.uiStore = createUIStore();

		// 初始化配置中的资源路径
		this.initializeResourcePaths();
	}

	/**
	 * 初始化配置中的资源路径
	 */
	private initializeResourcePaths(): void {
		const config = useConfigStore.getState().config;
		const needsUpdate =
			config.alphaTabSettings.core.scriptFile !== this.resources.alphaTabWorkerUri ||
			config.alphaTabSettings.player.soundFont !== this.resources.soundFontUri;

		if (needsUpdate) {
			useConfigStore.getState().updateConfig((draft) => {
				draft.alphaTabSettings.core.scriptFile = this.resources.alphaTabWorkerUri;
				draft.alphaTabSettings.player.soundFont = this.resources.soundFontUri;
			});
		}
	}

	/**
	 * 初始化控制器
	 * @param container alphaTab 渲染容器
	 */
	init(container: HTMLElement): void {
		this.container = container;

		// 检查容器是否有有效的尺寸
		const rect = container.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) {
			console.warn(
				'[PlayerController] Container has zero dimensions! This may cause rendering issues.'
			);
		}

		// 订阅配置变化
		this.subscribeToConfig();

		// 初始化 API
		const config = useConfigStore.getState().config;
		this.rebuildApi(config);
	}

	/**
	 * 销毁控制器
	 */
	destroy(): void {
		this.destroyApi();
		this.unsubscribeConfig?.();
		this.container = null;
	}

	// ========== Config Subscription ==========

	private subscribeToConfig(): void {
		this.unsubscribeConfig = useConfigStore.subscribe((state) => {
			const newConfig = state.config;

			// 仅当配置真正改变时重建
			if (this.shouldRebuildApi(newConfig)) {
				console.log('[PlayerController] Config changed, rebuilding API');
				this.rebuildApi(newConfig);
			}
		});
	}

	private shouldRebuildApi(newConfig: AlphaTabPlayerConfig): boolean {
		if (!this.lastConfig) {
			return true;
		}

		// 排除 scoreSource，因为它只记录当前加载的文件，不影响 alphaTab API 设置
		// scoreSource 的变化不应该触发 API 重建
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { scoreSource: _oldSource, ...oldRest } = this.lastConfig;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { scoreSource: _newSource, ...newRest } = newConfig;

		const oldConfigStr = JSON.stringify(oldRest);
		const newConfigStr = JSON.stringify(newRest);
		return oldConfigStr !== newConfigStr;
	}

	// ========== API Lifecycle ==========

	private async rebuildApi(config: AlphaTabPlayerConfig): Promise<void> {
		if (!this.container) {
			console.warn('[PlayerController] No container, skipping rebuild');
			return;
		}

		this.uiStore.getState().setLoading(true, 'Loading score...');
		this.runtimeStore.getState().setApiReady(false);

		try {
			// 销毁旧 API
			this.destroyApi();

			// 创建 alphaTab Settings
			const settings = this.createAlphaTabSettings(config);

			// 创建新 API（直接使用静态导入的 alphaTab 模块）
			this.api = new alphaTab.AlphaTabApi(this.container, settings);

			// 绑定事件
			this.bindApiEvents();

			// 保存到 runtimeStore
			this.runtimeStore.getState().setApi(this.api);

			// 更新最后配置
			this.lastConfig = JSON.parse(JSON.stringify(config));

			// API 准备好后，检查是否有待加载的文件
			if (this.pendingFileLoad) {
				await this.pendingFileLoad();
				this.pendingFileLoad = null;
			}
		} catch (error) {
			console.error('[PlayerController] Failed to rebuild API:', error);
			this.runtimeStore
				.getState()
				.setError('api-init', error instanceof Error ? error.message : String(error));
			this.uiStore.getState().showToast('error', 'Failed to initialize player');
		} finally {
			this.uiStore.getState().setLoading(false);
		}
	}

	private destroyApi(): void {
		if (this.api) {
			try {
				// 先解绑事件
				this.unbindApiEvents();

				// 再销毁 API
				this.api.destroy();
			} catch (error) {
				console.warn('[PlayerController] Error destroying API:', error);
			}
			this.api = null;
		}
	}

	private createAlphaTabSettings(config: AlphaTabPlayerConfig): any {
		// 获取当前容器的计算样式用于颜色配置
		const style = this.container ? window.getComputedStyle(this.container) : null;

		// 配置滚动元素（关键！需要设置为实际的容器或其父级）
		let scrollElement: HTMLElement | string = 'html,body';
		if (this.container) {
			// 尝试查找 Obsidian 的滚动容器
			const workspaceLeaf = this.container.closest('.workspace-leaf-content');
			if (workspaceLeaf) {
				scrollElement = workspaceLeaf as HTMLElement;
			} else {
				scrollElement = this.container;
			}
		}

		const settings: any = {
			core: {
				file: config.alphaTabSettings.core.file,
				engine: config.alphaTabSettings.core.engine || 'html5',
				useWorkers: config.alphaTabSettings.core.useWorkers,
				logLevel: config.alphaTabSettings.core.logLevel,
				includeNoteBounds: config.alphaTabSettings.core.includeNoteBounds,
				scriptFile: this.resources.alphaTabWorkerUri,
				// 不设置 fontDirectory,由 smuflFontSources 控制
			},
			player: {
				enablePlayer: config.alphaTabSettings.player.enablePlayer,
				playerMode: alphaTab.PlayerMode.EnabledAutomatic,
				scrollSpeed: config.alphaTabSettings.player.scrollSpeed,
				scrollMode: config.alphaTabSettings.player.scrollMode,
				scrollOffsetX: config.alphaTabSettings.player.scrollOffsetX,
				scrollOffsetY: config.alphaTabSettings.player.scrollOffsetY,
				enableCursor: config.alphaTabSettings.player.enableCursor,
				enableAnimatedBeatCursor: config.alphaTabSettings.player.enableAnimatedBeatCursor,
				soundFont: this.resources.soundFontUri,
				scrollElement: scrollElement,
				nativeBrowserSmoothScroll: false,
			},
			display: {
				scale: config.alphaTabSettings.display.scale,
				startBar: config.alphaTabSettings.display.startBar,
				layoutMode: config.alphaTabSettings.display.layoutMode,
				barsPerRow: config.alphaTabSettings.display.barsPerRow,
				stretchForce: config.alphaTabSettings.display.stretchForce,
			},
		};

		// 配置字体源 - 使用正确的字体格式枚举
		// AlphaTab 的 FontFileFormat 枚举值：Woff2 = 0, Woff = 1, Ttf = 2
		if (this.resources.bravuraUri) {
			const FontFileFormat_Woff2 = 0; // alphaTab.rendering.glyphs.FontFileFormat.Woff2
			settings.core.smuflFontSources = new Map([
				[FontFileFormat_Woff2, this.resources.bravuraUri],
			]);
			console.log('[PlayerController] Font configured:', this.resources.bravuraUri);
		}

		// 添加颜色配置
		if (style) {
			settings.display.resources = {
				mainGlyphColor: style.getPropertyValue('--color-base-100') || '#000',
				secondaryGlyphColor: style.getPropertyValue('--color-base-60') || '#666',
				staffLineColor: style.getPropertyValue('--color-base-40') || '#ccc',
				barSeparatorColor: style.getPropertyValue('--color-base-40') || '#ccc',
				barNumberColor:
					'#' +
					convert.hsl.hex([
						parseFloat(style.getPropertyValue('--accent-h')) || 0,
						parseFloat(style.getPropertyValue('--accent-s')) || 50,
						parseFloat(style.getPropertyValue('--accent-l')) || 50,
					]),
				scoreInfoColor: style.getPropertyValue('--color-base-100') || '#000',
			};
		}

		return settings;
	} // ========== API Events ==========

	/**
	 * 解绑所有 API 事件
	 */
	private unbindApiEvents(): void {
		if (!this.api || this.eventHandlers.size === 0) {
			return;
		}

		try {
			this.eventHandlers.forEach((handler, eventName) => {
				try {
					// AlphaTab 事件解绑使用 off 方法
					const event = (this.api as any)[eventName];
					if (event && typeof event.off === 'function') {
						event.off(handler);
					}
				} catch (error) {
					console.warn(`[PlayerController] Failed to unbind event ${eventName}:`, error);
				}
			});

			this.eventHandlers.clear();
		} catch (error) {
			console.error('[PlayerController] Failed to unbind events:', error);
		}
	}

	private bindApiEvents(): void {
		if (!this.api) {
			console.warn('[PlayerController] Cannot bind events - API not initialized');
			return;
		}

		// 先解绑旧事件，防止重复绑定
		this.unbindApiEvents();

		try {
			// Score Loaded
			const scoreLoadedHandler = () => {
				this.runtimeStore.getState().setScoreLoaded(true);
				this.runtimeStore.getState().setRenderState('idle');

				// 设置总时长（关键：从 score.duration 获取）
				if (this.api?.score) {
					const durationMs = this.api.score.masterBars.reduce(
						(sum, bar) => sum + bar.calculateDuration(),
						0
					);
					this.runtimeStore.getState().setDuration(durationMs);
					console.log('[PlayerController] Score loaded, duration:', durationMs, 'ms');
				}
			};
			this.api.scoreLoaded.on(scoreLoadedHandler);
			this.eventHandlers.set('scoreLoaded', scoreLoadedHandler);

			// Render Started
			const renderStartedHandler = () => {
				this.runtimeStore.getState().setRenderState('rendering');
			};
			this.api.renderStarted.on(renderStartedHandler);
			this.eventHandlers.set('renderStarted', renderStartedHandler);

			// Render Finished
			const renderFinishedHandler = () => {
				this.runtimeStore.getState().setRenderState('finished');
			};
			this.api.renderFinished.on(renderFinishedHandler);
			this.eventHandlers.set('renderFinished', renderFinishedHandler);

			// Player Ready
			const playerReadyHandler = async () => {
				console.log('[PlayerController] Player ready - can now play music');
				this.runtimeStore.getState().setApiReady(true);

				// 播放器就绪后，检查是否有待加载的文件
				if (this.pendingFileLoad) {
					await this.pendingFileLoad();
					this.pendingFileLoad = null;
				}
			};
			this.api.playerReady.on(playerReadyHandler);
			this.eventHandlers.set('playerReady', playerReadyHandler);

			// Player State Changed
			const playerStateChangedHandler = (e: any) => {
				const stateMap: Record<number, 'idle' | 'playing' | 'paused' | 'stopped'> = {
					0: 'paused',
					1: 'playing',
					2: 'stopped',
				};
				this.runtimeStore.getState().setPlaybackState(stateMap[e.state] || 'idle');
			};
			this.api.playerStateChanged.on(playerStateChangedHandler);
			this.eventHandlers.set('playerStateChanged', playerStateChangedHandler);

			// Player Position Changed
			const playerPositionChangedHandler = (e: any) => {
				this.runtimeStore.getState().setPosition(e.currentTime);
				this.runtimeStore.getState().setCurrentBeat({
					bar: e.currentBar,
					beat: e.currentBeat,
					tick: e.currentTick || 0,
				});
			};
			this.api.playerPositionChanged.on(playerPositionChangedHandler);
			this.eventHandlers.set('playerPositionChanged', playerPositionChangedHandler);

			// Error
			const errorHandler = (error: any) => {
				console.error('[PlayerController] alphaTab error:', error);
				this.runtimeStore.getState().setError('api-init', error.message || String(error));
				this.uiStore.getState().showToast('error', 'An error occurred in the player');
			};
			this.api.error.on(errorHandler);
			this.eventHandlers.set('error', errorHandler);
		} catch (error) {
			console.error('[PlayerController] Failed to bind API events:', error);
			this.runtimeStore.getState().setError('api-init', 'Failed to bind API events');
		}
	}

	// ========== Playback Commands ==========

	play(): void {
		if (!this.api) {
			console.warn('[PlayerController] play() called but API not ready');
			return;
		}
		this.api.play();
	}

	pause(): void {
		if (!this.api) return;
		this.api.pause();
	}

	stop(): void {
		if (!this.api) return;
		this.api.stop();
	}

	playPause(): void {
		if (!this.api) return;
		this.api.playPause();
	}

	seek(positionMs: number): void {
		if (!this.api) return;
		this.api.tickPosition = positionMs;
	}

	setPlaybackSpeed(speed: number): void {
		if (!this.api) return;
		this.api.playbackSpeed = speed;
	}

	setMasterVolume(volume: number): void {
		if (!this.api) return;
		this.api.masterVolume = volume;
	}

	setMetronomeVolume(volume: number): void {
		if (!this.api) return;
		this.api.metronomeVolume = volume;
	}

	setCountInVolume(volume: number): void {
		if (!this.api) return;
		this.api.countInVolume = volume;
	}

	// ========== Score Loading ==========

	/**
	 * 智能加载文件，处理API未就绪的情况
	 */
	async loadFileWhenReady(file: TFile): Promise<void> {
		const loadTask = async () => {
			if (file.extension && ['alphatab', 'alphatex'].includes(file.extension.toLowerCase())) {
				const textContent = await this.plugin.app.vault.read(file);
				await this.loadScoreFromAlphaTex(textContent);
			} else {
				const arrayBuffer = await this.plugin.app.vault.readBinary(file);
				await this.loadScoreFromFile(arrayBuffer, file.name);
			}
		};

		// 如果 API 已经就绪，立即执行。否则，放入队列。
		if (this.runtimeStore.getState().apiReady && this.api) {
			await loadTask();
		} else {
			this.pendingFileLoad = loadTask;
		}
	}

	async loadScoreFromUrl(url: string): Promise<void> {
		if (!this.api) {
			throw new Error('API not initialized');
		}

		this.uiStore.getState().setLoading(true, 'Loading score...');
		this.runtimeStore.getState().setScoreLoaded(false);
		this.runtimeStore.getState().clearError();

		try {
			await this.api.load(url);
			useConfigStore.getState().updateScoreSource({ type: 'url', content: url });
			this.uiStore.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to load score:', error);
			this.runtimeStore
				.getState()
				.setError('score-load', error instanceof Error ? error.message : String(error));
			this.uiStore.getState().showToast('error', 'Failed to load score');
			throw error;
		} finally {
			this.uiStore.getState().setLoading(false);
		}
	}

	async loadScoreFromFile(arrayBuffer: ArrayBuffer, fileName?: string): Promise<void> {
		if (!this.api) {
			throw new Error('API not initialized');
		}

		this.uiStore.getState().setLoading(true, 'Loading score...');
		this.runtimeStore.getState().setScoreLoaded(false);
		this.runtimeStore.getState().clearError();

		try {
			await this.api.load(new Uint8Array(arrayBuffer));
			useConfigStore
				.getState()
				.updateScoreSource({ type: 'file', content: fileName || 'local-file' });
			this.uiStore.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to load score:', error);
			this.runtimeStore
				.getState()
				.setError('score-load', error instanceof Error ? error.message : String(error));
			this.uiStore.getState().showToast('error', 'Failed to load score');
			throw error;
		} finally {
			this.uiStore.getState().setLoading(false);
		}
	}

	async loadScoreFromAlphaTex(tex: string): Promise<void> {
		if (!this.api) {
			throw new Error('API not initialized');
		}

		this.uiStore.getState().setLoading(true, 'Loading score...');
		this.runtimeStore.getState().setScoreLoaded(false);
		this.runtimeStore.getState().clearError();

		try {
			this.api.tex(tex);
			useConfigStore.getState().updateScoreSource({ type: 'alphatex', content: tex });
			this.uiStore.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to load score:', error);
			this.runtimeStore
				.getState()
				.setError('score-load', error instanceof Error ? error.message : String(error));
			this.uiStore.getState().showToast('error', 'Failed to load score');
			throw error;
		} finally {
			this.uiStore.getState().setLoading(false);
		}
	}

	// ========== Track Management ==========

	muteTrack(trackIndex: number, mute: boolean): void {
		if (!this.api?.score?.tracks[trackIndex]) return;

		const track = this.api.score.tracks[trackIndex];
		track.playbackInfo.isMute = mute;

		this.runtimeStore.getState().setTrackOverride(String(trackIndex), { muteOverride: mute });
	}

	soloTrack(trackIndex: number, solo: boolean): void {
		if (!this.api?.score?.tracks[trackIndex]) return;

		const track = this.api.score.tracks[trackIndex];
		track.playbackInfo.isSolo = solo;

		this.runtimeStore.getState().setTrackOverride(String(trackIndex), { soloOverride: solo });
	}

	setTrackVolume(trackIndex: number, volume: number): void {
		if (!this.api?.score?.tracks[trackIndex]) return;

		const track = this.api.score.tracks[trackIndex];
		track.playbackInfo.volume = Math.max(0, Math.min(16, volume * 16)); // alphaTab uses 0-16

		this.runtimeStore.getState().setTrackOverride(String(trackIndex), { volumeOverride: volume });
	}

	// ========== Store Accessors ==========

	/**
	 * 获取运行时状态存储实例（用于 React 组件）
	 */
	getRuntimeStore(): ReturnType<typeof createRuntimeStore> {
		return this.runtimeStore;
	}

	/**
	 * 获取 UI 状态存储实例（用于 React 组件）
	 */
	getUIStore(): ReturnType<typeof createUIStore> {
		return this.uiStore;
	}
}
