/**
 * 媒体切换服务
 *
 * 统一管理 AlphaTab 的媒体模式切换：
 * - 合成器 (Synth)
 * - 音频文件 (Audio/BackingTrack)
 * - YouTube 视频 (External)
 * - 外部媒体元素 (External)
 *
 * 借鉴官方 playground 示例的设计模式
 */

import type { AlphaTabApi } from '@coderline/alphatab';
import { PlayerMode } from '@coderline/alphatab';
import type { MediaSource } from '../types/media-source';
import { MediaType } from '../types/media-source';

/**
 * 媒体切换选项
 */
export interface MediaSwitchOptions {
	/** 是否在切换后自动播放 */
	autoPlay?: boolean;

	/** 是否保持当前播放位置 */
	preservePosition?: boolean;

	/** 切换完成回调 */
	onSwitchComplete?: () => void;

	/** 切换失败回调 */
	onSwitchError?: (error: Error) => void;
}

/**
 * 媒体切换服务
 */
export class MediaSwitchService {
	private currentMediaSource: MediaSource | null = null;

	constructor(private api: AlphaTabApi) {}

	/**
	 * 切换媒体源
	 *
	 * @param source - 目标媒体源
	 * @param options - 切换选项
	 */
	async switchMedia(source: MediaSource, options: MediaSwitchOptions = {}): Promise<void> {
		const {
			autoPlay = false,
			preservePosition = false,
			onSwitchComplete,
			onSwitchError,
		} = options;

		console.log('[MediaSwitchService] 切换媒体源', {
			from: this.currentMediaSource?.type,
			to: source.type,
			options,
		});

		try {
			// 保存当前播放位置
			const currentPosition = preservePosition ? this.api.tickPosition : 0;

			// 暂停播放
			this.api.pause();

			// 根据媒体类型切换模式
			await this.applySwitchByType(source);

			// 恢复播放位置
			if (preservePosition && currentPosition > 0) {
				this.api.tickPosition = currentPosition;
			}

			// 更新当前媒体源
			this.currentMediaSource = source;

			// 自动播放
			if (autoPlay) {
				this.api.play();
			}

			console.log('[MediaSwitchService] 媒体源切换成功', source.type);
			onSwitchComplete?.();
		} catch (error) {
			console.error('[MediaSwitchService] 媒体源切换失败', error);
			onSwitchError?.(error as Error);
			throw error;
		}
	}

	/**
	 * 根据媒体类型应用切换
	 */
	private async applySwitchByType(source: MediaSource): Promise<void> {
		switch (source.type) {
			case MediaType.Synth:
				await this.switchToSynth();
				break;

			case MediaType.Audio:
				await this.switchToAudio(source);
				break;

			case MediaType.YouTube:
				await this.switchToYouTube(source);
				break;

			case MediaType.External:
				await this.switchToExternal(source);
				break;

			default:
				throw new Error(`不支持的媒体类型: ${(source as any).type}`);
		}
	}

	/**
	 * 切换到合成器模式
	 */
	private async switchToSynth(): Promise<void> {
		console.log('[MediaSwitchService] 切换到合成器模式');

		this.api.settings.player.playerMode = PlayerMode.EnabledSynthesizer;
		this.api.updateSettings();
	}

	/**
	 * 切换到音频文件模式
	 */
	private async switchToAudio(
		source: Extract<MediaSource, { type: MediaType.Audio }>
	): Promise<void> {
		console.log('[MediaSwitchService] 切换到音频文件模式', {
			url: source.url,
			hasBlob: !!source.blob,
			hasAudioFile: !!source.audioFile,
		});

		this.api.settings.player.playerMode = PlayerMode.EnabledBackingTrack;
		this.api.updateSettings();

		// 如果提供了音频文件，需要重新加载曲谱以应用 backing track
		if (source.audioFile && this.api.score) {
			// 注意：这需要曲谱本身包含 backing track 信息
			// 如果是外部音频，需要使用 External 模式
			console.warn('[MediaSwitchService] Audio 模式需要曲谱内置 backing track');
		}
	}

	/**
	 * 切换到 YouTube 模式
	 */
	private async switchToYouTube(
		source: Extract<MediaSource, { type: MediaType.YouTube }>
	): Promise<void> {
		console.log('[MediaSwitchService] 切换到 YouTube 模式', {
			url: source.url,
			offset: source.offset,
		});

		this.api.settings.player.playerMode = PlayerMode.EnabledExternalMedia;
		this.api.updateSettings();

		// 外部媒体处理器将在 ExternalMediaService 中设置
		console.log('[MediaSwitchService] YouTube 模式需要配合 ExternalMediaService 使用');
	}

	/**
	 * 切换到外部媒体模式
	 */
	private async switchToExternal(
		source: Extract<MediaSource, { type: MediaType.External }>
	): Promise<void> {
		console.log('[MediaSwitchService] 切换到外部媒体模式', {
			element: source.element.tagName,
			offset: source.offset,
		});

		this.api.settings.player.playerMode = PlayerMode.EnabledExternalMedia;
		this.api.updateSettings();

		// 外部媒体处理器将在 ExternalMediaService 中设置
		console.log('[MediaSwitchService] External 模式需要配合 ExternalMediaService 使用');
	}

	/**
	 * 获取当前媒体源
	 */
	getCurrentMediaSource(): MediaSource | null {
		return this.currentMediaSource;
	}

	/**
	 * 判断是否可以切换媒体
	 */
	canSwitchMedia(): boolean {
		return this.api !== null && this.api.score !== null;
	}

	/**
	 * 重置到默认媒体源（合成器）
	 */
	async reset(): Promise<void> {
		console.log('[MediaSwitchService] 重置到默认媒体源');

		await this.switchMedia({ type: MediaType.Synth });
	}
}

/**
 * 创建媒体切换服务实例
 */
export function createMediaSwitchService(api: AlphaTabApi): MediaSwitchService {
	return new MediaSwitchService(api);
}
