// src-refactor/utils/EventBus.ts
// 简单的发布-订阅事件总线
export type EventHandler = (payload?: unknown) => void;

export class EventBus {
	private handlers: Map<string, Set<EventHandler>> = new Map();

	subscribe(event: string, handler: EventHandler) {
		if (!this.handlers.has(event)) this.handlers.set(event, new Set());
		this.handlers.get(event)!.add(handler);
	}

	unsubscribe(event: string, handler: EventHandler) {
		this.handlers.get(event)?.delete(handler);
	}

	publish(event: string, payload?: unknown) {
		this.handlers.get(event)?.forEach((fn) => fn(payload));
	}
}
