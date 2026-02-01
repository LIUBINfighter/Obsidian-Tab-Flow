/**
 * MediaSync 类型定义
 *
 * 用于外部媒体（Audio/Video/YouTube）与 AlphaTab 的同步
 */

/**
 * 媒体类型枚举
 */
export enum MediaType {
	/** 内置合成器（无外部媒体） */
	Synth = 'synth',
	/** 音频文件 */
	Audio = 'audio',
	/** 视频文件 */
	Video = 'video',
	/** YouTube 视频 */
	YouTube = 'youtube',
}

/**
 * 媒体状态（类型安全的联合类型）
 */
export type MediaState =
	| { type: MediaType.Synth }
	| { type: MediaType.Audio; url: string; file?: File }
	| { type: MediaType.Video; url: string; file?: File }
	| { type: MediaType.YouTube; videoId: string; url: string };

/**
 * 兼容 HTMLMediaElement 的接口（用于 Audio/Video/YouTube）
 */
export interface MediaElementLike {
	// 基本属性
	duration: number;
	currentTime: number;
	volume: number;
	playbackRate: number;

	// 方法
	play(): Promise<void> | void;
	pause(): void;

	// 事件监听
	addEventListener(event: string, handler: () => void): void;
	removeEventListener(event: string, handler: () => void): void;
}

/**
 * 媒体同步配置
 */
export interface MediaSyncConfig {
	/** 媒体类型 */
	type: MediaType;

	/** 媒体源 URL（Audio/Video/YouTube） */
	url?: string;

	/** 时间偏移（毫秒） */
	offset?: number;

	/** 是否启用调试日志 */
	debug?: boolean;
}

/**
 * YouTube 视频 ID 提取结果
 */
export interface YouTubeVideoInfo {
	videoId: string;
	url: string;
}

/**
 * 媒体加载事件
 */
export interface MediaLoadEvent {
	type: MediaType;
	success: boolean;
	error?: string;
}
