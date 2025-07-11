import * as alphaTab from "@coderline/alphatab";
import { ScrollEventManager, ScrollConfigChangeEvent } from "../events/scrollEvents";

/**
 * @deprecated 使用 ScrollEventManager 替代
 * 滚动配置代理类 - 兼容旧代码
 */
export class ScrollConfigProxy {
    private _scrollEventManager: ScrollEventManager;

    constructor(api: alphaTab.AlphaTabApi) {
        this._scrollEventManager = new ScrollEventManager(api);
    }

    /**
     * 添加配置变更监听器
     */
    onConfigChange(listener: (event: ScrollConfigChangeEvent) => void): void {
        this._scrollEventManager.setEventHandlers({
            onScrollConfigChange: listener
        });
    }

    /**
     * 移除配置变更监听器
     */
    offConfigChange(listener: (event: ScrollConfigChangeEvent) => void): void {
        // 由于新的事件管理器使用对象方式设置处理器，这里简单清空
        this._scrollEventManager.setEventHandlers({});
    }

    /**
     * 设置滚动模式
     */
    setScrollMode(mode: alphaTab.ScrollMode): void {
        this._scrollEventManager.setScrollMode(mode);
    }

    /**
     * 设置滚动速度
     */
    setScrollSpeed(speed: number): void {
        this._scrollEventManager.setScrollSpeed(speed);
    }

    /**
     * 设置Y轴偏移
     */
    setScrollOffsetY(offset: number): void {
        this._scrollEventManager.setScrollOffsetY(offset);
    }

    /**
     * 设置X轴偏移
     */
    setScrollOffsetX(offset: number): void {
        this._scrollEventManager.setScrollOffsetX(offset);
    }

    /**
     * 设置原生平滑滚动
     */
    setNativeBrowserSmoothScroll(enabled: boolean): void {
        this._scrollEventManager.setNativeBrowserSmoothScroll(enabled);
    }

    /**
     * 获取当前配置
     */
    getCurrentConfig() {
        return this._scrollEventManager.getCurrentConfig();
    }

    /**
     * 手动触发滚动到光标
     */
    triggerScrollToCursor(): void {
        this._scrollEventManager.triggerScrollToCursor();
    }

    /**
     * 销毁代理
     */
    destroy(): void {
        this._scrollEventManager.destroy();
    }
}
