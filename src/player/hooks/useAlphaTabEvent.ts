/**
 * useAlphaTabEvent Hook
 * 
 * 简化 AlphaTab 事件监听管理，自动处理事件清理
 * 借鉴官方 playground 示例的设计模式
 * 
 * ⚠️ 注意：AlphaTab 的事件 API 是 api.eventName.on(handler)，不是 api.on(eventName, handler)
 * 
 * @example
 * ```tsx
 * // 基础用法
 * useAlphaTabEvent(api, 'renderFinished', () => {
 *     console.log('渲染完成');
 * });
 * 
 * // 带参数的事件
 * useAlphaTabEvent<Score>(api, 'scoreLoaded', (score) => {
 *     console.log('曲谱加载完成', score.title);
 * });
 * 
 * // 带依赖的回调
 * useAlphaTabEvent(api, 'playerStateChanged', (state) => {
 *     updateUI(state); // updateUI 变化时会重新注册事件
 * }, [updateUI]);
 * ```
 */

import { useEffect, useRef } from 'react';
import type { AlphaTabApi } from '@coderline/alphatab';

/**
 * AlphaTab 事件处理器类型
 */
export type AlphaTabEventHandler<TEventArgs = void> = (args: TEventArgs) => void;

/**
 * AlphaTab 事件名称类型（部分常用事件）
 * 完整事件列表请参考 AlphaTab 文档
 */
export type AlphaTabEventName =
    // 渲染事件
    | 'renderStarted'
    | 'renderFinished'
    | 'resize'
    | 'postRenderFinished'
    
    // 曲谱事件
    | 'scoreLoaded'
    | 'loaded'
    
    // 播放器事件
    | 'playerReady'
    | 'playerStateChanged'
    | 'playerPositionChanged'
    | 'playerFinished'
    | 'soundFontLoaded'
    | 'midiLoaded'
    | 'midiLoad'
    
    // 错误事件
    | 'error'
    
    // 其他事件
    | 'beatMouseDown'
    | 'beatMouseMove'
    | 'beatMouseUp';

/**
 * AlphaTab 事件监听 Hook
 * 
 * 自动管理事件监听器的注册和清理：
 * - 在 API 可用时注册事件监听器
 * - 在组件卸载或依赖变化时自动清理
 * - 支持类型安全的事件参数
 * 
 * @param api - AlphaTab API 实例
 * @param eventName - 事件名称（如 'renderFinished'、'scoreLoaded' 等）
 * @param handler - 事件处理函数
 * @param deps - 额外的依赖项（可选）
 */
export function useAlphaTabEvent<TEventArgs = void>(
    api: AlphaTabApi | null,
    eventName: AlphaTabEventName | string,
    handler: AlphaTabEventHandler<TEventArgs>,
    deps: React.DependencyList = []
): void {
    // 使用 useRef 保存最新的 handler，避免频繁重新注册事件
    const handlerRef = useRef(handler);
    
    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);
    
    useEffect(() => {
        if (!api) {
            return;
        }
        
        // AlphaTab 的事件对象在 API 上（如 api.renderFinished）
        const eventObject = (api as any)[eventName];
        
        if (!eventObject || typeof eventObject.on !== 'function') {
            console.warn(`[useAlphaTabEvent] 事件不存在或无效: ${eventName}`);
            return;
        }
        
        console.log(`[useAlphaTabEvent] 注册事件: ${eventName}`);
        
        // 创建稳定的事件处理器（调用最新的 handler）
        const eventHandler = (args: TEventArgs) => {
            handlerRef.current(args);
        };
        
        // 注册事件监听器：api.eventName.on(handler)
        eventObject.on(eventHandler);
        
        // 清理函数：取消事件监听
        return () => {
            console.log(`[useAlphaTabEvent] 清理事件: ${eventName}`);
            eventObject.off(eventHandler);
        };
    }, [api, eventName, ...deps]);
}

/**
 * 批量注册 AlphaTab 事件
 * 
 * @example
 * ```tsx
 * useAlphaTabEvents(api, {
 *     renderFinished: () => setLoading(false),
 *     scoreLoaded: (score) => setTitle(score.title),
 *     error: (error) => showError(error.message)
 * });
 * ```
 */
export function useAlphaTabEvents(
    api: AlphaTabApi | null,
    events: Record<string, AlphaTabEventHandler<any>>
): void {
    useEffect(() => {
        if (!api) {
            return;
        }
        
        console.log('[useAlphaTabEvents] 批量注册事件', Object.keys(events));
        
        const cleanups: Array<() => void> = [];
        
        // 注册所有事件
        Object.entries(events).forEach(([eventName, handler]) => {
            const eventObject = (api as any)[eventName];
            
            if (eventObject && typeof eventObject.on === 'function') {
                eventObject.on(handler);
                cleanups.push(() => eventObject.off(handler));
            } else {
                console.warn(`[useAlphaTabEvents] 事件不存在或无效: ${eventName}`);
            }
        });
        
        // 清理所有事件
        return () => {
            console.log('[useAlphaTabEvents] 批量清理事件', Object.keys(events));
            cleanups.forEach(cleanup => cleanup());
        };
    }, [api, events]);
}

/**
 * 一次性事件监听 Hook
 * 事件触发一次后自动取消监听
 * 
 * @example
 * ```tsx
 * useAlphaTabEventOnce(api, 'renderFinished', () => {
 *     console.log('首次渲染完成，此事件不会再次触发');
 * });
 * ```
 */
