// ExternalMediaService.ts - 外部音频集成服务
import * as alphaTab from "@coderline/alphatab";
import { EventBus } from "../utils/EventBus";

/**
 * 外部媒体集成服务
 * 用于将 alphaTab 与外部音频/视频播放器同步
 */
export class ExternalMediaService {
    private api: alphaTab.AlphaTabApi;
    private eventBus: EventBus;
    private mediaElement: HTMLMediaElement | null = null;
    private updateTimer: number | null = null;
    private updateInterval: number = 50; // 默认更新间隔 50ms

    constructor(api: alphaTab.AlphaTabApi, eventBus: EventBus) {
        this.api = api;
        this.eventBus = eventBus;
        
        // 初始化事件监听
        this.initEventHandlers();
    }

    /**
     * 连接外部媒体元素（如audio或video标签）
     * @param element HTML媒体元素
     */
    public connectMedia(element: HTMLMediaElement): void {
        // 如果已有连接的媒体元素，先断开
        if (this.mediaElement) {
            this.disconnectMedia();
        }

        this.mediaElement = element;
        
        // 启用外部媒体模式
        if (this.api.settings.player) {
            this.api.settings.player.playerMode = alphaTab.PlayerMode.EnabledExternalMedia;
            this.api.updateSettings();
        }
        
        // 设置外部媒体处理器
        this.setupExternalMediaHandler();
        
        // 添加媒体元素事件监听
        this.addMediaEventListeners();
        
        console.debug("[ExternalMediaService] 已连接外部媒体元素");
    }

