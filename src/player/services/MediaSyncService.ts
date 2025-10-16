/**
 * 媒体同步服务
 *
 * 独立实现，用于 src/player 模块
 * 实现 AlphaTab 与外部媒体（Audio/Video/YouTube）的双向同步
 */

import type { AlphaTabApi } from '@coderline/alphatab';
import { PlayerMode } from '@coderline/alphatab';
import type * as AlphaTab from '@coderline/alphatab';
import type { MediaElementLike } from '../types/media-sync';

/**
 * 媒体同步服务类
 */
export class MediaSyncService {
	private mediaElement: MediaElementLike | null = null;
	private eventCleanups: Array<() => void> = [];
	private timeOffset = 0; // 时间偏移（毫秒）
	private debugMode = false;

	constructor(private api: AlphaTabApi) {}

	/**
	 * 绑定外部媒体元素
	 */
	bind(element: MediaElementLike, options: { offset?: number; debug?: boolean } = {}): void {
		// 清理之前的绑定
		this.unbind();

		this.mediaElement = element;
		this.timeOffset = options.offset ?? 0;
		this.debugMode = options.debug ?? false;

		this.log('绑定外部媒体元素', {
			duration: element.duration,
			offset: this.timeOffset,
		});

		// 切换到外部媒体模式
		this.enableExternalMediaMode();

		// 设置外部媒体处理器
		this.setupMediaHandler();

		// 绑定媒体元素事件
		this.bindMediaEvents();

		// 初始同步
		this.initialSync();
	}

	/**
	 * 解绑外部媒体元素
	 */
	unbind(): void {
		if (!this.mediaElement) {
			return;
		}

		this.log('解绑外部媒体元素');

		// 清理所有事件监听器
		this.eventCleanups.forEach((cleanup) => cleanup());
		this.eventCleanups = [];

		this.mediaElement = null;

		// 恢复合成器模式
		this.api.settings.player.playerMode = PlayerMode.EnabledSynthesizer;
		this.api.updateSettings();
	}

	/**
	 * 切换到外部媒体模式
	 */
	private enableExternalMediaMode(): void {
		this.api.settings.player.playerMode = PlayerMode.EnabledExternalMedia;
		this.api.updateSettings();
		this.log('已切换到外部媒体模式');
	}

	/**
	 * 设置外部媒体处理器
	 */
	private setupMediaHandler(): void {
		if (!this.mediaElement || !this.api.player?.output) {
			return;
		}

		const mediaElement = this.mediaElement;
		const timeOffset = this.timeOffset;
		const log = this.log.bind(this);

		const handler: AlphaTab.synth.IExternalMediaHandler = {
			// backing track 时长（毫秒）
			get backingTrackDuration(): number {
				const duration = mediaElement?.duration ?? 0;
				return Number.isFinite(duration) ? duration * 1000 : 0;
			},

			// 播放速度
			get playbackRate(): number {
				return mediaElement?.playbackRate ?? 1;
			},
			set playbackRate(value: number) {
				if (mediaElement) {
					log('设置播放速度', value);
					mediaElement.playbackRate = value;
				}
			},

			// 主音量
			get masterVolume(): number {
				return mediaElement?.volume ?? 1;
			},
			set masterVolume(value: number) {
				if (mediaElement) {
					log('设置音量', value);
					mediaElement.volume = value;
				}
			},

			// 跳转
			seekTo(time: number): void {
				if (mediaElement) {
					const targetTime = (time + timeOffset) / 1000;
					log('跳转到', { time, offset: timeOffset, target: targetTime });
					mediaElement.currentTime = targetTime;
				}
			},

			// 播放
			play(): void {
				if (mediaElement) {
					log('播放');
					mediaElement.play();
				}
			},

			// 暂停
			pause(): void {
				if (mediaElement) {
					log('暂停');
					mediaElement.pause();
				}
			},
		};

		// 设置到 AlphaTab
		const output = this.api.player.output as AlphaTab.synth.IExternalMediaSynthOutput;
		output.handler = handler;
		this.log('外部媒体处理器已设置');
	}