export function useAlphaTabEventOnce<TEventArgs = void>(
    api: AlphaTabApi | null,
    eventName: AlphaTabEventName | string,
    handler: AlphaTabEventHandler<TEventArgs>
): void {
    const hasTriggered = useRef(false);
    
    useEffect(() => {
        if (!api || hasTriggered.current) {
            return;
        }
        
        const eventObject = (api as any)[eventName];
        
        if (!eventObject || typeof eventObject.on !== 'function') {
            console.warn(`[useAlphaTabEventOnce] 事件不存在或无效: ${eventName}`);
            return;
        }
        
        console.log(`[useAlphaTabEventOnce] 注册一次性事件: ${eventName}`);
        
        const eventHandler = (args: TEventArgs) => {
            if (!hasTriggered.current) {
                hasTriggered.current = true;
                handler(args);
                eventObject.off(eventHandler);
                console.log(`[useAlphaTabEventOnce] 事件已触发并清理: ${eventName}`);
            }
        };
        
        eventObject.on(eventHandler);
        
        return () => {
            eventObject.off(eventHandler);
        };
    }, [api, eventName, handler]);
}

/**
 * 条件事件监听 Hook
 * 仅在条件满足时注册事件
 * 
 * @example
 * ```tsx
 * useAlphaTabEventConditional(
 *     api,
 *     'playerPositionChanged',
 *     (position) => updateTimeline(position),
 *     isPlaying // 仅在播放时监听位置变化
 * );
 * ```
 */
export function useAlphaTabEventConditional<TEventArgs = void>(
    api: AlphaTabApi | null,
    eventName: AlphaTabEventName | string,
    handler: AlphaTabEventHandler<TEventArgs>,
    condition: boolean
): void {
    useEffect(() => {
        if (!api || !condition) {
            return;
        }
        
        const eventObject = (api as any)[eventName];
        
        if (!eventObject || typeof eventObject.on !== 'function') {
            console.warn(`[useAlphaTabEventConditional] 事件不存在或无效: ${eventName}`);
            return;
        }
        
        console.log(`[useAlphaTabEventConditional] 条件满足，注册事件: ${eventName}`);
        
        eventObject.on(handler);
        
        return () => {
            console.log(`[useAlphaTabEventConditional] 条件变化，清理事件: ${eventName}`);
            eventObject.off(handler);
        };
    }, [api, eventName, handler, condition]);
}

/**
 * 防抖事件监听 Hook
 * 事件触发后延迟执行，多次触发只执行最后一次
 * 
 * @example
 * ```tsx
 * useAlphaTabEventDebounced(
 *     api,
 *     'resize',
 *     () => updateLayout(),
 *     300 // 300ms 防抖
 * );
 * ```
 */
export function useAlphaTabEventDebounced<TEventArgs = void>(
    api: AlphaTabApi | null,
    eventName: AlphaTabEventName | string,
    handler: AlphaTabEventHandler<TEventArgs>,
    delay: number
): void {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    useEffect(() => {
        if (!api) {
            return;
        }
        
        const eventObject = (api as any)[eventName];
        
        if (!eventObject || typeof eventObject.on !== 'function') {
            console.warn(`[useAlphaTabEventDebounced] 事件不存在或无效: ${eventName}`);
            return;
        }
        
        console.log(`[useAlphaTabEventDebounced] 注册防抖事件: ${eventName}, delay=${delay}ms`);
        
        const eventHandler = (args: TEventArgs) => {
            // 清除之前的定时器
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            
            // 设置新的定时器
            timeoutRef.current = setTimeout(() => {
                handler(args);
            }, delay);
        };
        
        eventObject.on(eventHandler);
        
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            eventObject.off(eventHandler);
        };
    }, [api, eventName, handler, delay]);
}

/**
 * 节流事件监听 Hook
 * 限制事件处理函数的执行频率
 * 
 * @example
 * ```tsx
 * useAlphaTabEventThrottled(
 *     api,
 *     'playerPositionChanged',
 *     (position) => updateTimeline(position),
 *     100 // 每 100ms 最多执行一次
 * );
 * ```
 */
export function useAlphaTabEventThrottled<TEventArgs = void>(
    api: AlphaTabApi | null,
    eventName: AlphaTabEventName | string,
    handler: AlphaTabEventHandler<TEventArgs>,
    interval: number
): void {
    const lastExecutionRef = useRef<number>(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    useEffect(() => {
        if (!api) {
            return;
        }
        
        const eventObject = (api as any)[eventName];
        
        if (!eventObject || typeof eventObject.on !== 'function') {
            console.warn(`[useAlphaTabEventThrottled] 事件不存在或无效: ${eventName}`);
            return;
        }
        
        console.log(`[useAlphaTabEventThrottled] 注册节流事件: ${eventName}, interval=${interval}ms`);
        
        const eventHandler = (args: TEventArgs) => {
            const now = Date.now();
            const timeSinceLastExecution = now - lastExecutionRef.current;
            
            if (timeSinceLastExecution >= interval) {
                // 立即执行
                handler(args);
                lastExecutionRef.current = now;
            } else {
                // 延迟执行（确保最后一次调用被执行）
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
                
                timeoutRef.current = setTimeout(() => {
                    handler(args);
                    lastExecutionRef.current = Date.now();
                }, interval - timeSinceLastExecution);
            }
        };
        
        eventObject.on(eventHandler);
        
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            eventObject.off(eventHandler);
        };
    }, [api, eventName, handler, interval]);
}