    /**
     * 断开外部媒体连接
     */
    public disconnectMedia(): void {
        if (!this.mediaElement) return;
        
        // 移除事件监听
        this.removeMediaEventListeners();
        
        // 清除更新计时器
        if (this.updateTimer) {
            window.clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        // 恢复默认播放模式
        if (this.api.settings.player) {
            // 回退到自动模式
            this.api.settings.player.playerMode = alphaTab.PlayerMode.EnabledAutomatic;
            this.api.updateSettings();
        }
        
        this.mediaElement = null;
        console.debug("[ExternalMediaService] 已断开外部媒体元素");
    }

    /**
     * 设置位置更新间隔
     * @param interval 毫秒
     */
    public setUpdateInterval(interval: number): void {
        this.updateInterval = interval;
        
        // 如果正在更新，重启更新计时器
        if (this.updateTimer) {
            window.clearInterval(this.updateTimer);
            this.startPositionUpdates();
        }
    }

    /**
     * 初始化事件监听
     */
    private initEventHandlers(): void {
        // 监听 alphaTab API 相关事件
        if (this.api.playerStateChanged) {
            this.api.playerStateChanged.on((args) => {
                // 当 alphaTab 状态改变时，同步外部媒体
                if (this.mediaElement) {
                    // PlayerState: 1 通常表示 Playing
                    if ((args as any).state === 1) {
                        this.mediaElement.play().catch(err => {
                            console.error('[ExternalMediaService] 播放外部媒体失败:', err);
                        });
                    } else {
                        this.mediaElement.pause();
                    }
                }
            });
        }
        
        // 监听事件总线上的相关事件
        this.eventBus.subscribe('playback:volumeChanged', (volume: number) => {
            if (this.mediaElement) {
                this.mediaElement.volume = volume;
            }
        });
        
        this.eventBus.subscribe('playback:speedChanged', (speed: number) => {
            if (this.mediaElement) {
                this.mediaElement.playbackRate = speed;
            }
        });
    }

    /**
     * 设置外部媒体处理器
     */
    private setupExternalMediaHandler(): void {
        if (!this.mediaElement || !this.api.player || !this.api.player.output) return;
        const self = this;
        const handler: alphaTab.synth.IExternalMediaHandler = {
            get backingTrackDuration() {
                if (!self.mediaElement) return 0;
                const duration = self.mediaElement.duration;
                return Number.isFinite(duration) ? duration * 1000 : 0;
            },
            get playbackRate() {
                return self.mediaElement?.playbackRate || 1;
            },
            set playbackRate(value: number) {
                if (self.mediaElement) {
                    self.mediaElement.playbackRate = value;
                }
            },
            get masterVolume() {
                return self.mediaElement?.volume || 1;
            },
            set masterVolume(value: number) {
                if (self.mediaElement) {
                    self.mediaElement.volume = value;
                }
            },
            seekTo(time: number) {
                if (self.mediaElement) {
                    self.mediaElement.currentTime = time / 1000;
                }
            },
            play() {
                if (self.mediaElement) {
                    self.mediaElement.play().catch(err => {
                        console.error('[ExternalMediaService] 播放外部媒体失败:', err);
                    });
                }
            },
            pause() {
                if (self.mediaElement) {
                    self.mediaElement.pause();
                }
            }
        };
        
        // 设置外部媒体处理器
        // @ts-ignore - 类型兼容性问题
        (this.api.player.output as alphaTab.synth.IExternalMediaSynthOutput).handler = handler;
    }

    /**
     * 添加媒体元素事件监听
     */
    private addMediaEventListeners(): void {
        if (!this.mediaElement) return;
        
        // 时间更新事件
        this.mediaElement.addEventListener('timeupdate', this.onTimeUpdate);
        this.mediaElement.addEventListener('seeked', this.onTimeUpdate);
        
        // 状态事件
        this.mediaElement.addEventListener('play', this.onPlay);
        this.mediaElement.addEventListener('pause', this.onPause);
        this.mediaElement.addEventListener('ended', this.onEnded);
        
        // 其他事件
        this.mediaElement.addEventListener('volumechange', this.onVolumeChange);
        this.mediaElement.addEventListener('ratechange', this.onRateChange);
    }
    
    /**
     * 移除媒体元素事件监听
     */
    private removeMediaEventListeners(): void {
        if (!this.mediaElement) return;
        
        // 移除所有事件监听
        this.mediaElement.removeEventListener('timeupdate', this.onTimeUpdate);
        this.mediaElement.removeEventListener('seeked', this.onTimeUpdate);
        this.mediaElement.removeEventListener('play', this.onPlay);
        this.mediaElement.removeEventListener('pause', this.onPause);
        this.mediaElement.removeEventListener('ended', this.onEnded);
        this.mediaElement.removeEventListener('volumechange', this.onVolumeChange);
        this.mediaElement.removeEventListener('ratechange', this.onRateChange);
    }

    /**
     * 开始位置更新
     */
    private startPositionUpdates(): void {
        if (!this.mediaElement || this.updateTimer) return;
        
        this.updateTimer = window.setInterval(this.onTimeUpdate, this.updateInterval);
    }
    
    /**
     * 停止位置更新
     */
    private stopPositionUpdates(): void {
        if (this.updateTimer) {
            window.clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    // 媒体元素事件处理函数
    private onTimeUpdate = (): void => {
        if (!this.mediaElement || !this.api.player?.output) return;
        
        // @ts-ignore - 类型兼容性问题
        (this.api.player.output as alphaTab.synth.IExternalMediaSynthOutput).updatePosition(
            this.mediaElement.currentTime * 1000
        );
    };
    
    private onPlay = (): void => {
        // 启动更新计时器
        this.startPositionUpdates();
        
        // 通知 alphaTab 播放
        if (this.api.playbackRange) {
            this.api.playbackRange.startTick = 0;
            // 使用 duration（毫秒）估算 endTick 不可靠；保留 0 让 alphaTab 自行处理
            // 这里仅尽量不访问不存在的属性
            this.api.playbackRange.endTick = this.api.playbackRange.endTick || 0;
        }
        this.api.play();
        
        // 通知事件总线
        this.eventBus.publish('playback:started');
    };
    
    private onPause = (): void => {
        // 停止更新计时器
        this.stopPositionUpdates();
        
        // 通知 alphaTab 暂停
        this.api.pause();
        
        // 通知事件总线
        this.eventBus.publish('playback:paused');
    };
    
    private onEnded = (): void => {
        // 停止更新计时器
        this.stopPositionUpdates();
        
        // 通知 alphaTab 暂停
        this.api.pause();
        
        // 通知事件总线
        this.eventBus.publish('playback:finished');
    };
    
    private onVolumeChange = (): void => {
        if (!this.mediaElement) return;
        
        // 更新 alphaTab 音量
        this.api.masterVolume = this.mediaElement.volume;
        
        // 通知事件总线
        this.eventBus.publish('playback:volumeChanged', this.mediaElement.volume);
    };
    
    private onRateChange = (): void => {
        if (!this.mediaElement) return;
        
        // 更新 alphaTab 播放速度
        this.api.playbackSpeed = this.mediaElement.playbackRate;
        
        // 通知事件总线
        this.eventBus.publish('playback:speedChanged', this.mediaElement.playbackRate);
    };

    /**
     * 销毁服务，释放资源
     */
    public destroy(): void {
        this.disconnectMedia();
    }
}
