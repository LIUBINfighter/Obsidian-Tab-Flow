/**
 * 外部媒体同步服务
 *
 * 实现 AlphaTab 与外部媒体元素（YouTube、Audio、Video）的双向同步
 * 借鉴官方 playground 示例的设计模式
 */

import type { AlphaTabApi } from '@coderline/alphatab';
import { PlayerMode } from '@coderline/alphatab';
import type * as AlphaTab from '@coderline/alphatab';

/**
 * 外部媒体元素类型（兼容 HTMLMediaElement 接口）
 */
export interface ExternalMediaElement {
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
 * 外部媒体同步选项
 */
export interface ExternalMediaSyncOptions {
	/** 媒体偏移量（毫秒） */
	offset?: number;

	/** 是否在加载完成后自动同步音量 */
	syncVolume?: boolean;

	/** 是否在加载完成后自动同步播放速度 */
	syncPlaybackRate?: boolean;

	/** 调试模式（输出同步日志） */
	debug?: boolean;
}

/**
 * 外部媒体同步服务
 */
export class ExternalMediaService {
	private mediaElement: ExternalMediaElement | null = null;
	private cleanupFunctions: Array<() => void> = [];
	private options: ExternalMediaSyncOptions = {};

	constructor(private api: AlphaTabApi) {}

	/**
	 * 绑定外部媒体元素
	 *
	 * @param element - 外部媒体元素
	 * @param options - 同步选项
	 */
	bind(element: ExternalMediaElement, options: ExternalMediaSyncOptions = {}): void {
		// 清理之前的绑定
		this.unbind();

		this.mediaElement = element;
		this.options = {
			offset: 0,
			syncVolume: true,
			syncPlaybackRate: true,
			debug: false,
			...options,
		};

		this.log('绑定外部媒体元素', {
			duration: element.duration,
			options: this.options,
		});

		// 设置外部媒体处理器
		this.setupExternalMediaHandler();

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

		// 执行所有清理函数
		this.cleanupFunctions.forEach((cleanup) => cleanup());
		this.cleanupFunctions = [];

		this.mediaElement = null;
	}

