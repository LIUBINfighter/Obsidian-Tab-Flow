/**
 * Runtime Store - 会话级别的运行时状态（非持久化）
 *
 * 职责：
 * 1. 管理 alphaTab API 实例的引用
 * 2. 同步播放器运行时状态（播放位置、轨道状态等）
 * 3. 管理渲染状态和错误信息
 * 4. 不持久化到 localStorage
 *
 * 架构更新：使用工厂模式支持多实例（多标签页隔离）
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { SessionState } from '../types/config-schema';
import { getInitialSessionState } from '../types/config-schema';

export interface RuntimeStore extends SessionState {
	// 额外的 API 实例引用（不在 SessionState 中）
	alphaTabApi: any | null;

	// 保存最后加载的乐谱数据，用于 API 重建后重新加载
	lastLoadedScore: {
		type: 'alphatex' | 'binary' | null;
		data: string | Uint8Array | null;
		fileName?: string;
	};

	// Actions
	setApi: (api: any | null) => void;
	setApiReady: (ready: boolean) => void;
	setScoreLoaded: (loaded: boolean) => void;
	setLastLoadedScore: (
		type: 'alphatex' | 'binary',
		data: string | Uint8Array,
		fileName?: string
	) => void;
	clearLastLoadedScore: () => void;
	setRenderState: (state: SessionState['renderState']) => void;
	setPlaybackState: (state: SessionState['playbackState']) => void;
	setPosition: (positionMs: number) => void;
	setDuration: (durationMs: number) => void;
	setCurrentBeat: (beat: SessionState['currentBeat']) => void;
	setTrackOverride: (
		trackIndex: string,
		updates: Partial<{ soloOverride: boolean; muteOverride: boolean; volumeOverride: number }>
	) => void;
	removeTrackOverride: (trackIndex: string) => void;
	setError: (type: SessionState['error']['type'], message: string | null) => void;
	clearError: () => void;
	reset: () => void;
}

/**
 * 工厂函数：创建独立的 RuntimeStore 实例
 * 每个 PlayerController 应该创建自己的 store 实例，避免多标签页状态冲突
 */
export function createRuntimeStore(): UseBoundStore<StoreApi<RuntimeStore>> {
	return create<RuntimeStore>((set) => ({
		...getInitialSessionState(),
		alphaTabApi: null,
		lastLoadedScore: {
			type: null,
			data: null,
		},

		// Actions
		setApi: (api) => {
			set({
				alphaTabApi: api,
				apiReady: !!api,
			});
		},

		setApiReady: (ready) => {
			set({ apiReady: ready });
		},

		setScoreLoaded: (loaded) => {
			set({ scoreLoaded: loaded });
		},

		setLastLoadedScore: (type, data, fileName) => {
			set({
				lastLoadedScore: {
					type,
					data,
					fileName,
				},
			});
		},

		clearLastLoadedScore: () => {
			set({
				lastLoadedScore: {
					type: null,
					data: null,
				},
			});
		},

		setRenderState: (state) => {
			set({ renderState: state });
		},

		setPlaybackState: (state) => {
			set({ playbackState: state });
		},

		setPosition: (positionMs) => {
			set({ positionMs });
		},

		setDuration: (durationMs) => {
			set({ durationMs });
		},

		setCurrentBeat: (beat) => {
			set({ currentBeat: beat });
		},

		setTrackOverride: (trackIndex, updates) => {
			set((state) => ({
				trackOverrides: {
					...state.trackOverrides,
					[trackIndex]: {
						...state.trackOverrides[trackIndex],
						...updates,
					},
				},
			}));
		},

		removeTrackOverride: (trackIndex) => {
			set((state) => {
				const newOverrides = { ...state.trackOverrides };
				delete newOverrides[trackIndex];
				return { trackOverrides: newOverrides };
			});
		},

		setError: (type, message) => {
			set({
				error: {
					type,
					message,
					timestamp: Date.now(),
				},
			});
		},

		clearError: () => {
			set({
				error: {
					type: null,
					message: null,
					timestamp: null,
				},
			});
		},

		reset: () => {
			set({
				...getInitialSessionState(),
				alphaTabApi: null,
			});
		},
	}));
}

// 保留全局单例用于向后兼容（旧代码/组件可能依赖）
// 新代码应使用 createRuntimeStore() 工厂函数
export const useRuntimeStore = createRuntimeStore();
