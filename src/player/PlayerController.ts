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
import type { StoreCollection } from './store/StoreFactory';
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
	private pendingFileLoad: (() => Promise<void>) | null = null;
	private eventHandlers: Map<string, any> = new Map();

	// Store 集合（由 ReactView 注入）
	private stores: StoreCollection;

	constructor(plugin: Plugin, resources: PlayerControllerResources, stores: StoreCollection) {
		this.plugin = plugin;
		this.resources = resources;
		this.stores = stores;

		console.log('[PlayerController] Initialized with stores:', {
			globalConfig: !!stores.globalConfig,
			workspaceConfig: !!stores.workspaceConfig,
			runtime: !!stores.runtime,
			ui: !!stores.ui,
		});

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
				'[PlayerController] Container has zero dimensions! Delaying API initialization...'
			);
			// 延迟初始化，等待容器尺寸就绪
			setTimeout(() => this.init(container), 50);
			return;
		}

		console.log(
			'[PlayerController] Container ready, width:',
			rect.width,
			'height:',
			rect.height
		);

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

		this.stores.ui.getState().setLoading(true, 'Loading score...');
		this.stores.runtime.getState().setApiReady(false);

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
			this.stores.runtime.getState().setApi(this.api);

			// 更新最后配置
			this.lastConfig = JSON.parse(JSON.stringify(config));

			// API 准备好后，检查是否有待加载的文件
			if (this.pendingFileLoad) {
				await this.pendingFileLoad();
				this.pendingFileLoad = null;
			}
		} catch (error) {
			console.error('[PlayerController] Failed to rebuild API:', error);
			this.stores.runtime
				.getState()
				.setError('api-init', error instanceof Error ? error.message : String(error));
			this.stores.ui.getState().showToast('error', 'Failed to initialize player');
		} finally {
			this.stores.ui.getState().setLoading(false);
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
				scrollElement: 'html,body', // 先用默认值，在 renderFinished 后再设置
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

		// 调试：输出布局相关配置
		console.log('[PlayerController] Layout settings:', {
			layoutMode: settings.display.layoutMode,
			barsPerRow: settings.display.barsPerRow,
			stretchForce: settings.display.stretchForce,
			scale: settings.display.scale,
			containerWidth: this.container?.getBoundingClientRect().width,
		});

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
	}

	/**
	 * 配置滚动容器（在渲染完成后调用）
	 * 参考 TabView 的实现，使用延迟确保 DOM 就绪
	 */
	private configureScrollElement(): void {
		if (!this.api) return;

		// 尝试多个选择器查找 Obsidian 的滚动容器
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

		// 如果在 selectors 中没找到，尝试从 container 向上查找
		if (!scrollElement && this.container) {
			const workspaceLeaf = this.container.closest('.workspace-leaf-content');
			if (workspaceLeaf) {
				scrollElement = workspaceLeaf as HTMLElement;
			}
		}

		if (scrollElement) {
			this.api.settings.player.scrollElement = scrollElement;
			console.log('[PlayerController] Scroll container configured:', scrollElement.className);
		} else {
			this.api.settings.player.scrollElement = 'html,body';
			console.log('[PlayerController] Using default scroll container: html,body');
		}

		this.api.updateSettings();

		// 延迟应用滚动模式及光标设置（参考 TabView）
		setTimeout(() => {
			if (this.api?.settings.player) {
				const config = useConfigStore.getState().config;
				this.api.settings.player.scrollMode = config.alphaTabSettings.player.scrollMode;
				this.api.settings.player.enableCursor = config.alphaTabSettings.player.enableCursor;
				this.api.updateSettings();
				console.log(
					'[PlayerController] Scroll mode applied:',
					config.alphaTabSettings.player.scrollMode
				);
			}
		}, 100);
	}

	// ========== API Events ==========

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
				this.stores.runtime.getState().setScoreLoaded(true);
				this.stores.runtime.getState().setRenderState('idle');

				// 设置总时长（关键：从 score.duration 获取）
				if (this.api?.score) {
					const durationMs = this.api.score.masterBars.reduce(
						(sum, bar) => sum + bar.calculateDuration(),
						0
					);
					this.stores.runtime.getState().setDuration(durationMs);
					console.log('[PlayerController] Score loaded, duration:', durationMs, 'ms');
				}

				// 延迟配置滚动容器，确保 DOM 就绪（参考 TabView）
				setTimeout(() => {
					this.configureScrollElement();
				}, 100);
			};
			this.api.scoreLoaded.on(scoreLoadedHandler);
			this.eventHandlers.set('scoreLoaded', scoreLoadedHandler);

			// Render Started
			const renderStartedHandler = () => {
				this.stores.runtime.getState().setRenderState('rendering');
			};
			this.api.renderStarted.on(renderStartedHandler);
			this.eventHandlers.set('renderStarted', renderStartedHandler);

			// Render Finished
			const renderFinishedHandler = () => {
				this.stores.runtime.getState().setRenderState('finished');
			};
			this.api.renderFinished.on(renderFinishedHandler);
			this.eventHandlers.set('renderFinished', renderFinishedHandler);

			// Player Ready
			const playerReadyHandler = async () => {
				console.log('[PlayerController] Player ready - can now play music');
				this.stores.runtime.getState().setApiReady(true);

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
				this.stores.runtime.getState().setPlaybackState(stateMap[e.state] || 'idle');
			};
			this.api.playerStateChanged.on(playerStateChangedHandler);
			this.eventHandlers.set('playerStateChanged', playerStateChangedHandler);

			// Player Position Changed
			const playerPositionChangedHandler = (e: any) => {
				this.stores.runtime.getState().setPosition(e.currentTime);
				this.stores.runtime.getState().setCurrentBeat({
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
				this.stores.runtime.getState().setError('api-init', error.message || String(error));
				this.stores.ui.getState().showToast('error', 'An error occurred in the player');
			};
			this.api.error.on(errorHandler);
			this.eventHandlers.set('error', errorHandler);
		} catch (error) {
			console.error('[PlayerController] Failed to bind API events:', error);
			this.stores.runtime.getState().setError('api-init', 'Failed to bind API events');
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

	// ========== Player Settings ==========

	/**
	 * 设置节拍器音量（0-1）
	 */
	setMetronome(enabled: boolean): void {
		if (!this.api) return;
		this.api.metronomeVolume = enabled ? 1 : 0;
	}

	/**
	 * 设置预备拍音量（0-1）
	 */
	setCountIn(enabled: boolean): void {
		if (!this.api) return;
		this.api.countInVolume = enabled ? 1 : 0;
	}

	/**
	 * 设置循环播放
	 */
	setLooping(enabled: boolean): void {
		if (!this.api) return;
		this.api.isLooping = enabled;
	}

	/**
	 * 设置缩放比例
	 */
	setZoom(scale: number): void {
		if (!this.api) return;
		this.api.settings.display.scale = scale;
		this.api.updateSettings();
		this.api.render();
	}

	/**
	 * 设置布局模式
	 */
	setLayoutMode(mode: alphaTab.LayoutMode): void {
		if (!this.api) return;
		this.api.settings.display.layoutMode = mode;
		this.api.updateSettings();
		this.api.render();
	}

	/**
	 * 设置谱表模式
	 */
	setStaveProfile(profile: alphaTab.StaveProfile): void {
		if (!this.api) return;
		// StaveProfile 需要通过 settings.display.staveProfile 设置
		this.api.settings.display.staveProfile = profile;
		this.api.updateSettings();
		this.api.render();
	}

	/**
	 * 设置滚动模式
	 */
	setScrollMode(mode: alphaTab.ScrollMode): void {
		if (!this.api) return;
		this.api.settings.player.scrollMode = mode;
		this.api.updateSettings();
	}

	/**
	 * 设置滚动速度（毫秒）
	 */
	setScrollSpeed(speed: number): void {
		if (!this.api) return;
		this.api.settings.player.scrollSpeed = speed;
		this.api.updateSettings();
	}

	/**
	 * 手动滚动到当前光标位置
	 */
	scrollToCursor(): void {
		if (!this.api) return;
		// AlphaTab 会在播放时自动滚动，这里可以强制触发
		// 通过暂时切换 scrollMode 来实现
		const currentMode = this.api.settings.player.scrollMode;
		if (currentMode === alphaTab.ScrollMode.Off) {
			// 如果已经关闭滚动，暂时启用
			this.api.settings.player.scrollMode = alphaTab.ScrollMode.Continuous;
			this.api.updateSettings();
			// 触发一次位置更新
			setTimeout(() => {
				if (this.api) {
					this.api.settings.player.scrollMode = currentMode;
					this.api.updateSettings();
				}
			}, 100);
		}
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
		if (this.stores.runtime.getState().apiReady && this.api) {
			await loadTask();
		} else {
			this.pendingFileLoad = loadTask;
		}
	}

	async loadScoreFromUrl(url: string): Promise<void> {
		if (!this.api) {
			throw new Error('API not initialized');
		}

		this.stores.ui.getState().setLoading(true, 'Loading score...');
		this.stores.runtime.getState().setScoreLoaded(false);
		this.stores.runtime.getState().clearError();

		try {
			await this.api.load(url);
			useConfigStore.getState().updateScoreSource({ type: 'url', content: url });
			this.stores.ui.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to load score:', error);
			this.stores.runtime
				.getState()
				.setError('score-load', error instanceof Error ? error.message : String(error));
			this.stores.ui.getState().showToast('error', 'Failed to load score');
			throw error;
		} finally {
			this.stores.ui.getState().setLoading(false);
		}
	}

	async loadScoreFromFile(arrayBuffer: ArrayBuffer, fileName?: string): Promise<void> {
		if (!this.api) {
			throw new Error('API not initialized');
		}

		this.stores.ui.getState().setLoading(true, 'Loading score...');
		this.stores.runtime.getState().setScoreLoaded(false);
		this.stores.runtime.getState().clearError();

		try {
			await this.api.load(new Uint8Array(arrayBuffer));
			useConfigStore
				.getState()
				.updateScoreSource({ type: 'file', content: fileName || 'local-file' });
			this.stores.ui.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to load score:', error);
			this.stores.runtime
				.getState()
				.setError('score-load', error instanceof Error ? error.message : String(error));
			this.stores.ui.getState().showToast('error', 'Failed to load score');
			throw error;
		} finally {
			this.stores.ui.getState().setLoading(false);
		}
	}

	async loadScoreFromAlphaTex(tex: string): Promise<void> {
		if (!this.api) {
			throw new Error('API not initialized');
		}

		this.stores.ui.getState().setLoading(true, 'Loading score...');
		this.stores.runtime.getState().setScoreLoaded(false);
		this.stores.runtime.getState().clearError();

		try {
			this.api.tex(tex);
			useConfigStore.getState().updateScoreSource({ type: 'alphatex', content: tex });
			this.stores.ui.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to load score:', error);
			this.stores.runtime
				.getState()
				.setError('score-load', error instanceof Error ? error.message : String(error));
			this.stores.ui.getState().showToast('error', 'Failed to load score');
			throw error;
		} finally {
			this.stores.ui.getState().setLoading(false);
		}
	}

	// ========== Track Management ==========

	muteTrack(trackIndex: number, mute: boolean): void {
		if (!this.api?.score?.tracks[trackIndex]) return;

		const track = this.api.score.tracks[trackIndex];
		track.playbackInfo.isMute = mute;

		this.stores.runtime.getState().setTrackOverride(String(trackIndex), { muteOverride: mute });
	}

	soloTrack(trackIndex: number, solo: boolean): void {
		if (!this.api?.score?.tracks[trackIndex]) return;

		const track = this.api.score.tracks[trackIndex];
		track.playbackInfo.isSolo = solo;

		this.stores.runtime.getState().setTrackOverride(String(trackIndex), { soloOverride: solo });
	}

	setTrackVolume(trackIndex: number, volume: number): void {
		if (!this.api?.score?.tracks[trackIndex]) return;

		const track = this.api.score.tracks[trackIndex];
		track.playbackInfo.volume = Math.max(0, Math.min(16, volume * 16)); // alphaTab uses 0-16

		this.stores.runtime
			.getState()
			.setTrackOverride(String(trackIndex), { volumeOverride: volume });
	}

	// ========== Store Accessors ==========

	/**
	 * 获取运行时状态存储实例（用于 React 组件）
	 */
	getRuntimeStore() {
		return this.stores.runtime;
	}

	/**
	 * 获取 UI 状态存储实例（用于 React 组件）
	 */
	getUIStore() {
		return this.stores.ui;
	}
}
