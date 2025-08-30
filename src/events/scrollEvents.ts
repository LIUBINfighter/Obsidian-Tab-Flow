import * as alphaTab from '@coderline/alphatab';
import { handlePlayerEvent, PlayerEventPayload } from './playerEvents';

export interface ScrollConfigChangeEvent {
	property: keyof alphaTab.PlayerSettings;
	oldValue: unknown;
	newValue: unknown;
}

export interface ScrollEventHandlers {
	onScrollConfigChange?: (event: ScrollConfigChangeEvent) => void;
	onScrollStart?: () => void;
	onScrollEnd?: () => void;
}

/**
 * 滚动事件管理器
 * 将配置驱动转换为事件驱动，并提供统一的事件接口
 */
export class ScrollEventManager {
	private _api: alphaTab.AlphaTabApi;
	private _handlers: ScrollEventHandlers = {};
	private _scrollTimeout: NodeJS.Timeout | null = null;

	constructor(api: alphaTab.AlphaTabApi) {
		this._api = api;
		this._setupScrollDetection();
	}

	/**
	 * 设置事件处理器
	 */
	setEventHandlers(handlers: ScrollEventHandlers): void {
		this._handlers = { ...this._handlers, ...handlers };
	}

	/**
	 * 通过事件方式设置滚动模式
	 */
	setScrollMode(mode: alphaTab.ScrollMode): void {
		const oldValue = this._api.settings.player.scrollMode;
		if (oldValue !== mode) {
			this._emitConfigChangeEvent('scrollMode', oldValue, mode);
			this._dispatchPlayerEvent({
				type: 'setScrollMode',
				value: mode,
			});
		}
	}

	/**
	 * 通过事件方式设置滚动速度
	 */
	setScrollSpeed(speed: number): void {
		const oldValue = this._api.settings.player.scrollSpeed;
		if (oldValue !== speed) {
			this._emitConfigChangeEvent('scrollSpeed', oldValue, speed);
			this._dispatchPlayerEvent({
				type: 'setScrollSpeed',
				value: speed,
			});
		}
	}

	/**
	 * 通过事件方式设置X轴偏移
	 */
	setScrollOffsetX(offset: number): void {
		const oldValue = this._api.settings.player.scrollOffsetX;
		if (oldValue !== offset) {
			this._emitConfigChangeEvent('scrollOffsetX', oldValue, offset);
			this._dispatchPlayerEvent({
				type: 'setScrollOffsetX',
				value: offset,
			});
		}
	}

	/**
	 * 通过事件方式设置Y轴偏移
	 */
	setScrollOffsetY(offset: number): void {
		const oldValue = this._api.settings.player.scrollOffsetY;
		if (oldValue !== offset) {
			this._emitConfigChangeEvent('scrollOffsetY', oldValue, offset);
			this._dispatchPlayerEvent({
				type: 'setScrollOffsetY',
				value: offset,
			});
		}
	}

	/**
	 * 通过事件方式设置原生平滑滚动
	 */
	setNativeBrowserSmoothScroll(enabled: boolean): void {
		const oldValue = this._api.settings.player.nativeBrowserSmoothScroll;
		if (oldValue !== enabled) {
			this._emitConfigChangeEvent('nativeBrowserSmoothScroll', oldValue, enabled);
			this._dispatchPlayerEvent({
				type: 'setNativeBrowserSmoothScroll',
				value: enabled,
			});
		}
	}

	/**
	 * 触发滚动到光标
	 */
	triggerScrollToCursor(): void {
		this._dispatchPlayerEvent({
			type: 'triggerScrollToCursor',
		});
	}

	/**
	 * 获取当前滚动配置
	 */
	getCurrentConfig() {
		return {
			scrollMode: this._api.settings.player.scrollMode,
			scrollSpeed: this._api.settings.player.scrollSpeed,
			scrollOffsetY: this._api.settings.player.scrollOffsetY,
			scrollOffsetX: this._api.settings.player.scrollOffsetX,
			nativeBrowserSmoothScroll: this._api.settings.player.nativeBrowserSmoothScroll,
		};
	}

	/**
	 * 销毁事件管理器
	 */
	destroy(): void {
		if (this._scrollTimeout) {
			clearTimeout(this._scrollTimeout);
			this._scrollTimeout = null;
		}
		this._handlers = {};
	}

	/**
	 * 触发配置变更事件
	 */
	private _emitConfigChangeEvent(
		property: keyof alphaTab.PlayerSettings,
		oldValue: unknown,
		newValue: unknown
	): void {
		if (this._handlers.onScrollConfigChange) {
			this._handlers.onScrollConfigChange({
				property,
				oldValue,
				newValue,
			});
		}
	}

	/**
	 * 分发播放器事件
	 */
	private _dispatchPlayerEvent(payload: PlayerEventPayload): void {
		handlePlayerEvent(this._api, payload);
	}

	/**
	 * 设置滚动检测
	 */
	private _setupScrollDetection(): void {
		// 这里可以添加对滚动开始和结束的检测
		// 由于 alphaTab 的滚动是内部触发的，我们可以通过监听相关事件来实现

		// 检测滚动开始
		const originalScrollToCursor = this._api.scrollToCursor;
		if (originalScrollToCursor) {
			this._api.scrollToCursor = () => {
				if (this._handlers.onScrollStart) {
					this._handlers.onScrollStart();
				}

				originalScrollToCursor.call(this._api);

				// 检测滚动结束（简单的延时检测）
				if (this._scrollTimeout) {
					clearTimeout(this._scrollTimeout);
				}
				this._scrollTimeout = setTimeout(() => {
					if (this._handlers.onScrollEnd) {
						this._handlers.onScrollEnd();
					}
				}, this._api.settings.player.scrollSpeed + 50);
			};
		}
	}
}
