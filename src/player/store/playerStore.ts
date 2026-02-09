import { create } from 'zustand';
import * as alphaTab from '@coderline/alphatab';

interface PlayerState {
	// AlphaTab API 实例
	api: alphaTab.AlphaTabApi | null;
	setApi: (api: alphaTab.AlphaTabApi | null) => void;

	// 播放状态
	isPlaying: boolean;
	setIsPlaying: (playing: boolean) => void;

	// 当前时间和总时长（毫秒）
	currentTime: number;
	duration: number;
	setCurrentTime: (time: number) => void;
	setDuration: (duration: number) => void;

	// 音轨信息
	tracks: alphaTab.model.Track[];
	setTracks: (tracks: alphaTab.model.Track[]) => void;
	selectedTrackIndices: number[];
	setSelectedTrackIndices: (indices: number[]) => void;

	// 乐谱信息
	scoreTitle: string;
	setScoreTitle: (title: string) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
	api: null,
	setApi: (api) => set({ api }),

	isPlaying: false,
	setIsPlaying: (isPlaying) => set({ isPlaying }),

	currentTime: 0,
	duration: 0,
	setCurrentTime: (currentTime) => set({ currentTime }),
	setDuration: (duration) => set({ duration }),

	tracks: [],
	setTracks: (tracks) => set({ tracks }),
	selectedTrackIndices: [],
	setSelectedTrackIndices: (selectedTrackIndices) => set({ selectedTrackIndices }),

	scoreTitle: '',
	setScoreTitle: (scoreTitle) => set({ scoreTitle }),
}));
