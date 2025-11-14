// Utility helpers used by TabView and PlayBar
/**
 * 判断标题是否为乱码/无意义文本
 */
export function isMessy(t?: string): boolean {
	if (!t) return true;
	try {
		const s = t.length;
		const replacementCount = (t.match(/[\ufffd\uFFFD]/g) || []).length;
		if (s === 0) return true;
		if (replacementCount / s > 0.5) return true;
		// 仅由空白/标点/控制字符构成
		try {
			if (/^[\s\p{P}\p{C}]+$/u.test(t)) return true;
		} catch (e) {
			// 如果环境不支持 Unicode 属性类，退回到简单检测（仅标点/空白）
			if (/^[\s\W_]+$/.test(t)) return true;
		}
		// 非中文且长度较短则可能不是合理标题
		if (!/[\u4e00-\u9fa5]/.test(t) && s > 2 && !/[A-Za-z0-9]/.test(t)) return true;
		return false;
	} catch (e) {
		return false;
	}
}
