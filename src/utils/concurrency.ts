const MAX_CONCURRENT_ALPHATAB_INITS = 3;
let currentInits = 0;
const initQueue: Array<() => void> = [];

export function requestIdle(fn: () => void) {
	// requestIdleCallback is available in modern browsers
	if (typeof window.requestIdleCallback === 'function') {
		window.requestIdleCallback(() => fn());
	} else {
		setTimeout(fn, 0);
	}
}

export function scheduleInit(task: () => void) {
	const tryRun = () => {
		if (currentInits < MAX_CONCURRENT_ALPHATAB_INITS) {
			currentInits++;
			requestIdle(() => {
				try {
					task();
				} finally {
					currentInits = Math.max(0, currentInits - 1);
					const next = initQueue.shift();
					if (next) scheduleInit(next);
				}
			});
		} else {
			initQueue.push(task);
		}
	};
	tryRun();
}
