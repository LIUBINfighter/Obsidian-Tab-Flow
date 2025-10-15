/**
 * Workspace Session Configuration Schema
 * 
 * 工作区会话配置（工作区特定，标签页关闭即清除）
 * 持久化方式：View.getState/setState
 */

// ========== Score Source ==========
export interface ScoreSource {
	type: 'file' | 'url' | 'alphatex';
	content: string | null; // url字符串 / alphatex文本 / blob URL
	fileName?: string; // 原始文件名（显示用）
	lastModified?: number; // 时间戳
}

// ========== Session-specific Player State ==========
export interface SessionPlayerState {
	// AB 循环（文件特定）
	loopRange: {
		startBar: number; // 小节索引，1-based
		endBar: number;
	} | null;

	// 是否循环播放（会话临时）
	isLooping: boolean;

	// 当前小节位置（可选，用于恢复播放位置）
	startBar?: number;
}

// ========== Complete Workspace Session Config ==========
export interface WorkspaceSessionConfig {
	scoreSource: ScoreSource;
	sessionPlayerState: SessionPlayerState;
}

// ========== Default Workspace Session Config ==========
export function getDefaultWorkspaceSessionConfig(): WorkspaceSessionConfig {
	return {
		scoreSource: {
			type: 'url',
			content: null,
		},
		sessionPlayerState: {
			loopRange: null,
			isLooping: false,
		},
	};
}
