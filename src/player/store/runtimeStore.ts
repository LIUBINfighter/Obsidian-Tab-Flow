/**
 * Runtime Store - 会话级别的运行时状态（非持久化）
 *
 * 职责：
 * 1. 管理 alphaTab API 实例的引用
 * 2. 同步播放器运行时状态（播放位置、轨道状态等）
 * 3. 管理渲染状态和错误信息
 * 4. 不持久化到 localStorage
 */

import { create } from 'zustand';
import type { SessionState } from '../types/config-schema';
import { getInitialSessionState } from '../types/config-schema';

export interface RuntimeStore extends SessionState {
	// 额外的 API 实例引用（不在 SessionState 中）
	alphaTabApi: any | null;

	// Actions
	setApi: (api: any | null) => void;
	setApiReady: (ready: boolean) => void;
	setScoreLoaded: (loaded: boolean) => void;
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

export const useRuntimeStore = create<RuntimeStore>((set) => ({
	...getInitialSessionState(),
	alphaTabApi: null,

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
