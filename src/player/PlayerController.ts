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

export class PlayerController {
	private api: AlphaTabApi | null = null;
	private container: HTMLElement | null = null;
	private unsubscribeConfig: (() => void) | null = null;
	private lastConfig: AlphaTabPlayerConfig | null = null;

	constructor() {
		console.log('[PlayerController] Initialized');
	}

	/**
	 * 初始化控制器
	 * @param container alphaTab 渲染容器
	 */
	init(container: HTMLElement): void {
		console.log('[PlayerController] init() called');
		this.container = container;

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

			// 创建新 API
			const alphaTab = await import('@coderline/alphatab');
			this.api = new alphaTab.AlphaTabApi(this.container, settings);

			// 绑定事件
			this.bindApiEvents();

			// 保存到 runtimeStore
			useRuntimeStore.getState().setApi(this.api);

			// 更新最后配置
			this.lastConfig = JSON.parse(JSON.stringify(config));

			console.log('[PlayerController] API rebuilt successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to rebuild API:', error);
			useRuntimeStore.getState().setError('api-init', error instanceof Error ? error.message : String(error));
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
		return {
			core: {
				...config.alphaTabSettings.core,
			},
			player: {
				...config.alphaTabSettings.player,
			},
			display: {
				...config.alphaTabSettings.display,
			},
		};
	}

	// ========== API Events ==========

	private bindApiEvents(): void {
		if (!this.api) return;

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
		this.api.playerReady.on(() => {
			console.log('[PlayerController] playerReady');
			useRuntimeStore.getState().setApiReady(true);
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
			useRuntimeStore.getState().setError('score-load', error instanceof Error ? error.message : String(error));
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
			useConfigStore.getState().updateScoreSource({ type: 'file', content: fileName || 'local-file' });
			useUIStore.getState().showToast('success', 'Score loaded successfully');
		} catch (error) {
			console.error('[PlayerController] Failed to load score:', error);
			useRuntimeStore.getState().setError('score-load', error instanceof Error ? error.message : String(error));
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
			useRuntimeStore.getState().setError('score-load', error instanceof Error ? error.message : String(error));
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
