/**
 * 文件加载适配器接口
 *
 * 适配器模式：支持不同环境下的媒体文件加载
 * - Obsidian vault 文件
 * - 外部 URL
 * - 本地文件系统（未来扩展）
 */

/**
 * 媒体文件信息
 */
export interface MediaFileInfo {
	/** 文件路径（vault 相对路径或绝对路径） */
	path: string;

	/** 文件名 */
	name: string;

	/** 文件扩展名（不含点） */
	extension: string;

	/** 文件大小（字节） */
	size?: number;

	/** MIME 类型 */
	mimeType?: string;

	/** 是否为音频文件 */
	isAudio: boolean;

	/** 是否为视频文件 */
	isVideo: boolean;
}

/**
 * 文件加载结果
 */
export interface FileLoadResult {
	/** 是否成功 */
	success: boolean;

	/** 文件 URL（blob:// 或 data:// 或 http://） */
	url?: string;

	/** Blob 对象（可选，用于后续清理） */
	blob?: Blob;

	/** 错误信息 */
	error?: string;
}

/**
 * 文件加载适配器接口
 */
export interface IFileLoaderAdapter {
	/**
	 * 搜索媒体文件
	 *
	 * @param query - 搜索关键词（可选）
	 * @returns 媒体文件列表
	 */
	searchMediaFiles(query?: string): Promise<MediaFileInfo[]>;

	/**
	 * 加载文件并返回可用的 URL
	 *
	 * @param fileInfo - 文件信息
	 * @returns 加载结果
	 */
	loadFile(fileInfo: MediaFileInfo): Promise<FileLoadResult>;

	/**
	 * 释放文件资源（revoke blob URL）
	 *
	 * @param url - 要释放的 URL
	 */
	releaseFile(url: string): void;

	/**
	 * 判断适配器是否可用
	 */
	isAvailable(): boolean;
}

/**
 * 媒体文件扩展名常量
 */
export const MEDIA_EXTENSIONS = {
	audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'webm'],
	video: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'm4v', 'ogv'],
} as const;

/**
 * 判断文件是否为音频
 */
export function isAudioFile(extension: string): boolean {
	return (MEDIA_EXTENSIONS.audio as readonly string[]).includes(extension.toLowerCase());
}

/**
 * 判断文件是否为视频
 */
export function isVideoFile(extension: string): boolean {
	return (MEDIA_EXTENSIONS.video as readonly string[]).includes(extension.toLowerCase());
}

/**
 * 判断文件是否为媒体文件
 */
export function isMediaFile(extension: string): boolean {
	return isAudioFile(extension) || isVideoFile(extension);
}
