import type TabFlowPlugin from '../main';
import * as alphaTab from '@coderline/alphatab';

export interface TrackRuntimeSettings {
	solo?: boolean;
	mute?: boolean;
	volume?: number; // 0..16
	transpose?: number; // -12..12
	transposeAudio?: number; // -12..12 (logical only for now)
}

export interface FileTrackStateEntry {
	selectedTracks?: number[]; // indices
	trackSettings?: Record<string, TrackRuntimeSettings>; // key: trackIndex
}

export interface PersistedTrackStatesV1 {
	version: 1;
	files: Record<string, FileTrackStateEntry>;
}

export type TrackStateChangedEvent = {
	filePath: string;
	entry: FileTrackStateEntry;
	changed: Partial<FileTrackStateEntry> | null; // diff info (best effort)
};

type Listener = (ev: TrackStateChangedEvent) => void;

/**
 * TrackStateStore 是插件级单例：
 * - 维护每个文件的音轨选择以及每条音轨的参数（solo/mute/volume/transpose/...）
 * - 提供防抖持久化到 plugin.settings.trackStates (saveData)
 * - 负责与 alphaTabApi 的同步由调用方控制：store 不直接调用 api
 */
export class TrackStateStore {
	private plugin: TabFlowPlugin;
	private data: PersistedTrackStatesV1;
	private listeners: Set<Listener> = new Set();
	private saveDebounced: () => void;

	constructor(plugin: TabFlowPlugin) {
		this.plugin = plugin;
		const existing: any = (plugin.settings as any).trackStates;
		if (existing && typeof existing === 'object' && existing.version === 1) {
			this.data = existing as PersistedTrackStatesV1;
		} else {
			this.data = { version: 1, files: {} };
		}
		// 简易防抖实现，避免额外依赖
		let timer: number | null = null;
		this.saveDebounced = () => {
			if (timer) window.clearTimeout(timer);
			timer = window.setTimeout(() => {
				this.flush().catch(console.error);
				timer = null;
			}, 500);
		};
	}

	/** 订阅变化 */
	on(listener: Listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private emit(
		filePath: string,
		entry: FileTrackStateEntry,
		changed: Partial<FileTrackStateEntry> | null
	) {
		const ev: TrackStateChangedEvent = { filePath, entry: { ...entry }, changed };
		this.listeners.forEach((l) => {
			try {
				l(ev);
			} catch (e) {
				console.warn('[TrackStateStore] listener error', e);
			}
		});
	}

	/** 获取文件状态的浅拷贝 */
	getFileState(filePath: string): FileTrackStateEntry {
		if (!this.data.files[filePath]) {
			this.data.files[filePath] = {};
		}
		const entry = this.data.files[filePath];
		// 返回浅拷贝避免外部直接突变内部引用
		return {
			selectedTracks: entry.selectedTracks ? [...entry.selectedTracks] : undefined,
			trackSettings: entry.trackSettings ? { ...entry.trackSettings } : undefined,
		};
	}

	/** 设置选中音轨（立即内存更新 + 防抖保存 + 事件） */
	setSelectedTracks(filePath: string, indices: number[]) {
		const entry = this.data.files[filePath] || (this.data.files[filePath] = {});
		entry.selectedTracks = [...indices];
		this.emit(filePath, entry, { selectedTracks: [...indices] });
		this.saveDebounced();
	}

	/** 更新单轨设置（部分字段 patch） */
	updateTrackSetting(filePath: string, trackIndex: number, patch: Partial<TrackRuntimeSettings>) {
		const entry = this.data.files[filePath] || (this.data.files[filePath] = {});
		if (!entry.trackSettings) entry.trackSettings = {};
		const key = String(trackIndex);
		const prev = entry.trackSettings[key] || {};
		entry.trackSettings[key] = { ...prev, ...patch };
		this.emit(filePath, entry, { trackSettings: { [key]: { ...entry.trackSettings[key] } } });
		this.saveDebounced();
	}

	/** 批量更新多个轨道（可用于全静音等命令） */
	batchUpdateTrackSettings(
		filePath: string,
		updates: Record<string, Partial<TrackRuntimeSettings>>
	) {
		const entry = this.data.files[filePath] || (this.data.files[filePath] = {});
		if (!entry.trackSettings) entry.trackSettings = {};
		Object.entries(updates).forEach(([idx, patch]) => {
			const prev = entry.trackSettings![idx] || {};
			entry.trackSettings![idx] = { ...prev, ...patch };
		});
		this.emit(filePath, entry, { trackSettings: updates });
		this.saveDebounced();
	}

	/** 完整替换（慎用） */
	replaceFileState(filePath: string, newState: FileTrackStateEntry) {
		this.data.files[filePath] = {
			selectedTracks: newState.selectedTracks ? [...newState.selectedTracks] : undefined,
			trackSettings: newState.trackSettings ? { ...newState.trackSettings } : undefined,
		};
		this.emit(filePath, this.data.files[filePath], { ...newState });
		this.saveDebounced();
	}

	/** 将当前内存写回插件 settings 并调用 saveData */
	async flush() {
		(this.plugin.settings as any).trackStates = this.data;
		await this.plugin.saveSettings();
	}

	/** 可选：清理指定文件的状态 */
	clearFile(filePath: string) {
		this.data.files[filePath] = {};
		// 发出清空后的通知（无特定变更，交由调用方明确下发 selectedTracks）
		this.emit(filePath, this.data.files[filePath], {});
		this.saveDebounced();
	}

	/** 根据当前 alphaTab api 初始化缺失轨道设置（只读当前播放实际值） */
	ensureDefaultsFromApi(filePath: string, api: alphaTab.AlphaTabApi | undefined) {
		if (!api?.score?.tracks) return;
		const entry = this.data.files[filePath] || (this.data.files[filePath] = {});
		if (!entry.trackSettings) entry.trackSettings = {};
		for (const track of api.score.tracks) {
			const key = String(track.index);
			if (!entry.trackSettings[key]) {
				entry.trackSettings[key] = {
					solo: (track.playbackInfo as any).isSolo ?? false,
					mute: (track.playbackInfo as any).isMute ?? false,
					volume: (track.playbackInfo as any).volume ?? 8,
					transpose: 0,
					transposeAudio: (track.playbackInfo as any).transposeAudio ?? 0,
				};
			}
		}
		this.emit(filePath, entry, null);
		this.saveDebounced();
	}
}
