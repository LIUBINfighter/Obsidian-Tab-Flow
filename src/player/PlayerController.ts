/**
 * Player Controller - 播放器控制器（架构中的中台层）
 *
 * 职责：
 * 1. 监听 globalConfig 的变化，自动重建 alphaTab API
 * 2. 监听 alphaTab API 事件，同步到 runtimeStore
 * 3. 提供播放控制命令接口（play, pause, stop, seek）
 * 4. 管理 alphaTab API 生命周期
 *
 * 独立于 React 组件，可被任何视图层使用
 */

import { FontFileFormat } from '@coderline/alphatab';
import type { AlphaTabApi, synth } from '@coderline/alphatab';
import type { StoreCollection } from './store/StoreFactory';
import type { Plugin, TFile } from 'obsidian';
import * as alphaTab from '@coderline/alphatab';
import * as convert from 'color-convert';

type AlphaTabSettingsInput = alphaTab.Settings;
type AlphaTabSettingsJson = Parameters<alphaTab.Settings['fillFromJson']>[0];
type PlayerStateChangedEventArgs = synth.PlayerStateChangedEventArgs;
type PositionChangedEventArgsWithBeatInfo = synth.PositionChangedEventArgs & {
	currentBar?: number;
	currentBeat?: number;
	currentTick?: number;
};
type EventDisposer = () => void;

export interface PlayerControllerResources {
	bravuraUri: string;
	alphaTabWorkerUri: string;
	soundFontUri: string;
}

export class PlayerController {
	private api: AlphaTabApi | null = null;
	private container: HTMLElement | null = null;
	private scrollViewport: HTMLElement | null = null; // 新增：滚动容器引用
	private unsubscribeGlobalConfig: (() => void) | null = null;
	private unsubscribeWorkspaceConfig: (() => void) | null = null;
	private lastConfigHash: string | null = null;
	private plugin: Plugin;
	private resources: PlayerControllerResources;
	private pendingFileLoad: (() => Promise<void>) | null = null;
	private eventDisposers: EventDisposer[] = [];
	private intersectionObserver: IntersectionObserver | null = null; // 容器可见性观察器

	// Store 集合（由 ReactView 注入）
	private stores: StoreCollection;

	// 实例 ID（用于调试多实例问题）
	private static instanceCounter = 0;
	private instanceId: number;

