/**
 * Settings Utilities - 设置面板辅助工具
 */

import type { AlphaTabPlayerConfig } from '../types/config-schema';

/**
 * 导出配置为 JSON 文件
 */
export function exportConfigToJSON(
	config: AlphaTabPlayerConfig,
	filename = 'alphatab-config.json'
): void {
	const json = JSON.stringify(config, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();

	URL.revokeObjectURL(url);
}

/**
 * 从 JSON 文件导入配置
 */
export function importConfigFromJSON(): Promise<AlphaTabPlayerConfig | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';

		input.onchange = async (e: Event) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) {
				resolve(null);
				return;
			}

			try {
				const text = await file.text();
				const config = JSON.parse(text) as AlphaTabPlayerConfig;
				resolve(config);
			} catch (error) {
				console.error('[SettingsUtils] Failed to parse config:', error);
				resolve(null);
			}
		};

		input.click();
	});
}

/**
 * 复制配置到剪贴板
 */
export async function copyConfigToClipboard(config: AlphaTabPlayerConfig): Promise<boolean> {
	const json = JSON.stringify(config, null, 2);

	try {
		await navigator.clipboard.writeText(json);
		return true;
	} catch (error) {
		console.error('[SettingsUtils] Failed to copy to clipboard:', error);
		return false;
	}
}

/**
 * 格式化设置值为可读字符串
 */
export function formatSettingValue(value: unknown): string {
	if (value === null || value === undefined) {
		return 'N/A';
	}

	if (typeof value === 'boolean') {
		return value ? 'Enabled' : 'Disabled';
	}

	if (typeof value === 'number') {
		return value.toFixed(2);
	}

	if (typeof value === 'string') {
		return value;
	}

	if (typeof value === 'object') {
		return JSON.stringify(value);
	}

	return String(value);
}
