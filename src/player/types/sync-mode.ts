/**
 * 媒体同步模式
 */
export enum SyncMode {
	/**
	 * 双向同步（默认）
	 * - 曲谱控制外部媒体
	 * - 外部媒体更新曲谱光标
	 */
	Bidirectional = 'bidirectional',

	/**
	 * 媒体为主
	 * - 只有外部媒体控制曲谱光标
	 * - 曲谱不控制外部媒体的播放/暂停/跳转
	 */
	MediaMaster = 'media-master',

	/**
	 * 曲谱为主
	 * - 只有曲谱控制外部媒体
	 * - 外部媒体的手动操作不影响曲谱（仅跟随 AlphaTab）
	 */
	ScoreMaster = 'score-master',
}

/**
 * 同步模式配置
 */
export interface SyncModeConfig {
	mode: SyncMode;

	/**
	 * 是否允许外部媒体控制曲谱
	 * - MediaMaster: true
	 * - ScoreMaster: false
	 * - Bidirectional: true
	 */
	allowMediaControlScore: boolean;

	/**
	 * 是否允许曲谱控制外部媒体
	 * - MediaMaster: false
	 * - ScoreMaster: true
	 * - Bidirectional: true
	 */
	allowScoreControlMedia: boolean;
}

/**
 * 根据同步模式获取配置
 */
export function getSyncModeConfig(mode: SyncMode): SyncModeConfig {
	switch (mode) {
		case SyncMode.MediaMaster:
			return {
				mode,
				allowMediaControlScore: true,
				allowScoreControlMedia: false,
			};
		case SyncMode.ScoreMaster:
			return {
				mode,
				allowMediaControlScore: false,
				allowScoreControlMedia: true,
			};
		case SyncMode.Bidirectional:
		default:
			return {
				mode,
				allowMediaControlScore: true,
				allowScoreControlMedia: true,
			};
	}
}
