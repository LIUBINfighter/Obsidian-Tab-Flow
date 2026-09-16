/**
 * Settings Utilities - 设置面板辅助工具
 */

type SerializableConfig = Record<string, unknown>;

/**
 * 导出配置为 JSON 文件
 */
export function exportConfigToJSON(
	config: SerializableConfig,
	filename = 'alphatab-config.json'
): void {
	const json = JSON.stringify(config, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	const a = createEl('a');
	a.href = url;
	a.download = filename;
	a.click();

	URL.revokeObjectURL(url);
}

/**
 * 从 JSON 文件导入配置
 */
export function importConfigFromJSON(): Promise<SerializableConfig | null> {
	return new Promise((resolve) => {
		const input = createEl('input');
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
				const config = JSON.parse(text) as SerializableConfig;
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
export async function copyConfigToClipboard(config: SerializableConfig): Promise<boolean> {
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

	switch (typeof value) {
		case 'boolean':
			return value ? 'Enabled' : 'Disabled';
		case 'number':
			return value.toFixed(2);
		case 'string':
			return value;
		case 'bigint':
			return value.toString();
		case 'symbol':
			return value.description ?? 'symbol';
		case 'object':
			return JSON.stringify(value);
		default:
			return '';
	}
}
