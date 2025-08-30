/**
 * 时间格式化工具
 */
export function formatTime(ms: number): string {
	if (!ms || typeof ms !== 'number' || isNaN(ms)) return '0:00';
	const totalSec = Math.floor(ms / 1000);
	const hours = Math.floor(totalSec / 3600);
	const minutes = Math.floor((totalSec % 3600) / 60);
	const seconds = totalSec % 60;
	const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
	if (hours > 0) {
		return `${hours}:${pad(minutes)}:${pad(seconds)}`;
	}
	return `${minutes}:${pad(seconds)}`;
}
