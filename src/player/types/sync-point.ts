/**
 * 同步点相关类型定义
 *
 * 用于管理 AlphaTab 曲谱与外部媒体的同步映射点
 */

/**
 * 同步点标记类型
 */
export enum SyncPointMarkerType {
	/** 起始标记 */
	StartMarker = 'start',
	/** 结束标记 */
	EndMarker = 'end',
	/** 小节标记 */
	MasterBar = 'masterbar',
	/** 中间标记 */
	Intermediate = 'intermediate',
}

/**
 * 同步点标记
 *
 * 表示曲谱中的一个特定位置与媒体时间的映射
 */
export interface SyncPointMarker {
	/** 唯一 ID */
	uniqueId: string;

	/** 媒体同步时间（毫秒） */
	syncTime: number;

	/** 合成器原始时间（毫秒） */
	synthTime: number;
	/** 合成器 BPM */
	synthBpm: number;
	/** 合成器中的 Tick 位置 */
	synthTick: number;

	/** 所在小节索引 */
	masterBarIndex: number;
	/** 小节起始 Tick */
	masterBarStart: number;
	/** 小节结束 Tick */
	masterBarEnd: number;
	/** 小节出现次数 */
	occurence: number;
	/** 同步后的 BPM（可选，表示实际同步的速度） */
	syncBpm?: number;

	/** 标记类型 */
	markerType: SyncPointMarkerType;
}

/**
 * 同步点信息
 *
 * 包含完整的音频样本数据和同步点列表
 */
export interface SyncPointInfo {
	/** 最后一个小节的结束 Tick */
	endTick: number;
	/** 音频总时长（毫秒） */
	endTime: number;
	/** 采样率（Hz） */
	sampleRate: number;
	/** 左声道样本 */
	leftSamples: Float32Array;
	/** 右声道样本 */
	rightSamples: Float32Array;
	/** 同步点标记列表 */
	syncPointMarkers: SyncPointMarker[];
}

/**
 * 同步点编辑操作类型
 */
export enum SyncPointEditType {
	/** 添加同步点 */
	Add = 'add',
	/** 删除同步点 */
	Delete = 'delete',
	/** 移动同步点 */
	Move = 'move',
	/** 修改同步点 BPM */
	UpdateBpm = 'update_bpm',
}

/**
 * 同步点编辑事件
 */
export interface SyncPointEditEvent {
	/** 操作类型 */
	type: SyncPointEditType;
	/** 受影响的标记 */
	marker: SyncPointMarker;
	/** 旧值（用于撤销） */
	oldValue?: unknown;
	/** 新值 */
	newValue?: unknown;
}

/**
 * 创建默认的 SyncPointInfo
 */
export function createDefaultSyncPointInfo(): SyncPointInfo {
	return {
		endTick: 0,
		endTime: 0,
		sampleRate: 44100,
		leftSamples: new Float32Array(0),
		rightSamples: new Float32Array(0),
		syncPointMarkers: [],
	};
}

/**
 * 生成唯一的同步点 ID
 */
export function generateSyncPointId(): string {
	return `${Date.now().toString(32)}-${Math.random().toString(16).slice(2)}`;
}