	/**
	 * 设置外部媒体处理器
	 */
	private setupExternalMediaHandler(): void {
		if (!this.mediaElement) {
			return;
		}

		const mediaElement = this.mediaElement;
		const options = this.options;
		const log = this.log.bind(this);

		const handler: AlphaTab.synth.IExternalMediaHandler = {
			// 获取 backing track 时长（毫秒）
			get backingTrackDuration(): number {
				const duration = mediaElement?.duration ?? 0;
				return Number.isFinite(duration) ? duration * 1000 : 0;
			},

			// 获取播放速度
			get playbackRate(): number {
				return mediaElement?.playbackRate ?? 1;
			},

			// 设置播放速度
			set playbackRate(value: number) {
				if (mediaElement) {
					log('设置播放速度', value);
					mediaElement.playbackRate = value;
				}
			},

			// 获取主音量
			get masterVolume(): number {
				return mediaElement?.volume ?? 1;
			},

			// 设置主音量
			set masterVolume(value: number) {
				if (mediaElement) {
					log('设置音量', value);
					mediaElement.volume = value;
				}
			},

			// 跳转到指定位置
			seekTo(time: number): void {
				if (mediaElement) {
					const offset = options.offset ?? 0;
					const targetTime = (time + offset) / 1000; // 转换为秒
					log('跳转到位置', { time, offset, targetTime });
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

		// 设置处理器到 AlphaTab
		if (this.api.player && this.api.player.output) {
			const output = this.api.player.output as AlphaTab.synth.IExternalMediaSynthOutput;
			output.handler = handler;
			this.log('外部媒体处理器已设置');
		}
	}

	/**
	 * 绑定媒体元素事件
	 */
	private bindMediaEvents(): void {
		if (!this.mediaElement) {
			return;
		}

		// 元数据加载完成
		const onLoadedMetadata = () => {
			this.log('元数据加载完成', {
				duration: this.mediaElement!.duration,
			});
		};

		// 时间更新（媒体 → AlphaTab）
		const onTimeUpdate = () => {
			if (this.api.actualPlayerMode === PlayerMode.EnabledExternalMedia) {
				const output = this.api.player!.output as AlphaTab.synth.IExternalMediaSynthOutput;
				const offset = this.options.offset ?? 0;
				const position = this.mediaElement!.currentTime * 1000 - offset;
				output.updatePosition(position);

				this.log(
					'时间更新',
					{
						currentTime: this.mediaElement!.currentTime,
						position,
						offset,
					},
					true
				); // 减少日志输出频率
			}
		};

		// 播放事件（媒体 → AlphaTab）
		const onPlay = () => {
			this.log('媒体元素开始播放');
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
			if (this.options.syncVolume) {
				this.log('音量变化', this.mediaElement!.volume);
				this.api.masterVolume = this.mediaElement!.volume;
			}
		};

		// 播放速度变化（媒体 → AlphaTab）
		const onRateChange = () => {
			if (this.options.syncPlaybackRate) {
				this.log('播放速度变化', this.mediaElement!.playbackRate);
				this.api.playbackSpeed = this.mediaElement!.playbackRate;
			}
		};

		// 注册事件监听器
		this.mediaElement.addEventListener('loadedmetadata', onLoadedMetadata);
		this.mediaElement.addEventListener('timeupdate', onTimeUpdate);
		this.mediaElement.addEventListener('seeked', onTimeUpdate);
		this.mediaElement.addEventListener('play', onPlay);
		this.mediaElement.addEventListener('pause', onPause);
		this.mediaElement.addEventListener('ended', onEnded);
		this.mediaElement.addEventListener('volumechange', onVolumeChange);
		this.mediaElement.addEventListener('ratechange', onRateChange);

		// 保存清理函数
		this.cleanupFunctions.push(() => {
			this.mediaElement!.removeEventListener('loadedmetadata', onLoadedMetadata);
			this.mediaElement!.removeEventListener('timeupdate', onTimeUpdate);
			this.mediaElement!.removeEventListener('seeked', onTimeUpdate);
			this.mediaElement!.removeEventListener('play', onPlay);
			this.mediaElement!.removeEventListener('pause', onPause);
			this.mediaElement!.removeEventListener('ended', onEnded);
			this.mediaElement!.removeEventListener('volumechange', onVolumeChange);
			this.mediaElement!.removeEventListener('ratechange', onRateChange);
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

		// 同步音量
		if (this.options.syncVolume) {
			this.api.masterVolume = this.mediaElement.volume;
		}

		// 同步播放速度
		if (this.options.syncPlaybackRate) {
			this.api.playbackSpeed = this.mediaElement.playbackRate;
		}

		this.log('初始同步完成', {
			volume: this.mediaElement.volume,
			playbackRate: this.mediaElement.playbackRate,
		});
	}

	/**
	 * 获取当前绑定的媒体元素
	 */
	getMediaElement(): ExternalMediaElement | null {
		return this.mediaElement;
	}

	/**
	 * 判断是否已绑定媒体元素
	 */
	isBound(): boolean {
		return this.mediaElement !== null;
	}

	/**
	 * 日志输出（仅在调试模式下）
	 */
	private log(message: string, data?: any, throttle = false): void {
		if (!this.options.debug) {
			return;
		}

		// 简单的节流（避免 timeupdate 事件刷屏）
		if (throttle && Math.random() > 0.1) {
			return;
		}

		console.log(`[ExternalMediaService] ${message}`, data ?? '');
	}
}

/**
 * 创建外部媒体同步服务实例
 */
export function createExternalMediaService(api: AlphaTabApi): ExternalMediaService {
	return new ExternalMediaService(api);
}