	constructor(plugin: Plugin, resources: PlayerControllerResources, stores: StoreCollection) {
		this.plugin = plugin;
		this.resources = resources;
		this.stores = stores;
		this.instanceId = ++PlayerController.instanceCounter;

		console.log(`[PlayerController #${this.instanceId}] Initialized with stores:`, {
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
		// 资源路径（worker、soundFont、font）在 createAlphaTabSettings 中直接使用
		// 这里只记录日志
		console.log(`[PlayerController #${this.instanceId}] Resources initialized:`, {
			worker: this.resources.alphaTabWorkerUri,
			soundFont: this.resources.soundFontUri,
			font: this.resources.bravuraUri,
		});
	}

	/**
	 * 获取当前的 AlphaTab 配置（合并 global 和 workspace）
	 * 用于判断是否需要重建 API
	 */
	private getCurrentConfigHash(): string {
		const globalConfig = this.stores.globalConfig.getState();

		// 只包含影响 AlphaTab API 的配置
		const relevantConfig = {
			alphaTabSettings: globalConfig.alphaTabSettings,
			playerExtensions: {
				// 只包含影响 API 初始化的扩展
				masterVolume: globalConfig.playerExtensions.masterVolume,
			},
		};

		return JSON.stringify(relevantConfig);
	}

	/**
	 * 初始化 AlphaTab API 并执行懒加载配置
	 * @param container - AlphaTab 渲染目标容器
	 * @param viewport - 滚动视口容器（可选）
	 */
	public async init(container: HTMLElement, viewport?: HTMLElement): Promise<void> {
		if (!container) {
			console.error(
				`[PlayerController #${this.instanceId}] Container not provided to init()`
			);
			this.stores.runtime.getState().setError('api-init', 'Container element not provided');
			return;
		}

		// 保存容器引用
		this.container = container;
		this.scrollViewport = viewport || null;

		try {
			this.rebuildApi();
		} catch (error) {
			console.error(
				`[PlayerController #${this.instanceId}] API initialization failed:`,
				error
			);
			this.stores.runtime
				.getState()
				.setError('api-init', error instanceof Error ? error.message : String(error));
			throw error;
		}
	} /**
	 * 销毁控制器
	 */
	destroy(): void {
		console.log(`[PlayerController #${this.instanceId}] Destroying controller...`);

		// 清理 IntersectionObserver
		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect();
			this.intersectionObserver = null;
			console.log(`[PlayerController #${this.instanceId}] IntersectionObserver cleaned up`);
		}

		// 销毁 AlphaTab API
		this.destroyApi();

		// 取消订阅
		this.unsubscribeGlobalConfig?.();
		this.unsubscribeWorkspaceConfig?.();

		// 清空引用
		this.container = null;
		this.scrollViewport = null;

		console.log(`[PlayerController #${this.instanceId}] Controller destroyed`);
	}

	// ========== Config Subscription ==========

	private subscribeToConfig(): void {
		// 订阅全局配置变化
		this.unsubscribeGlobalConfig = this.stores.globalConfig.subscribe(() => {
			const newConfigHash = this.getCurrentConfigHash();

			// 仅当配置真正改变时重建
			if (this.shouldRebuildApi(newConfigHash)) {
				console.log(
					`[PlayerController #${this.instanceId}] Global config changed, rebuilding API`
				);
				this.rebuildApi();
			}
		});

		// 工作区配置主要用于 scoreSource 等会话状态，不触发 API 重建
		// 如果未来需要，可以在这里添加订阅
	}

	private shouldRebuildApi(newConfigHash: string): boolean {
		if (!this.lastConfigHash) {
			return true;
		}

		return this.lastConfigHash !== newConfigHash;
	}

	// ========== API Lifecycle ==========

	/**
	 * 重建 AlphaTab API
	 * 用于配置变更或手动刷新时重新初始化播放器
	 */
	public async rebuildApi(): Promise<void> {
		if (!this.container) {
			console.warn(`[PlayerController #${this.instanceId}] No container, skipping rebuild`);
			return;
		}

		console.log(`[PlayerController #${this.instanceId}] Rebuilding API...`);
		this.stores.ui.getState().setLoading(true, 'Loading score...');
		this.stores.runtime.getState().setApiReady(false);

		try {
			// 销毁旧 API
			this.destroyApi();

			// 创建 alphaTab Settings
			const settings = this.createAlphaTabSettings();

			// 创建新 API（直接使用静态导入的 alphaTab 模块）
			console.log(`[PlayerController #${this.instanceId}] Creating AlphaTabApi instance...`);
			this.api = new alphaTab.AlphaTabApi(this.container, settings);

			// 绑定事件
			this.bindApiEvents();

			// 保存到 runtimeStore
			this.stores.runtime.getState().setApi(this.api);

			// 更新最后配置哈希
			this.lastConfigHash = this.getCurrentConfigHash();

			console.log(`[PlayerController #${this.instanceId}] API rebuilt successfully`);

			// API 准备好后，检查是否有待加载的文件
			if (this.pendingFileLoad) {
				await this.pendingFileLoad();
				this.pendingFileLoad = null;
			} else {
				// 如果有之前加载的乐谱，重新加载
				const lastScore = this.stores.runtime.getState().lastLoadedScore;
				if (lastScore.type && lastScore.data) {
					console.log(
						`[PlayerController #${this.instanceId}] Reloading last score after rebuild...`
					);
					try {
						if (lastScore.type === 'alphatex') {
							this.api.tex(lastScore.data as string);
						} else if (lastScore.type === 'binary') {
							await this.api.load(lastScore.data as Uint8Array);
						}
						console.log(
							`[PlayerController #${this.instanceId}] Last score reloaded successfully`
						);
					} catch (error) {
						console.error(
							`[PlayerController #${this.instanceId}] Failed to reload last score:`,
							error
						);
						this.stores.ui
							.getState()
							.showToast('error', 'Failed to reload score after rebuild');
					}
				}
			}
		} catch (error) {
			console.error(`[PlayerController #${this.instanceId}] Failed to rebuild API:`, error);
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

	private createAlphaTabSettings(): AlphaTabSettingsInput {
		const globalConfig = this.stores.globalConfig.getState();

		// 获取当前容器的计算样式用于颜色配置
		const style = this.container ? window.getComputedStyle(this.container) : null;

		// 确定滚动元素（按照 AlphaTab 官方推荐）
		// 优先级：显式提供的 scrollViewport > 从 container 向上查找 > 默认值
		let scrollElement: HTMLElement | string = 'html,body';

		if (this.scrollViewport) {
			// 1. 使用显式提供的滚动视口
			scrollElement = this.scrollViewport;
			console.log(`[PlayerController #${this.instanceId}] Using provided scrollViewport`);
		} else if (this.container) {
			// 2. 从 container 向上查找第一个可滚动的父元素
			let parent = this.container.parentElement;
			while (parent && parent !== document.body) {
				const overflowY = window.getComputedStyle(parent).overflowY;
				if (overflowY === 'auto' || overflowY === 'scroll') {
					scrollElement = parent;
					console.log(
						`[PlayerController #${this.instanceId}] Found scrollable parent:`,
						parent.className
					);
					break;
				}
				parent = parent.parentElement;
			}

			// 3. 如果没找到，尝试使用 Obsidian 的工作区容器
			if (scrollElement === 'html,body') {
				const workspaceLeaf = this.container.closest('.workspace-leaf-content');
				if (workspaceLeaf) {
					scrollElement = workspaceLeaf as HTMLElement;
					console.log(
						`[PlayerController #${this.instanceId}] Using workspace-leaf-content`
					);
				}
			}
		}

		const settingsJson: AlphaTabSettingsJson = {
			core: {
				file: null, // 总是 null，通过 API 方法加载
				engine: globalConfig.alphaTabSettings.core.engine || 'svg',
				useWorkers: globalConfig.alphaTabSettings.core.useWorkers,
				logLevel: globalConfig.alphaTabSettings.core.logLevel,
				includeNoteBounds: globalConfig.alphaTabSettings.core.includeNoteBounds,
				scriptFile: this.resources.alphaTabWorkerUri,
				fontDirectory: '', // 必须设置为空字符串，使用 smuflFontSources
			},
			player: {
				enablePlayer: globalConfig.alphaTabSettings.player.enablePlayer,
				playerMode: alphaTab.PlayerMode.EnabledAutomatic,
				scrollSpeed: globalConfig.alphaTabSettings.player.scrollSpeed,
				scrollMode: globalConfig.alphaTabSettings.player.scrollMode,
				scrollOffsetX: globalConfig.alphaTabSettings.player.scrollOffsetX,
				scrollOffsetY: globalConfig.alphaTabSettings.player.scrollOffsetY,
				enableCursor: globalConfig.alphaTabSettings.player.enableCursor,
				enableAnimatedBeatCursor:
					globalConfig.alphaTabSettings.player.enableAnimatedBeatCursor,
				soundFont: this.resources.soundFontUri,
				scrollElement: scrollElement, // 使用确定的滚动元素
				nativeBrowserSmoothScroll: false,
			},
			display: {
				scale: globalConfig.alphaTabSettings.display.scale,
				startBar: 1, // 总是从第一小节开始
				layoutMode: globalConfig.alphaTabSettings.display.layoutMode,
				barsPerRow: globalConfig.alphaTabSettings.display.barsPerRow,
				stretchForce: globalConfig.alphaTabSettings.display.stretchForce,
			},
		};

		const displaySettings = settingsJson.display!;
		const playerSettings = settingsJson.player!;
		const coreSettings = settingsJson.core!;

		// 调试：输出布局和滚动相关配置
		console.log(`[PlayerController #${this.instanceId}] AlphaTab settings configured:`, {
			layout: {
				layoutMode: displaySettings.layoutMode,
				barsPerRow: displaySettings.barsPerRow,
				stretchForce: displaySettings.stretchForce,
				scale: displaySettings.scale,
				containerWidth: this.container?.getBoundingClientRect().width,
			},
			scroll: {
				scrollElement:
					typeof scrollElement === 'string' ? scrollElement : scrollElement.className,
				scrollMode: playerSettings.scrollMode,
				scrollSpeed: playerSettings.scrollSpeed,
				scrollOffsetX: playerSettings.scrollOffsetX,
				scrollOffsetY: playerSettings.scrollOffsetY,
			},
		});

		// 配置字体源 - 使用正确的字体格式枚举
		// AlphaTab 的 FontFileFormat 枚举值：Woff2 = 0, Woff = 1, Ttf = 2
		if (this.resources.bravuraUri) {
			// 使用 AlphaTab 内部的枚举值（向后兼容）
			coreSettings.smuflFontSources = new Map<
				| FontFileFormat
				| keyof typeof FontFileFormat
				| Lowercase<keyof typeof FontFileFormat>,
				string
			>([[FontFileFormat.Woff2, this.resources.bravuraUri]]);
			console.log(
				`[PlayerController #${this.instanceId}] Font configured:`,
				this.resources.bravuraUri
			);
		}

		// 添加颜色配置（防御性编程：确保所有颜色值都有效）
		if (style) {
			// 安全地读取 CSS 变量，确保 parseFloat 得到有效数字
			const accentH = parseFloat(style.getPropertyValue('--accent-h')) || 0;
			const accentS = parseFloat(style.getPropertyValue('--accent-s')) || 50;
			const accentL = parseFloat(style.getPropertyValue('--accent-l')) || 50;

			// 验证 HSL 值的有效性
			const isValidHSL =
				!isNaN(accentH) &&
				!isNaN(accentS) &&
				!isNaN(accentL) &&
				accentH >= 0 &&
				accentH <= 360 &&
				accentS >= 0 &&
				accentS <= 100 &&
				accentL >= 0 &&
				accentL <= 100;

			let barNumberColor = '#000';
			if (isValidHSL) {
				try {
					barNumberColor = '#' + convert.hsl.hex([accentH, accentS, accentL]);
				} catch (error) {
					console.warn(
						`[PlayerController #${this.instanceId}] Failed to convert HSL to hex, using default:`,
						error
					);
					barNumberColor = '#000';
				}
			} else {
				console.warn(`[PlayerController #${this.instanceId}] Invalid HSL values:`, {
					accentH,
					accentS,
					accentL,
				});
			}

			displaySettings.resources = {
				mainGlyphColor: style.getPropertyValue('--color-base-100') || '#000',
				secondaryGlyphColor: style.getPropertyValue('--color-base-60') || '#666',
				staffLineColor: style.getPropertyValue('--color-base-40') || '#ccc',
				barSeparatorColor: style.getPropertyValue('--color-base-40') || '#ccc',
				barNumberColor: barNumberColor,
				scoreInfoColor: style.getPropertyValue('--color-base-100') || '#000',
			};

			console.log(
				`[PlayerController #${this.instanceId}] Color resources configured:`,
				displaySettings.resources
			);
		} else {
			// 如果无法获取样式（容器未完全挂载），提供完整的硬编码安全默认值
			console.warn(
				`[PlayerController #${this.instanceId}] Container style not available, using fallback colors`
			);
			displaySettings.resources = {
				mainGlyphColor: '#000',
				secondaryGlyphColor: '#666',
				staffLineColor: '#ccc',
				barSeparatorColor: '#ccc',
				barNumberColor: '#000',
				scoreInfoColor: '#000',
			};
		}

		const settings = new alphaTab.Settings();
		settings.fillFromJson(settingsJson);
		return settings;
	}

	/**
	 * 配置滚动容器（在乐谱加载后调用，用于验证和动态更新）
	 *
	 * 注意：scrollElement 已在 createAlphaTabSettings 中初始化，
	 * 这个方法主要用于运行时验证和调试
	 */
	private configureScrollElement(): void {
		if (!this.api || !this.container) {
			console.warn('[PlayerController] Cannot configure scroll: API or container not ready');
			return;
		}

		const currentScrollElement = this.api.settings.player.scrollElement;

		// 验证滚动元素配置
		if (typeof currentScrollElement === 'string') {
			console.log('[PlayerController] Scroll element is CSS selector:', currentScrollElement);
		} else {
			const scrollInfo = {
				element: currentScrollElement.tagName,
				className: currentScrollElement.className,
				scrollHeight: currentScrollElement.scrollHeight,
				clientHeight: currentScrollElement.clientHeight,
				canScroll: currentScrollElement.scrollHeight > currentScrollElement.clientHeight,
				overflowY: window.getComputedStyle(currentScrollElement).overflowY,
			};
			console.log('[PlayerController] Scroll element configured:', scrollInfo);

			// 警告：如果容器不可滚动
			if (
				!scrollInfo.canScroll &&
				scrollInfo.overflowY !== 'auto' &&
				scrollInfo.overflowY !== 'scroll'
			) {
				console.warn(
					'[PlayerController] Warning: Scroll element may not be scrollable!',
					scrollInfo
				);
			}
		}

		// 延迟应用滚动模式和光标设置，确保 DOM 完全就绪
		setTimeout(() => {
			if (this.api?.settings.player) {
				const globalConfig = this.stores.globalConfig.getState();
				this.api.settings.player.scrollMode =
					globalConfig.alphaTabSettings.player.scrollMode;
				this.api.settings.player.enableCursor =
					globalConfig.alphaTabSettings.player.enableCursor;
				this.api.updateSettings();
				console.log('[PlayerController] Scroll mode applied:', {
					scrollMode: globalConfig.alphaTabSettings.player.scrollMode,
					enableCursor: globalConfig.alphaTabSettings.player.enableCursor,
				});
			}
		}, 100);
	}

	// ========== API Events ==========

	/**
	 * 解绑所有 API 事件
	 */
	private unbindApiEvents(): void {
		if (!this.api || this.eventDisposers.length === 0) {
			return;
		}

		try {
			this.eventDisposers.forEach((dispose) => {
				try {
					dispose();
				} catch (error) {
					console.warn('[PlayerController] Failed to unbind event handler:', error);
				}
			});

			this.eventDisposers = [];
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
			const scoreLoadedHandler = (score: alphaTab.model.Score) => {
				this.stores.runtime.getState().setScoreLoaded(true);
				this.stores.runtime.getState().setRenderState('idle');

				// ✅ 恢复音轨配置
				this.restoreTrackConfigs(score);

				// ✅ 设置吉他音轨的默认显示选项（仅六线谱）
				this.applyDefaultStaffDisplay(score);

				// 注意：总时长从 playerPositionChanged 的 e.endTime 获取，
				// 那才是考虑了速度等因素的实际播放时长

				// 延迟配置滚动容器，确保 DOM 就绪（参考 TabView）
				setTimeout(() => {
					this.configureScrollElement();
				}, 100);
			};
			this.eventDisposers.push(this.api.scoreLoaded.on(scoreLoadedHandler));
			const renderStartedHandler = () => {
				this.stores.runtime.getState().setRenderState('rendering');
			};
			this.eventDisposers.push(this.api.renderStarted.on(renderStartedHandler));

			// Render Finished
			const renderFinishedHandler = () => {
				this.stores.runtime.getState().setRenderState('finished');
			};
			this.eventDisposers.push(this.api.renderFinished.on(renderFinishedHandler));

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
			this.eventDisposers.push(this.api.playerReady.on(playerReadyHandler));

			// Player State Changed
			const playerStateChangedHandler = (event: PlayerStateChangedEventArgs) => {
				const stateMap: Record<number, 'idle' | 'playing' | 'paused' | 'stopped'> = {
					0: 'paused',
					1: 'playing',
					2: 'stopped',
				};
				this.stores.runtime.getState().setPlaybackState(stateMap[event.state] || 'idle');
			};
			this.eventDisposers.push(this.api.playerStateChanged.on(playerStateChangedHandler));

			// Player Position Changed
			const playerPositionChangedHandler = (event: PositionChangedEventArgsWithBeatInfo) => {
				this.stores.runtime.getState().setPosition(event.currentTime);
				// 重要：使用 e.endTime 作为总时长，这是考虑了速度等因素的实际播放时长
				if (event.endTime !== undefined) {
					this.stores.runtime.getState().setDuration(event.endTime);
				}
				this.stores.runtime.getState().setCurrentBeat({
					bar: event.currentBar ?? 0,
					beat: event.currentBeat ?? 0,
					tick: event.currentTick ?? 0,
				});
			};
			this.eventDisposers.push(
				this.api.playerPositionChanged.on(playerPositionChangedHandler)
			);
			const errorHandler = (error: Error) => {
				console.error('[PlayerController] alphaTab error:', error);
				this.stores.runtime.getState().setError('api-init', error.message ?? String(error));
				this.stores.ui.getState().showToast('error', 'An error occurred in the player');
			};
			this.eventDisposers.push(this.api.error.on(errorHandler));
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

	/**
	 * 跳转到指定播放位置
	 * @param positionMs - 目标位置（毫秒）
	 *
	 * 修复说明：
	 * - 之前错误使用 tickPosition（MIDI tick 单位）
	 * - 现在正确使用 timePosition（毫秒单位）
	 * - 参考 AlphaTab 官方文档：https://www.alphatab.net/docs/reference/api/timeposition
	 */
	seek(positionMs: number): void {
		if (!this.api) return;

		// ✅ 修复：使用 timePosition（毫秒）而非 tickPosition
		this.api.timePosition = positionMs;

		// 调试日志（开发时可取消注释）
		// console.log('[PlayerController] Seek to:', {
		// 	positionMs,
		// 	positionSec: (positionMs / 1000).toFixed(2) + 's',
		// });
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

	/**
	 * 调试方法：打印滚动配置信息
	 */
	debugScrollConfig(): void {
		if (!this.api) {
			console.warn('[PlayerController] API not initialized');
			return;
		}

		const scrollElement = this.api.settings.player.scrollElement;
		const scrollElementInfo =
			typeof scrollElement === 'string'
				? scrollElement
				: {
						tagName: scrollElement.tagName,
						className: scrollElement.className,
						scrollHeight: scrollElement.scrollHeight,
						clientHeight: scrollElement.clientHeight,
						scrollTop: scrollElement.scrollTop,
						canScroll: scrollElement.scrollHeight > scrollElement.clientHeight,
						computedOverflow: window.getComputedStyle(scrollElement).overflow,
					};

		console.log('[PlayerController] Scroll Configuration Debug:', {
			scrollElement: scrollElementInfo,
			scrollMode: this.api.settings.player.scrollMode,
			scrollSpeed: this.api.settings.player.scrollSpeed,
			scrollOffsetX: this.api.settings.player.scrollOffsetX,
			scrollOffsetY: this.api.settings.player.scrollOffsetY,
			enableCursor: this.api.settings.player.enableCursor,
			nativeBrowserSmoothScroll: this.api.settings.player.nativeBrowserSmoothScroll,
		});
	}

	/**
	 * ✅ 设置吉他音轨的默认显示选项
	 * 在曲谱加载后调用，为吉他类乐器设置默认显示为仅六线谱
	 */
	private applyDefaultStaffDisplay(score: alphaTab.model.Score): void {
		console.log(
			`[PlayerController #${this.instanceId}] Applying default staff display for guitar tracks`
		);

		for (const track of score.tracks) {
			// 检查是否为弦乐器（吉他、贝斯等）
			// AlphaTab 中 track.playbackInfo.program 表示 MIDI 乐器编号
			// 24-31: 吉他类乐器
			// 32-39: 贝斯类乐器
			const program = track.playbackInfo.program;
			const isGuitarFamily =
				(program >= 24 && program <= 31) || (program >= 32 && program <= 39);

			if (isGuitarFamily) {
				// 为每个 Staff 设置默认显示选项
				for (const staff of track.staves) {
					// 默认：仅显示六线谱
					staff.showStandardNotation = false;
					staff.showTablature = true;
					staff.showSlash = false;
					staff.showNumbered = false;

					console.log(
						`[PlayerController #${this.instanceId}] Set guitar track ${track.index} staff ${staff.index} to tab-only`
					);
				}
			}
		}
	}

	/**
	 * ✅ 恢复音轨配置
	 * 在曲谱加载后调用，从 workspace 配置中恢复用户之前保存的音轨设置
	 */
	private restoreTrackConfigs(score: alphaTab.model.Score): void {
		const workspaceConfig = this.stores.workspaceConfig.getState();
		const savedConfigs = workspaceConfig.sessionPlayerState.trackConfigs || [];

		if (savedConfigs.length === 0) {
			console.log(`[PlayerController #${this.instanceId}] No saved track configs to restore`);
			return;
		}

		console.log(
			`[PlayerController #${this.instanceId}] Restoring track configs:`,
			savedConfigs
		);

		for (const config of savedConfigs) {
			const track = score.tracks.find((t) => t.index === config.trackIndex);
			if (!track) {
				console.warn(
					`[PlayerController #${this.instanceId}] Track ${config.trackIndex} not found in score`
				);
				continue;
			}

			// 恢复 mute 状态
			if (config.isMute !== undefined) {
				track.playbackInfo.isMute = config.isMute;
				this.api?.changeTrackMute([track], config.isMute);
			}

			// 恢复 solo 状态
			if (config.isSolo !== undefined) {
				track.playbackInfo.isSolo = config.isSolo;
				this.api?.changeTrackSolo([track], config.isSolo);
			}

			// 恢复音量
			if (config.volume !== undefined && track.playbackInfo.volume > 0) {
				const volumeRatio = config.volume / track.playbackInfo.volume;
				this.api?.changeTrackVolume([track], volumeRatio);
			}

			// 恢复音频移调
			if (config.transposeAudio !== undefined) {
				this.api?.changeTrackTranspositionPitch([track], config.transposeAudio);
			}

			// 恢复完全移调
			if (config.transposeFull !== undefined && this.api) {
				const pitches = this.api.settings.notation.transpositionPitches;
				while (pitches.length < track.index + 1) {
					pitches.push(0);
				}
				pitches[track.index] = config.transposeFull;
			}
		}

		// 应用移调设置
		if (this.api && savedConfigs.some((c) => c.transposeFull !== undefined)) {
			this.api.updateSettings();
			console.log(
				`[PlayerController #${this.instanceId}] Applied transposition settings, triggering re-render`
			);
			// 注意：这里不需要调用 render()，因为 scoreLoaded 之后会自动渲染
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

		console.log(`[PlayerController #${this.instanceId}] Loading score from URL:`, url);
		this.stores.ui.getState().setLoading(true, 'Loading score...');
		this.stores.runtime.getState().setScoreLoaded(false);
		this.stores.runtime.getState().clearError();

		try {
			await this.api.load(url);
			this.stores.workspaceConfig.getState().setScoreSource({ type: 'url', content: url });
			this.stores.ui.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error(`[PlayerController #${this.instanceId}] Failed to load score:`, error);
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
			const uint8Array = new Uint8Array(arrayBuffer);
			await this.api.load(uint8Array);

			// 保存乐谱数据用于 API 重建后重新加载
			this.stores.runtime.getState().setLastLoadedScore('binary', uint8Array, fileName);

			this.stores.workspaceConfig
				.getState()
				.setScoreSource({ type: 'file', content: fileName || 'local-file' });
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

			// 保存乐谱数据用于 API 重建后重新加载
			this.stores.runtime.getState().setLastLoadedScore('alphatex', tex);

			this.stores.workspaceConfig
				.getState()
				.setScoreSource({ type: 'alphatex', content: tex });
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
	 * 获取全局配置存储实例（用于 React 组件）
	 */
	getGlobalConfigStore() {
		return this.stores.globalConfig;
	}

	/**
	 * 获取工作区配置存储实例（用于 React 组件）
	 */
	getWorkspaceConfigStore() {
		return this.stores.workspaceConfig;
	}

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

	/**
	 * 获取 Obsidian App 实例
	 */
	getApp() {
		return this.plugin.app;
	}
}
