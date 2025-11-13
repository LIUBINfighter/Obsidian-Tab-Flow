const MAX_CONCURRENT_ALPHATAB_INITS = 3;
let currentInits = 0;
const initQueue: Array<() => void> = [];

export function requestIdle(fn: () => void) {
	const ric = (window as any).requestIdleCallback as
		| undefined
		| ((cb: (deadline: unknown) => void) => number);
	if (typeof ric === 'function') {
		ric(() => fn());
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
