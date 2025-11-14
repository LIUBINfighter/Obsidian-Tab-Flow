export function isMessy(t?: string): boolean {
	if (!t) return true;
	try {
		const s = t.length;
		const replacementCount = (t.match(/[�\uFFFD]/g) || []).length;
		if (s === 0) return true;
		if (replacementCount / s > 0.5) return true;
		try {
			if (/^[\s\p{P}\p{C}]+$/u.test(t)) return true;
		} catch (_) {
			if (/^[\s\W_]+$/.test(t)) return true;
		}
		if (!/[\u4e00-\u9fa5]/.test(t) && s > 2 && !/[A-Za-z0-9]/.test(t)) return true;
		return false;
	} catch (_) {
		return false;
	}
}
