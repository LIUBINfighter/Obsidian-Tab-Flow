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
import { useRuntimeStore } from './store/runtimeStore';
import { useUIStore } from './store/uiStore';
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

	constructor(plugin: Plugin, resources: PlayerControllerResources) {
		this.plugin = plugin;
		this.resources = resources;
		console.log('[PlayerController] Initialized with resources:', resources);

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
		console.log('[PlayerController] init() called with container:', container);
		this.container = container;

		// 检查容器是否有有效的尺寸
		const rect = container.getBoundingClientRect();
		console.log('[PlayerController] Container dimensions:', {
			width: rect.width,
			height: rect.height,
			visible: rect.width > 0 && rect.height > 0,
		});

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
		console.log('[PlayerController] destroy() called');
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
		if (!this.lastConfig) return true;

		// 简单对比（生产环境可用 deep-equal 库）
		return JSON.stringify(this.lastConfig) !== JSON.stringify(newConfig);
	}

	// ========== API Lifecycle ==========

	private async rebuildApi(config: AlphaTabPlayerConfig): Promise<void> {
		if (!this.container) {
			console.warn('[PlayerController] No container, skipping rebuild');
			return;
		}

		useUIStore.getState().setLoading(true, 'Loading score...');
		useRuntimeStore.getState().setApiReady(false);

		try {
			// 销毁旧 API
			this.destroyApi();

			// 创建 alphaTab Settings
			const settings = this.createAlphaTabSettings(config);

			// 创建新 API（使用动态导入确保类型正确）
			const alphaTabModule = await import('@coderline/alphatab');
			this.api = new alphaTabModule.AlphaTabApi(this.container, settings);

			// 绑定事件
			this.bindApiEvents();

			// 保存到 runtimeStore
			useRuntimeStore.getState().setApi(this.api);

			// 更新最后配置
			this.lastConfig = JSON.parse(JSON.stringify(config));

			// *** 新增逻辑：API 准备好后，检查是否有待加载的文件 ***
			if (this.pendingFileLoad) {
				console.log('[PlayerController] API is ready, executing pending file load.');
				await this.pendingFileLoad();
				this.pendingFileLoad = null; // 清空任务
			}

			console.log('[PlayerController] API rebuilt successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to rebuild API:', error);
			useRuntimeStore
				.getState()
				.setError('api-init', error instanceof Error ? error.message : String(error));
			useUIStore.getState().showToast('error', 'Failed to initialize player');
		} finally {
			useUIStore.getState().setLoading(false);
		}
	}

	private destroyApi(): void {
		if (this.api) {
			try {
				this.api.destroy();
				console.log('[PlayerController] API destroyed');
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
				console.log('[PlayerController] Using workspace-leaf-content as scroll element');
			} else {
				scrollElement = this.container;
				console.log('[PlayerController] Using container as scroll element');
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
				fontDirectory: '',
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

		// 添加字体配置（使用与 AlphaTabService 相同的方式）
		if (this.resources.bravuraUri) {
			try {
				// 使用 Map 结构配置字体，参考 AlphaTabService.ts
				const FontFileFormat = (alphaTab as any).rendering?.glyphs?.FontFileFormat;
				if (FontFileFormat && FontFileFormat.Woff2 !== undefined) {
					settings.core.smuflFontSources = new Map([
						[FontFileFormat.Woff2, this.resources.bravuraUri],
					]) as unknown as Map<number, string>;
					console.log(
						'[PlayerController] Font source configured:',
						this.resources.bravuraUri
					);
				} else {
					console.warn(
						'[PlayerController] FontFileFormat.Woff2 not available, using fallback'
					);
					settings.core.smuflFontSources = new Map([
						[0, this.resources.bravuraUri],
					]) as unknown as Map<number, string>;
				}
			} catch (error) {
				console.error('[PlayerController] Failed to configure font:', error);
			}
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

		console.log('[PlayerController] Settings created:', {
			...settings,
			core: {
				...settings.core,
				smuflFontSources: settings.core.smuflFontSources ? 'Map configured' : 'none',
			},
		});
		return settings;
	} // ========== API Events ==========

	private bindApiEvents(): void {
		if (!this.api) {
			console.warn('[PlayerController] Cannot bind events - API not initialized');
			return;
		}

		try {
			// Score Loaded
			this.api.scoreLoaded.on(() => {
				console.log('[PlayerController] scoreLoaded');
				useRuntimeStore.getState().setScoreLoaded(true);
				useRuntimeStore.getState().setRenderState('idle');
			});

			// Render Started
			this.api.renderStarted.on(() => {
				console.log('[PlayerController] renderStarted');
				useRuntimeStore.getState().setRenderState('rendering');
			});

			// Render Finished
			this.api.renderFinished.on(() => {
				console.log('[PlayerController] renderFinished');
				useRuntimeStore.getState().setRenderState('finished');
			});

			// Player Ready
			this.api.playerReady.on(async () => {
				console.log('[PlayerController] playerReady');
				useRuntimeStore.getState().setApiReady(true);

				// *** 新增逻辑：播放器就绪后，检查是否有待加载的文件 ***
				if (this.pendingFileLoad) {
					console.log('[PlayerController] Player is ready, executing pending file load.');
					await this.pendingFileLoad();
					this.pendingFileLoad = null;
				}
			});

			// Player State Changed
			this.api.playerStateChanged.on((e: any) => {
				console.log('[PlayerController] playerStateChanged:', e.state);
				const stateMap: Record<number, 'idle' | 'playing' | 'paused' | 'stopped'> = {
					0: 'paused',
					1: 'playing',
					2: 'stopped',
				};
				useRuntimeStore.getState().setPlaybackState(stateMap[e.state] || 'idle');
			});

			// Player Position Changed
			this.api.playerPositionChanged.on((e: any) => {
				useRuntimeStore.getState().setPosition(e.currentTime);
				useRuntimeStore.getState().setCurrentBeat({
					bar: e.currentBar,
					beat: e.currentBeat,
					tick: e.currentTick || 0,
				});
			});

			// Error
			this.api.error.on((error: any) => {
				console.error('[PlayerController] alphaTab error:', error);
				useRuntimeStore.getState().setError('api-init', error.message || String(error));
				useUIStore.getState().showToast('error', 'An error occurred in the player');
			});

			console.log('[PlayerController] Events bound successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to bind API events:', error);
			useRuntimeStore.getState().setError('api-init', 'Failed to bind API events');
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

	// ========== Score Loading ==========

	/**
	 * 新增：智能加载文件，处理API未就绪的情况
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
		if (useRuntimeStore.getState().apiReady && this.api) {
			console.log('[PlayerController] API is already ready, loading file immediately.');
			await loadTask();
		} else {
			console.log('[PlayerController] API not ready, queuing file load.');
			this.pendingFileLoad = loadTask;
		}
	}

	async loadScoreFromUrl(url: string): Promise<void> {
		if (!this.api) {
			throw new Error('API not initialized');
		}

		useUIStore.getState().setLoading(true, 'Loading score...');
		useRuntimeStore.getState().setScoreLoaded(false);
		useRuntimeStore.getState().clearError();

		try {
			await this.api.load(url);
			useConfigStore.getState().updateScoreSource({ type: 'url', content: url });
			useUIStore.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to load score:', error);
			useRuntimeStore
				.getState()
				.setError('score-load', error instanceof Error ? error.message : String(error));
			useUIStore.getState().showToast('error', 'Failed to load score');
			throw error;
		} finally {
			useUIStore.getState().setLoading(false);
		}
	}

	async loadScoreFromFile(arrayBuffer: ArrayBuffer, fileName?: string): Promise<void> {
		if (!this.api) {
			throw new Error('API not initialized');
		}

		useUIStore.getState().setLoading(true, 'Loading score...');
		useRuntimeStore.getState().setScoreLoaded(false);
		useRuntimeStore.getState().clearError();

		try {
			await this.api.load(new Uint8Array(arrayBuffer));
			useConfigStore
				.getState()
				.updateScoreSource({ type: 'file', content: fileName || 'local-file' });
			useUIStore.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to load score:', error);
			useRuntimeStore
				.getState()
				.setError('score-load', error instanceof Error ? error.message : String(error));
			useUIStore.getState().showToast('error', 'Failed to load score');
			throw error;
		} finally {
			useUIStore.getState().setLoading(false);
		}
	}

	async loadScoreFromAlphaTex(tex: string): Promise<void> {
		if (!this.api) {
			throw new Error('API not initialized');
		}

		useUIStore.getState().setLoading(true, 'Loading score...');
		useRuntimeStore.getState().setScoreLoaded(false);
		useRuntimeStore.getState().clearError();

		try {
			this.api.tex(tex);
			useConfigStore.getState().updateScoreSource({ type: 'alphatex', content: tex });
			useUIStore.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to load score:', error);
			useRuntimeStore
				.getState()
				.setError('score-load', error instanceof Error ? error.message : String(error));
			useUIStore.getState().showToast('error', 'Failed to load score');
			throw error;
		} finally {
			useUIStore.getState().setLoading(false);
		}
	}

	// ========== Track Management ==========

	muteTrack(trackIndex: number, mute: boolean): void {
		if (!this.api?.score?.tracks[trackIndex]) return;

		const track = this.api.score.tracks[trackIndex];
		track.playbackInfo.isMute = mute;

		useRuntimeStore.getState().setTrackOverride(String(trackIndex), { muteOverride: mute });
	}

	soloTrack(trackIndex: number, solo: boolean): void {
		if (!this.api?.score?.tracks[trackIndex]) return;

		const track = this.api.score.tracks[trackIndex];
		track.playbackInfo.isSolo = solo;

		useRuntimeStore.getState().setTrackOverride(String(trackIndex), { soloOverride: solo });
	}

	setTrackVolume(trackIndex: number, volume: number): void {
		if (!this.api?.score?.tracks[trackIndex]) return;

		const track = this.api.score.tracks[trackIndex];
		track.playbackInfo.volume = Math.max(0, Math.min(16, volume * 16)); // alphaTab uses 0-16

		useRuntimeStore.getState().setTrackOverride(String(trackIndex), { volumeOverride: volume });
	}
}
