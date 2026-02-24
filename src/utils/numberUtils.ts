export function toFiniteNumber(value: unknown, fallback: number): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampNumber(value: number, min: number, max: number): number {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

export function toFiniteClampedNumber(
	value: unknown,
	fallback: number,
	min: number,
	max: number
): number {
	return clampNumber(toFiniteNumber(value, fallback), min, max);
}
