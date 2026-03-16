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
import { disableUnsafeNumberedNotation, sanitizeTrackConfig } from './utils/scoreSafety';
import { Platform, type Plugin, type TFile } from 'obsidian';
import * as alphaTab from '@coderline/alphatab';
import { applyStaveProfileToScore, toFiniteClampedNumber, toFiniteNumber } from '../utils';

type AlphaTabSettingsInput = alphaTab.Settings;
type AlphaTabSettingsJson = Parameters<alphaTab.Settings['fillFromJson']>[0];
type PlayerStateChangedEventArgs = synth.PlayerStateChangedEventArgs;
type PositionChangedEventArgsWithBeatInfo = synth.PositionChangedEventArgs & {
	currentBar?: number;
	currentBeat?: number;
	currentTick?: number;
};
type EventDisposer = () => void;

function hslToHex(h: number, s: number, l: number): string {
	const hue = ((h % 360) + 360) % 360;
	const sat = Math.max(0, Math.min(100, s)) / 100;
	const lig = Math.max(0, Math.min(100, l)) / 100;
	const chroma = (1 - Math.abs(2 * lig - 1)) * sat;
	const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = lig - chroma / 2;

	let r = 0;
	let g = 0;
	let b = 0;

	if (hue < 60) {
		r = chroma;
		g = x;
	} else if (hue < 120) {
		r = x;
		g = chroma;
	} else if (hue < 180) {
		g = chroma;
		b = x;
	} else if (hue < 240) {
		g = x;
		b = chroma;
	} else if (hue < 300) {
		r = x;
		b = chroma;
	} else {
		r = chroma;
		b = x;
	}

	const toHex = (value: number): string => {
		const channel = Math.round((value + m) * 255);
		const clamped = Math.max(0, Math.min(255, channel));
		return clamped.toString(16).padStart(2, '0');
	};

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export interface PlayerControllerResources {
	bravuraUri: string;
	alphaTabWorkerUri: string;
	soundFontUri: string;
}

export class PlayerController {
	private api: AlphaTabApi | null = null;
	private container: HTMLElement | null = null;
	private scrollViewport: HTMLElement | null = null; // 新增：滚动容器引用
	private awaitingStableRender = false;
	private stabilizationRenderRequested = false;
	private stabilizationRenderInFlight = false;
	private stableRenderDebugStart = 0;
	private stableRenderTimeoutId: number | null = null;
	private stableRenderTimedOut = false;
	private retryLoadAfterStableWait = false;
	private unsubscribeGlobalConfig: (() => void) | null = null;
	private unsubscribeWorkspaceConfig: (() => void) | null = null;
	private lastConfigHash: string | null = null;
	private rebuildInFlight: Promise<void> | null = null;
	private rebuildQueued = false;
	private apiContainer: HTMLElement | null = null;
	private apiLoadHandled = false;
	private destroyed = false;
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

		console.debug(`[PlayerController #${this.instanceId}] Initialized with stores:`, {
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
		console.debug(`[PlayerController #${this.instanceId}] Resources initialized:`, {
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
	public init(container: HTMLElement, viewport?: HTMLElement): void {
		this.destroyed = false;
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

		const rect = container.getBoundingClientRect();
		if (!Number.isFinite(rect.width) || rect.width <= 0 || !Number.isFinite(rect.height)) {
			console.warn(
				`[PlayerController #${this.instanceId}] Init called with unstable container layout`,
				{ width: rect.width, height: rect.height }
			);
		}

		void this.rebuildApi();
	} /**
	 * 销毁控制器
	 */
	destroy(): void {
		console.debug(`[PlayerController #${this.instanceId}] Destroying controller...`);
		this.destroyed = true;
		this.rebuildQueued = false;
		this.pendingFileLoad = null;
		this.apiLoadHandled = false;
		this.retryLoadAfterStableWait = false;

		// 清理 IntersectionObserver
		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect();
			this.intersectionObserver = null;
			console.debug(`[PlayerController #${this.instanceId}] IntersectionObserver cleaned up`);
		}

		// 销毁 AlphaTab API
		this.destroyApi();

		// 取消订阅
		this.unsubscribeGlobalConfig?.();
		this.unsubscribeWorkspaceConfig?.();

		// 清空引用
		this.container = null;
		this.scrollViewport = null;

		console.debug(`[PlayerController #${this.instanceId}] Controller destroyed`);
	}

	// ========== Config Subscription ==========

	private subscribeToConfig(): void {
		// 订阅全局配置变化
		this.unsubscribeGlobalConfig = this.stores.globalConfig.subscribe(() => {
			const newConfigHash = this.getCurrentConfigHash();

			// 仅当配置真正改变时重建
			if (this.shouldRebuildApi(newConfigHash)) {
				console.debug(
					`[PlayerController #${this.instanceId}] Global config changed, rebuilding API`
				);
				void this.rebuildApi();
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
		if (this.destroyed) {
			return;
		}

		if (this.rebuildInFlight) {
			this.rebuildQueued = true;
			console.debug(
				`[PlayerController #${this.instanceId}] Rebuild already in progress, waiting...`
			);
			await this.rebuildInFlight;
			return;
		}

		do {
			this.rebuildQueued = false;
			this.rebuildInFlight = new Promise<void>((resolve) => {
				if (this.destroyed || !this.container) {
					console.warn(
						`[PlayerController #${this.instanceId}] No container, skipping rebuild`
					);
					resolve();
					return;
				}

				console.debug(`[PlayerController #${this.instanceId}] Rebuilding API...`);
				this.stores.ui.getState().setLoading(true, 'Loading score...');
				this.stores.runtime.getState().setApiReady(false);
				this.stores.runtime.getState().setScoreLoaded(false);

				try {
					this.destroyApi();
					if (this.destroyed) {
						return;
					}
					const apiHost = this.createApiHost();
					if (!apiHost) {
						throw new Error('API host container not available');
					}
					const settings = this.createAlphaTabSettings();
					if (this.destroyed) {
						return;
					}

					console.debug(
						`[PlayerController #${this.instanceId}] Creating AlphaTabApi instance...`
					);
					this.api = new alphaTab.AlphaTabApi(apiHost, settings);
					this.apiContainer = apiHost;

					this.bindApiEvents();
					this.stores.runtime.getState().setApi(this.api);
					this.lastConfigHash = this.getCurrentConfigHash();
					this.apiLoadHandled = false;

					console.debug(
						`[PlayerController #${this.instanceId}] API rebuilt successfully`
					);
					this.tryLoadScoreAfterApiReady({ allowLastScoreReload: false });
				} catch (error) {
					console.error(
						`[PlayerController #${this.instanceId}] Failed to rebuild API:`,
						error
					);
					this.stores.runtime
						.getState()
						.setError(
							'api-init',
							error instanceof Error ? error.message : String(error)
						);
					this.stores.ui.getState().showToast('error', 'Failed to initialize player');
				} finally {
					if (!this.awaitingStableRender) {
						this.stores.ui.getState().setLoading(false);
					}
					resolve();
				}
			});

			try {
				await this.rebuildInFlight;
			} finally {
				this.rebuildInFlight = null;
			}
		} while (this.rebuildQueued);
	}

	private tryLoadScoreAfterApiReady(options?: { allowLastScoreReload?: boolean }): void {
		if (this.destroyed) {
			return;
		}

		if (this.apiLoadHandled) {
			return;
		}

		const pendingLoad = this.pendingFileLoad;
		if (pendingLoad) {
			this.apiLoadHandled = true;
			this.pendingFileLoad = null;
			void pendingLoad().catch((error) => {
				if (this.destroyed) {
					return;
				}

				const apiReady = this.stores.runtime.getState().apiReady;
				if (!apiReady) {
					this.pendingFileLoad = pendingLoad;
					this.apiLoadHandled = false;
					console.warn(
						`[PlayerController #${this.instanceId}] Pending load failed before player ready, will retry on playerReady`,
						error
					);
					return;
				}

				console.error(
					`[PlayerController #${this.instanceId}] Pending file load failed:`,
					error
				);
				this.stores.runtime
					.getState()
					.setError('score-load', error instanceof Error ? error.message : String(error));
				this.stores.ui
					.getState()
					.showToast('error', 'Failed to load score after player ready');
			});
			return;
		}

		if (options?.allowLastScoreReload === false) {
			return;
		}

		const lastScore = this.stores.runtime.getState().lastLoadedScore;
		if (lastScore.type && lastScore.data && this.api) {
			this.apiLoadHandled = true;
			console.debug(
				`[PlayerController #${this.instanceId}] Reloading last score after player ready...`
			);
			try {
				if (lastScore.type === 'alphatex') {
					this.api.tex(lastScore.data as string);
				} else if (lastScore.type === 'binary') {
					this.api.load(lastScore.data as Uint8Array);
				}
				console.debug(
					`[PlayerController #${this.instanceId}] Last score reloaded successfully`
				);
			} catch (error) {
				console.error(
					`[PlayerController #${this.instanceId}] Failed to reload last score on player ready:`,
					error
				);
				this.stores.ui
					.getState()
					.showToast('error', 'Failed to reload score after player ready');
			}
		}
	}

	private createApiHost(): HTMLElement | null {
		if (!this.container) {
			return null;
		}

		const host = this.container.ownerDocument.createElement('div');
		host.className = 'alphatab-runtime-host';
		this.container.replaceChildren(host);
		return host;
	}

	private beginStableRenderWait(message: string): void {
		this.awaitingStableRender = true;
		this.stabilizationRenderRequested = false;
		this.stabilizationRenderInFlight = false;
		this.stableRenderTimedOut = false;
		if (this.stableRenderTimeoutId !== null) {
			window.clearTimeout(this.stableRenderTimeoutId);
		}
		this.stableRenderTimeoutId = window.setTimeout(() => {
			this.stableRenderTimedOut = true;
			console.warn(`[PlayerController #${this.instanceId}] Stable render wait timed out`, {
				containerRect: this.container?.getBoundingClientRect(),
				viewportRect: this.scrollViewport?.getBoundingClientRect(),
			});
			this.endStableRenderWait();
		}, 3000);
		this.stableRenderDebugStart = performance.now();
		console.debug(`[PlayerController #${this.instanceId}] Begin stable render wait`, {
			message,
			containerRect: this.container?.getBoundingClientRect(),
			viewportRect: this.scrollViewport?.getBoundingClientRect(),
		});
		this.stores.ui.getState().setLoading(true, message);
	}

	private endStableRenderWait(): void {
		if (!this.awaitingStableRender) {
			return;
		}

		const timedOut = this.stableRenderTimedOut;
		const retryAfterStableWait = this.retryLoadAfterStableWait;
		this.stableRenderTimedOut = false;
		this.retryLoadAfterStableWait = false;

		this.awaitingStableRender = false;
		this.stabilizationRenderRequested = false;
		this.stabilizationRenderInFlight = false;
		if (this.stableRenderTimeoutId !== null) {
			window.clearTimeout(this.stableRenderTimeoutId);
			this.stableRenderTimeoutId = null;
		}
		console.debug(`[PlayerController #${this.instanceId}] End stable render wait`, {
			elapsedMs: Math.round(performance.now() - this.stableRenderDebugStart),
			containerRect: this.container?.getBoundingClientRect(),
			viewportRect: this.scrollViewport?.getBoundingClientRect(),
		});
		this.stores.ui.getState().setLoading(false);

		const scoreLoaded = this.stores.runtime.getState().scoreLoaded;
		if ((timedOut || retryAfterStableWait) && !scoreLoaded && !this.destroyed) {
			this.apiLoadHandled = false;
			this.tryLoadScoreAfterApiReady();
		}
	}

	private shouldUseObsidianSafeInitialRender(configuredEngine?: string): boolean {
		const engine =
			configuredEngine ?? this.stores.globalConfig.getState().alphaTabSettings.core.engine;
		return (
			!Platform.isMobile && engine === 'svg' && !this.stores.runtime.getState().scoreLoaded
		);
	}

	private getEffectiveRenderMode(): { engine: string; useWorkers: boolean } {
		const globalConfig = this.stores.globalConfig.getState();
		const configuredEngine = globalConfig.alphaTabSettings.core.engine || 'svg';
		const configuredWorkers = globalConfig.alphaTabSettings.core.useWorkers;
		const initialSafeMode = this.shouldUseObsidianSafeInitialRender(configuredEngine);

		if (initialSafeMode) {
			return { engine: configuredEngine, useWorkers: false };
		}

		return { engine: configuredEngine, useWorkers: configuredWorkers };
	}

	private async waitForFontAndLayoutStability(target: HTMLElement): Promise<void> {
		if (this.destroyed) {
			return;
		}

		const fonts = Reflect.get(document, 'fonts') as FontFaceSet | undefined;
		const fontApiAvailable = Boolean(fonts && typeof fonts.ready?.then === 'function');
		console.debug(`[PlayerController #${this.instanceId}] Waiting for font/layout stability`, {
			fontApiAvailable,
			initialRect: target.getBoundingClientRect(),
		});
		if (fonts && typeof fonts.ready?.then === 'function') {
			await Promise.race([
				fonts.ready.catch(() => undefined),
				new Promise((resolve) => window.setTimeout(resolve, 1200)),
			]);
		}

		if (this.destroyed) {
			return;
		}

		let stableFrames = 0;
		let lastWidth = -1;
		let lastHeight = -1;
		let lastLeft = Number.NaN;
		let lastTop = Number.NaN;

		while (stableFrames < 3 && !this.destroyed) {
			await new Promise<void>((resolve) => {
				window.requestAnimationFrame(() => resolve());
			});

			if (this.destroyed) {
				return;
			}

			const rect = target.getBoundingClientRect();
			const widthStable = Math.abs(rect.width - lastWidth) < 0.5;
			const heightStable = Math.abs(rect.height - lastHeight) < 0.5;
			const leftStable = Math.abs(rect.left - lastLeft) < 0.5;
			const topStable = Math.abs(rect.top - lastTop) < 0.5;

			if (widthStable && heightStable && leftStable && topStable) {
				stableFrames += 1;
			} else {
				stableFrames = 0;
			}

			lastWidth = rect.width;
			lastHeight = rect.height;
			lastLeft = rect.left;
			lastTop = rect.top;
		}

		console.debug(`[PlayerController #${this.instanceId}] Font/layout stability reached`, {
			stableFrames,
			finalRect: target.getBoundingClientRect(),
		});
	}

	private requestStabilizedRender(): void {
		if (
			this.destroyed ||
			!this.awaitingStableRender ||
			this.stabilizationRenderRequested ||
			this.stabilizationRenderInFlight ||
			!this.api ||
			!this.container
		) {
			return;
		}

		this.stabilizationRenderRequested = true;
		this.stabilizationRenderInFlight = true;

		void this.waitForFontAndLayoutStability(this.container)
			.then(() => {
				if (this.destroyed || !this.api || !this.container) {
					return;
				}

				console.debug('[PlayerController] Triggering stabilized follow-up render');
				this.api.render();
			})
			.catch((error) => {
				console.warn('[PlayerController] Stabilized render wait failed:', error);
				this.endStableRenderWait();
			})
			.finally(() => {
				this.stabilizationRenderInFlight = false;
			});
	}

	private destroyApi(): void {
		const targetContainer = this.apiContainer ?? this.container;
		if (this.api) {
			try {
				this.unbindApiEvents();
				this.api.destroy();
			} catch (error) {
				console.warn('[PlayerController] Error destroying API:', error);
			}
			this.api = null;
		}

		if (targetContainer) {
			targetContainer.replaceChildren();
		}

		this.apiContainer = null;
		this.apiLoadHandled = false;
		this.stores.runtime.getState().setApi(null);
		this.stores.runtime.getState().setApiReady(false);
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
			console.debug(`[PlayerController #${this.instanceId}] Using provided scrollViewport`);
		} else if (this.container) {
			// 2. 从 container 向上查找第一个可滚动的父元素
			let parent = this.container.parentElement;
			while (parent && parent !== document.body) {
				const overflowY = window.getComputedStyle(parent).overflowY;
				if (overflowY === 'auto' || overflowY === 'scroll') {
					scrollElement = parent;
					console.debug(
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
					console.debug(
						`[PlayerController #${this.instanceId}] Using workspace-leaf-content`
					);
				}
			}
		}

		const effectiveRenderMode = this.getEffectiveRenderMode();
		const initialSafeMode = this.shouldUseObsidianSafeInitialRender();
		const settingsJson: AlphaTabSettingsJson = {
			core: {
				file: null, // 总是 null，通过 API 方法加载
				engine: effectiveRenderMode.engine,
				useWorkers: effectiveRenderMode.useWorkers,
				enableLazyLoading: !initialSafeMode,
				logLevel: globalConfig.alphaTabSettings.core.logLevel,
				includeNoteBounds: globalConfig.alphaTabSettings.core.includeNoteBounds,
				scriptFile: this.resources.alphaTabWorkerUri,
				fontDirectory: '', // 必须设置为空字符串，使用 smuflFontSources
			},
			player: {
				enablePlayer: globalConfig.alphaTabSettings.player.enablePlayer,
				playerMode: alphaTab.PlayerMode.EnabledAutomatic,
				scrollSpeed: toFiniteNumber(globalConfig.alphaTabSettings.player.scrollSpeed, 500),
				scrollMode: globalConfig.alphaTabSettings.player.scrollMode,
				scrollOffsetX: toFiniteNumber(
					globalConfig.alphaTabSettings.player.scrollOffsetX,
					25
				),
				scrollOffsetY: toFiniteNumber(
					globalConfig.alphaTabSettings.player.scrollOffsetY,
					-25
				),
				enableCursor: globalConfig.alphaTabSettings.player.enableCursor,
				enableAnimatedBeatCursor:
					globalConfig.alphaTabSettings.player.enableAnimatedBeatCursor,
				soundFont: this.resources.soundFontUri,
				scrollElement: scrollElement, // 使用确定的滚动元素
				nativeBrowserSmoothScroll: false,
			},
			display: {
				scale: toFiniteClampedNumber(
					globalConfig.alphaTabSettings.display.scale,
					1,
					0.5,
					2
				),
				startBar: 1, // 总是从第一小节开始
				layoutMode: globalConfig.alphaTabSettings.display.layoutMode,
				barsPerRow: (() => {
					const barsPerRow = Math.trunc(
						toFiniteNumber(globalConfig.alphaTabSettings.display.barsPerRow, -1)
					);
					return barsPerRow === -1 ? -1 : Math.max(1, barsPerRow);
				})(),
				stretchForce: toFiniteClampedNumber(
					globalConfig.alphaTabSettings.display.stretchForce,
					1,
					0.25,
					2
				),
			},
		};

		const displaySettings = settingsJson.display!;
		const playerSettings = settingsJson.player!;
		const coreSettings = settingsJson.core!;

		// 调试：输出布局和滚动相关配置
		console.debug(`[PlayerController #${this.instanceId}] AlphaTab settings configured:`, {
			renderMode: {
				engine: effectiveRenderMode.engine,
				useWorkers: effectiveRenderMode.useWorkers,
				initialSafeMode,
			},
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
			console.debug(
				`[PlayerController #${this.instanceId}] Font configured:`,
				this.resources.bravuraUri
			);
		}

		// 添加颜色配置（防御性编程：确保所有颜色值都有效）
		if (style) {
			// 安全地读取 CSS 变量，确保 parseFloat 得到有效数字
			const accentH = toFiniteClampedNumber(
				parseFloat(style.getPropertyValue('--accent-h')),
				0,
				0,
				360
			);
			const accentS = toFiniteClampedNumber(
				parseFloat(style.getPropertyValue('--accent-s')),
				50,
				0,
				100
			);
			const accentL = toFiniteClampedNumber(
				parseFloat(style.getPropertyValue('--accent-l')),
				50,
				0,
				100
			);

			// 验证 HSL 值的有效性
			const isValidHSL =
				!Number.isNaN(accentH) &&
				!Number.isNaN(accentS) &&
				!Number.isNaN(accentL) &&
				accentH >= 0 &&
				accentH <= 360 &&
				accentS >= 0 &&
				accentS <= 100 &&
				accentL >= 0 &&
				accentL <= 100;

			let barNumberColor = '#000';
			if (isValidHSL) {
				try {
					barNumberColor = hslToHex(accentH, accentS, accentL);
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

			console.debug(
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
			console.debug(
				'[PlayerController] Scroll element is CSS selector:',
				currentScrollElement
			);
		} else {
			const scrollInfo = {
				element: currentScrollElement.tagName,
				className: currentScrollElement.className,
				scrollHeight: currentScrollElement.scrollHeight,
				clientHeight: currentScrollElement.clientHeight,
				canScroll: currentScrollElement.scrollHeight > currentScrollElement.clientHeight,
				overflowY: window.getComputedStyle(currentScrollElement).overflowY,
			};
			console.debug('[PlayerController] Scroll element configured:', scrollInfo);

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

		if (this.api?.settings.player) {
			const globalConfig = this.stores.globalConfig.getState();
			const nextScrollMode = globalConfig.alphaTabSettings.player.scrollMode;
			const nextEnableCursor = globalConfig.alphaTabSettings.player.enableCursor;

			if (
				this.api.settings.player.scrollMode !== nextScrollMode ||
				this.api.settings.player.enableCursor !== nextEnableCursor
			) {
				this.api.settings.player.scrollMode = nextScrollMode;
				this.api.settings.player.enableCursor = nextEnableCursor;
				this.api.updateSettings();
			}

			console.debug('[PlayerController] Scroll mode verified:', {
				scrollMode: nextScrollMode,
				enableCursor: nextEnableCursor,
			});
		}
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
				this.retryLoadAfterStableWait = false;
				const disabledUnsafeNumberedNotation = disableUnsafeNumberedNotation(score);
				console.debug(`[PlayerController #${this.instanceId}] scoreLoaded`, {
					trackCount: score.tracks.length,
					disabledUnsafeNumberedNotation,
					containerRect: this.container?.getBoundingClientRect(),
					viewportRect: this.scrollViewport?.getBoundingClientRect(),
				});

				// ✅ 恢复音轨配置
				this.restoreTrackConfigs(score);

				// 注意：总时长从 playerPositionChanged 的 e.endTime 获取，
				// 那才是考虑了速度等因素的实际播放时长

				this.configureScrollElement();
			};
			this.eventDisposers.push(this.api.scoreLoaded.on(scoreLoadedHandler));
			const renderStartedHandler = () => {
				this.stores.runtime.getState().setRenderState('rendering');
				console.debug(`[PlayerController #${this.instanceId}] renderStarted`, {
					containerRect: this.container?.getBoundingClientRect(),
					viewportRect: this.scrollViewport?.getBoundingClientRect(),
				});
			};
			this.eventDisposers.push(this.api.renderStarted.on(renderStartedHandler));

			// Render Finished
			const renderFinishedHandler = (renderResult?: {
				totalWidth?: number;
				totalHeight?: number;
			}) => {
				this.stores.runtime.getState().setRenderState('finished');
				const totalWidth = renderResult?.totalWidth ?? 0;
				const totalHeight = renderResult?.totalHeight ?? 0;
				console.debug(`[PlayerController #${this.instanceId}] renderFinished`, {
					totalWidth,
					totalHeight,
					awaitingStableRender: this.awaitingStableRender,
					stabilizationRenderRequested: this.stabilizationRenderRequested,
					containerRect: this.container?.getBoundingClientRect(),
					viewportRect: this.scrollViewport?.getBoundingClientRect(),
				});

				const scoreLoaded = this.stores.runtime.getState().scoreLoaded;
				const shouldUseSinglePassRender = this.api
					? this.api.settings.core.useWorkers === false
					: !this.getEffectiveRenderMode().useWorkers;
				const hasMeasuredRender =
					Number.isFinite(totalWidth) &&
					Number.isFinite(totalHeight) &&
					totalWidth > 0 &&
					totalHeight > 0;

				if (scoreLoaded && this.awaitingStableRender) {
					if (!hasMeasuredRender) {
						console.warn(
							`[PlayerController #${this.instanceId}] renderFinished without valid measurements`,
							{
								totalWidth,
								totalHeight,
								containerRect: this.container?.getBoundingClientRect(),
								viewportRect: this.scrollViewport?.getBoundingClientRect(),
							}
						);

						if (!this.stabilizationRenderRequested) {
							this.requestStabilizedRender();
						}
						return;
					}

					if (shouldUseSinglePassRender) {
						return;
					}

					window.requestAnimationFrame(() => {
						if (this.awaitingStableRender && !this.stabilizationRenderInFlight) {
							this.endStableRenderWait();
						}
					});
				}
			};
			this.eventDisposers.push(this.api.renderFinished.on(renderFinishedHandler));

			const postRenderFinishedHandler = () => {
				console.debug(`[PlayerController #${this.instanceId}] postRenderFinished`, {
					awaitingStableRender: this.awaitingStableRender,
					containerRect: this.container?.getBoundingClientRect(),
					viewportRect: this.scrollViewport?.getBoundingClientRect(),
				});

				const shouldUseSinglePassRender = this.api
					? this.api.settings.core.useWorkers === false
					: !this.getEffectiveRenderMode().useWorkers;

				if (this.awaitingStableRender && shouldUseSinglePassRender) {
					window.requestAnimationFrame(() => {
						this.endStableRenderWait();
					});
				}
			};
			this.eventDisposers.push(this.api.postRenderFinished.on(postRenderFinishedHandler));

			// Player Ready
			const playerReadyHandler = () => {
				console.debug('[PlayerController] Player ready - can now play music');
				const runtime = this.stores.runtime.getState();
				runtime.setApiReady(true);

				if (runtime.scoreLoaded) {
					this.apiLoadHandled = true;
					return;
				}

				if (this.awaitingStableRender) {
					this.retryLoadAfterStableWait = true;
					return;
				}

				this.tryLoadScoreAfterApiReady();
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
				this.endStableRenderWait();
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
		// console.debug('[PlayerController] Seek to:', {
		// 	positionMs,
		// 	positionSec: (positionMs / 1000).toFixed(2) + 's',
		// });
	}

	setPlaybackSpeed(speed: number): void {
		if (!this.api) return;
		this.api.playbackSpeed = toFiniteClampedNumber(speed, 1, 0.5, 2);
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
		this.api.settings.display.scale = toFiniteClampedNumber(scale, 1, 0.5, 2);
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

		if (profile === alphaTab.StaveProfile.Default) {
			void this.rebuildApi();
			return;
		}

		if (this.api.score && applyStaveProfileToScore(this.api.score, profile)) {
			this.api.render();
		}
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
		this.api.settings.player.scrollSpeed = toFiniteNumber(speed, 500);
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

		console.debug('[PlayerController] Scroll Configuration Debug:', {
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
	 * ✅ 恢复音轨配置
	 * 在曲谱加载后调用，从 workspace 配置中恢复用户之前保存的音轨设置
	 */
	private restoreTrackConfigs(score: alphaTab.model.Score): void {
		const workspaceConfig = this.stores.workspaceConfig.getState();
		const savedConfigs = workspaceConfig.sessionPlayerState.trackConfigs || [];

		if (savedConfigs.length === 0) {
			console.debug(
				`[PlayerController #${this.instanceId}] No saved track configs to restore`
			);
			return;
		}

		console.debug(
			`[PlayerController #${this.instanceId}] Restoring track configs:`,
			savedConfigs
		);

		for (const config of savedConfigs) {
			const sanitizedConfig = sanitizeTrackConfig(config.trackIndex, config);
			const track = score.tracks.find((t) => t.index === config.trackIndex);
			if (!track) {
				console.warn(
					`[PlayerController #${this.instanceId}] Track ${config.trackIndex} not found in score`
				);
				continue;
			}

			// 恢复 mute 状态
			if (sanitizedConfig.isMute !== undefined) {
				track.playbackInfo.isMute = sanitizedConfig.isMute;
				this.api?.changeTrackMute([track], sanitizedConfig.isMute);
			}

			// 恢复 solo 状态
			if (sanitizedConfig.isSolo !== undefined) {
				track.playbackInfo.isSolo = sanitizedConfig.isSolo;
				this.api?.changeTrackSolo([track], sanitizedConfig.isSolo);
			}

			// 恢复音量
			if (sanitizedConfig.volume !== undefined && track.playbackInfo.volume > 0) {
				const volumeRatio = sanitizedConfig.volume / track.playbackInfo.volume;
				this.api?.changeTrackVolume([track], volumeRatio);
			}

			// 恢复音频移调
			if (sanitizedConfig.transposeAudio !== undefined) {
				this.api?.changeTrackTranspositionPitch([track], sanitizedConfig.transposeAudio);
			}

			// 恢复完全移调
			if (sanitizedConfig.transposeFull !== undefined && this.api) {
				const pitches = this.api.settings.notation.transpositionPitches;
				while (pitches.length < track.index + 1) {
					pitches.push(0);
				}
				pitches[track.index] = sanitizedConfig.transposeFull;
			}
		}

		// 应用移调设置
		if (this.api && savedConfigs.some((c) => c.transposeFull !== undefined)) {
			this.api.updateSettings();
			console.debug(`[PlayerController #${this.instanceId}] Applied transposition settings`);
			if (
				!this.awaitingStableRender &&
				!this.stabilizationRenderInFlight &&
				!this.stabilizationRenderRequested &&
				!this.destroyed
			) {
				this.api.render();
			}
		}
	}

	// ========== Score Loading ==========

	/**
	 * 智能加载文件，处理API未就绪的情况
	 */
	async loadFileWhenReady(file: TFile): Promise<void> {
		const loadTask = async () => {
			if (this.destroyed) {
				throw new Error('Controller destroyed');
			}

			if (!this.api) {
				throw new Error('API not initialized for score load');
			}

			if (file.extension && ['alphatab', 'alphatex'].includes(file.extension.toLowerCase())) {
				const textContent = await this.plugin.app.vault.read(file);
				if (!this.api || this.destroyed) {
					throw new Error('API not initialized for score load');
				}
				await this.loadScoreFromAlphaTex(textContent);
			} else {
				const arrayBuffer = await this.plugin.app.vault.readBinary(file);
				if (!this.api || this.destroyed) {
					throw new Error('API not initialized for score load');
				}
				await this.loadScoreFromFile(arrayBuffer, file.name);
			}
		};

		if (this.api) {
			try {
				await loadTask();
				this.apiLoadHandled = true;
				this.pendingFileLoad = null;
			} catch (error) {
				if (this.destroyed) {
					return;
				}

				if (!this.api) {
					this.pendingFileLoad = loadTask;
					this.apiLoadHandled = false;
					console.debug(
						`[PlayerController #${this.instanceId}] Deferred score load until api becomes available`
					);
					return;
				}

				throw error;
			}
		} else {
			if (this.destroyed) {
				return;
			}
			this.pendingFileLoad = loadTask;
			this.apiLoadHandled = false;
		}
	}

	async loadScoreFromUrl(url: string): Promise<void> {
		if (this.destroyed) {
			throw new Error('Controller destroyed');
		}

		if (!this.api) {
			throw new Error('API not initialized');
		}

		console.debug(`[PlayerController #${this.instanceId}] Loading score from URL:`, url);
		this.beginStableRenderWait('Loading score...');
		this.stores.runtime.getState().setScoreLoaded(false);
		this.stores.runtime.getState().clearError();

		try {
			this.api.load(url);
			await Promise.resolve();
			this.stores.workspaceConfig.getState().setScoreSource({ type: 'url', content: url });
			this.stores.ui.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error(`[PlayerController #${this.instanceId}] Failed to load score:`, error);
			this.stores.runtime
				.getState()
				.setError('score-load', error instanceof Error ? error.message : String(error));
			this.stores.ui.getState().showToast('error', 'Failed to load score');
			this.endStableRenderWait();
			throw error;
		}
	}

	async loadScoreFromFile(arrayBuffer: ArrayBuffer, fileName?: string): Promise<void> {
		if (this.destroyed) {
			throw new Error('Controller destroyed');
		}

		if (!this.api) {
			throw new Error('API not initialized');
		}

		this.beginStableRenderWait('Loading score...');
		this.stores.runtime.getState().setScoreLoaded(false);
		this.stores.runtime.getState().clearError();

		try {
			const uint8Array = new Uint8Array(arrayBuffer);
			this.api.load(uint8Array);
			await Promise.resolve();

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
			this.endStableRenderWait();
			throw error;
		}
	}

	loadScoreFromAlphaTex(tex: string): Promise<void> {
		if (this.destroyed) {
			return Promise.reject(new Error('Controller destroyed'));
		}

		if (!this.api) {
			return Promise.reject(new Error('API not initialized'));
		}

		this.beginStableRenderWait('Loading score...');
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
			return Promise.resolve();
		} catch (error) {
			console.error('[PlayerController] Failed to load score:', error);
			this.stores.runtime
				.getState()
				.setError('score-load', error instanceof Error ? error.message : String(error));
			this.stores.ui.getState().showToast('error', 'Failed to load score');
			this.endStableRenderWait();
			return Promise.reject(error);
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
