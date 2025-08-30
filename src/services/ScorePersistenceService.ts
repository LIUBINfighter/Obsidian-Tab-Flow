import * as alphaTab from '@coderline/alphatab';

interface TrackSettings {
	solo?: boolean;
	mute?: boolean;
	volume?: number; // 0-16
	transpose?: number; // -12 to 12
	transposeAudio?: number; // -12 to 12
}

interface ScoreViewState {
	tracks?: number[]; // indices of selected tracks
	trackSettings?: Record<string, TrackSettings>; // key: trackIndex, value: settings
}

export class ScorePersistenceService {
	private localStorageKeyPrefix = 'tabflow-viewstate:';

	/**
	 * 从 localStorage 加载并应用乐谱的视图状态 (音轨选择, 音轨参数)。
	 * @param api alphaTab API 实例
	 * @param filePath 当前乐谱的文件路径 (作为 localStorage 的键)
	 */
	public loadScoreViewState(api: alphaTab.AlphaTabApi, filePath: string): void {
		if (!api.score || !filePath) return;

		try {
			const raw = localStorage.getItem(this.localStorageKeyPrefix + filePath);
			if (!raw) return;

			const state: ScoreViewState = JSON.parse(raw);
			const allTracks: alphaTab.model.Track[] = api.score.tracks || [];

			// 1. 应用选中的音轨
			if (Array.isArray(state.tracks) && state.tracks.length > 0) {
				const idxSet = new Set<number>(state.tracks);
				const selected = allTracks.filter((t) => idxSet.has(t.index));
				if (selected.length > 0) {
					api.renderTracks(selected as any);
				}
			}

			// 2. 应用轨道参数 (solo/mute/volume/transpose)
			if (state.trackSettings && typeof state.trackSettings === 'object') {
				const settings: Record<string, TrackSettings> = state.trackSettings;
				allTracks.forEach((track) => {
					const s = settings[String(track.index)] || settings[track.index];
					if (!s) return;
					try {
						if (typeof s.solo === 'boolean') {
							api.changeTrackSolo([track], s.solo);
							(track.playbackInfo as any).isSolo = s.solo; // 更新内部状态
						}
						if (typeof s.mute === 'boolean') {
							api.changeTrackMute([track], s.mute);
							(track.playbackInfo as any).isMute = s.mute; // 更新内部状态
						}
						if (typeof s.volume === 'number') {
							const vol = Math.max(0, Math.min(16, s.volume));
							api.changeTrackVolume([track], vol / 16);
							(track.playbackInfo as any).volume = vol; // 更新内部状态
						}
						if (typeof s.transpose === 'number') {
							const tr = Math.max(-12, Math.min(12, s.transpose));
							api.changeTrackTranspositionPitch([track], tr);
						}
						if (typeof s.transposeAudio === 'number') {
							// alphaTab API 暂不支持音频移调，仅在内部状态中更新
							(track.playbackInfo as any).transposeAudio = s.transposeAudio;
						}
					} catch (e) {
						console.warn(
							`[ScorePersistenceService] 应用轨道 ${track.index} 参数失败:`,
							e
						);
					}
				});
			}
		} catch (e) {
			console.error('[ScorePersistenceService] 读取乐谱视图状态失败:', e);
		}
	}

	/**
	 * 保存音轨的选中状态。
	 * @param filePath 当前乐谱的文件路径
	 * @param selectedTracks 选中的音轨列表
	 */
	public saveSelectedTracks(filePath: string, selectedTracks: alphaTab.model.Track[]): void {
		if (!filePath) return;
		try {
			const raw = localStorage.getItem(this.localStorageKeyPrefix + filePath);
			const state: ScoreViewState = raw ? JSON.parse(raw) : {};
			state.tracks = selectedTracks.map((t) => t.index);
			localStorage.setItem(this.localStorageKeyPrefix + filePath, JSON.stringify(state));
		} catch (e) {
			console.error('[ScorePersistenceService] 保存选定音轨失败:', e);
		}
	}

	/**
	 * 保存单个音轨的参数 (solo, mute, volume, transpose)。
	 * @param filePath 当前乐谱的文件路径
	 * @param trackIndex 音轨索引
	 * @param partial 要更新的部分参数
	 */
	public saveTrackSettings(
		filePath: string,
		trackIndex: number,
		partial: Partial<TrackSettings>
	): void {
		if (!filePath) return;
		try {
			const raw = localStorage.getItem(this.localStorageKeyPrefix + filePath);
			const state: ScoreViewState = raw ? JSON.parse(raw) : {};
			state.trackSettings = state.trackSettings || {};
			const key = String(trackIndex);
			state.trackSettings[key] = Object.assign({}, state.trackSettings[key] || {}, partial);
			localStorage.setItem(this.localStorageKeyPrefix + filePath, JSON.stringify(state));
		} catch (e) {
			console.error('[ScorePersistenceService] 保存音轨参数失败:', e);
		}
	}
}
