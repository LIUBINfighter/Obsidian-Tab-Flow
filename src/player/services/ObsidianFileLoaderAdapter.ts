/**
 * Obsidian 文件加载适配器
 *
 * 用于在 Obsidian vault 中搜索和加载媒体文件
 */

import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import type { IFileLoaderAdapter, MediaFileInfo, FileLoadResult } from './IFileLoaderAdapter';
import { isAudioFile, isVideoFile, isMediaFile } from './IFileLoaderAdapter';

export class ObsidianFileLoaderAdapter implements IFileLoaderAdapter {
	private blobUrls: Map<string, string> = new Map();

	constructor(private app: App) {}

	/**
	 * 搜索 vault 中的媒体文件
	 */
	async searchMediaFiles(query?: string): Promise<MediaFileInfo[]> {
		const files = this.app.vault.getFiles();
		const mediaFiles: MediaFileInfo[] = [];

		for (const file of files) {
			const extension = file.extension.toLowerCase();

			// 只处理媒体文件
			if (!isMediaFile(extension)) {
				continue;
			}

			// 如果有查询条件，进行过滤
			if (query && query.trim()) {
				const lowerQuery = query.toLowerCase();
				const lowerName = file.name.toLowerCase();
				const lowerPath = file.path.toLowerCase();

				// 检查文件名或路径是否包含查询词
				if (!lowerName.includes(lowerQuery) && !lowerPath.includes(lowerQuery)) {
					continue;
				}
			}

			mediaFiles.push({
				path: file.path,
				name: file.name,
				extension: file.extension,
				size: file.stat.size,
				mimeType: this.getMimeType(extension),
				isAudio: isAudioFile(extension),
				isVideo: isVideoFile(extension),
			});
		}

		// 按文件名排序
		mediaFiles.sort((a, b) => a.name.localeCompare(b.name));

		return mediaFiles;
	}

	/**
	 * 加载文件并转换为 Blob URL
	 */
	async loadFile(fileInfo: MediaFileInfo): Promise<FileLoadResult> {
		try {
			// 获取文件对象
			const file = this.app.vault.getAbstractFileByPath(fileInfo.path);

			if (!(file instanceof TFile)) {
				return {
					success: false,
					error: `文件不存在: ${fileInfo.path}`,
				};
			}

			// 读取文件为 ArrayBuffer
			const arrayBuffer = await this.app.vault.readBinary(file);

			// 创建 Blob
			const mimeType = fileInfo.mimeType || this.getMimeType(fileInfo.extension);
			const blob = new Blob([arrayBuffer], { type: mimeType });

			// 创建 Blob URL
			const url = URL.createObjectURL(blob);

			// 保存引用以便后续清理
			this.blobUrls.set(url, fileInfo.path);

			return {
				success: true,
				url,
				blob,
			};
		} catch (error) {
			console.error('[ObsidianFileLoaderAdapter] Failed to load file:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * 释放 Blob URL
	 */
	releaseFile(url: string): void {
		if (this.blobUrls.has(url)) {
			URL.revokeObjectURL(url);
			this.blobUrls.delete(url);
		}
	}

	/**
	 * 释放所有 Blob URL
	 */
	releaseAll(): void {
		this.blobUrls.forEach((_, url) => {
			URL.revokeObjectURL(url);
		});
		this.blobUrls.clear();
	}

	/**
	 * 判断适配器是否可用
	 */
	isAvailable(): boolean {
		return !!this.app?.vault;
	}

	/**
	 * 根据扩展名获取 MIME 类型
	 */
	private getMimeType(extension: string): string {
		const ext = extension.toLowerCase();

		// 音频 MIME 类型
		const audioMimeTypes: Record<string, string> = {
			mp3: 'audio/mpeg',
			wav: 'audio/wav',
			ogg: 'audio/ogg',
			flac: 'audio/flac',
			aac: 'audio/aac',
			m4a: 'audio/mp4',
			wma: 'audio/x-ms-wma',
			opus: 'audio/opus',
			webm: 'audio/webm',
		};

		// 视频 MIME 类型
		const videoMimeTypes: Record<string, string> = {
			mp4: 'video/mp4',
			webm: 'video/webm',
			mkv: 'video/x-matroska',
			avi: 'video/x-msvideo',
			mov: 'video/quicktime',
			wmv: 'video/x-ms-wmv',
			flv: 'video/x-flv',
			m4v: 'video/x-m4v',
			ogv: 'video/ogg',
		};

		return audioMimeTypes[ext] || videoMimeTypes[ext] || 'application/octet-stream';
	}

	/**
	 * 销毁适配器
	 */
	destroy(): void {
		this.releaseAll();
	}
}