	/**
	 * 绑定媒体元素事件
	 */
	private bindMediaEvents(): void {
		if (!this.mediaElement) {
			return;
		}

		const element = this.mediaElement;

		// 元数据加载完成
		const onLoadedMetadata = () => {
			this.log('元数据加载完成', { duration: element.duration });
		};

		// 时间更新（媒体 → AlphaTab）
		const onTimeUpdate = () => {
			if (this.api.actualPlayerMode === PlayerMode.EnabledExternalMedia) {
				const output = this.api.player!.output as AlphaTab.synth.IExternalMediaSynthOutput;
				const position = element.currentTime * 1000 - this.timeOffset;
				output.updatePosition(position);
			}
		};

		// 播放事件（媒体 → AlphaTab）
		const onPlay = () => {
			this.log('媒体元素播放');
			this.api.play();
		};

		// 暂停事件（媒体 → AlphaTab）
		const onPause = () => {
			this.log('媒体元素暂停');
			this.api.pause();
		};

		// 结束事件
		const onEnded = () => {
			this.log('媒体元素播放结束');
			this.api.pause();
		};

		// 音量变化（媒体 → AlphaTab）
		const onVolumeChange = () => {
			this.log('音量变化', element.volume);
			this.api.masterVolume = element.volume;
		};

		// 播放速度变化（媒体 → AlphaTab）
		const onRateChange = () => {
			this.log('播放速度变化', element.playbackRate);
			this.api.playbackSpeed = element.playbackRate;
		};

		// 注册所有事件
		element.addEventListener('loadedmetadata', onLoadedMetadata);
		element.addEventListener('timeupdate', onTimeUpdate);
		element.addEventListener('seeked', onTimeUpdate);
		element.addEventListener('play', onPlay);
		element.addEventListener('pause', onPause);
		element.addEventListener('ended', onEnded);
		element.addEventListener('volumechange', onVolumeChange);
		element.addEventListener('ratechange', onRateChange);

		// 保存清理函数
		this.eventCleanups.push(() => {
			element.removeEventListener('loadedmetadata', onLoadedMetadata);
			element.removeEventListener('timeupdate', onTimeUpdate);
			element.removeEventListener('seeked', onTimeUpdate);
			element.removeEventListener('play', onPlay);
			element.removeEventListener('pause', onPause);
			element.removeEventListener('ended', onEnded);
			element.removeEventListener('volumechange', onVolumeChange);
			element.removeEventListener('ratechange', onRateChange);
		});

		this.log('媒体事件已绑定');
	}

	/**
	 * 初始同步
	 */
	private initialSync(): void {
		if (!this.mediaElement) {
			return;
		}

		// 同步音量和速度
		this.api.masterVolume = this.mediaElement.volume;
		this.api.playbackSpeed = this.mediaElement.playbackRate;

		this.log('初始同步完成', {
			volume: this.mediaElement.volume,
			playbackRate: this.mediaElement.playbackRate,
		});
	}

	/**
	 * 设置时间偏移
	 */
	setTimeOffset(offset: number): void {
		this.timeOffset = offset;
		this.log('时间偏移已更新', offset);
	}

	/**
	 * 获取当前绑定的媒体元素
	 */
	getMediaElement(): MediaElementLike | null {
		return this.mediaElement;
	}

	/**
	 * 判断是否已绑定
	 */
	isBound(): boolean {
		return this.mediaElement !== null;
	}

	/**
	 * 日志输出（调试模式）
	 */
	private log(message: string, data?: any): void {
		if (!this.debugMode) {
			return;
		}
		console.log(`[MediaSyncService] ${message}`, data ?? '');
	}

	/**
	 * 销毁服务
	 */
	destroy(): void {
		this.unbind();
	}
}
