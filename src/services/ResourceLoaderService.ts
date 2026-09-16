import { App } from 'obsidian';
import * as path from 'path';
import { fileExists } from '../utils';
import { FontSourceStrategy, toFontDataUrl, verifyFontUri } from '../utils/fontSource';

export interface AlphaTabResources {
	bravuraUri?: string; // 可直接用于 url() 的字体地址（app:// 资源路径或 data URL）
	bravuraSource?: FontSourceStrategy; // 字体地址的来源策略（用于诊断）
	alphaTabWorkerUri?: string; // 使用文件 URL（app 资源路径）
	soundFontUri?: string; // 使用文件 URL（app 资源路径）
	resourcesComplete: boolean;
}

// 资产文件常量
export const ASSET_FILES = {
	BRAVURA: 'Bravura.woff2',
	ALPHA_TAB: 'alphaTab.min.js',
	SOUNDFONT: 'sonivox.sf3',
};

export class ResourceLoaderService {
	constructor(private app: App) {}

	public async load(pluginDir: string): Promise<AlphaTabResources> {
		const bravuraPath = path.join(pluginDir, 'assets', ASSET_FILES.BRAVURA);
		const alphaTabPath = path.join(pluginDir, 'assets', ASSET_FILES.ALPHA_TAB);
		const soundFontPath = path.join(pluginDir, 'assets', ASSET_FILES.SOUNDFONT);

		// 初始化资源对象
		const resources: AlphaTabResources = {
			resourcesComplete: true,
		};

		try {
			// 检查每个资源文件是否存在，如果不存在则跳过
			// NOTE: fileExists expects an Obsidian-compatible adapter (e.g. app.vault.adapter).
			// We intentionally pass `this.app.vault.adapter` so the existence check
			// runs in the same environment Obsidian uses for file IO. The utility
			// implementation no longer falls back to Node's fs at runtime to avoid
			// cross-environment issues (Electron renderer / browser contexts).
			//
			// If you need Node fs behavior for local scripts/tests, inject a test
			// adapter that wraps Node's fs (do not change production plugin code to
			// import fs directly).
			const [bravuraExists, alphaTabExists, soundFontExists] = await Promise.all([
				fileExists(bravuraPath, this.app.vault.adapter),
				fileExists(alphaTabPath, this.app.vault.adapter),
				fileExists(soundFontPath, this.app.vault.adapter),
			]);

			// 如果有任何资源不存在，标记为不完整
			if (!bravuraExists || !alphaTabExists || !soundFontExists) {
				resources.resourcesComplete = false;
				// TO FIX: 应该限制 console.debug 的数量，避免污染开发者控制台
				// 原因: 过多的日志会影响性能并使调试变得困难
				console.debug(
					'[ResourceLoaderService] Some resources are missing. Plugin will load with limited functionality.'
				);

				if (!bravuraExists)
					console.debug(`[ResourceLoaderService] Missing: ${ASSET_FILES.BRAVURA}`);
				if (!alphaTabExists)
					console.debug(`[ResourceLoaderService] Missing: ${ASSET_FILES.ALPHA_TAB}`);
				if (!soundFontExists)
					console.debug(`[ResourceLoaderService] Missing: ${ASSET_FILES.SOUNDFONT}`);
			}

			// 使用 Obsidian 资源 URL（可被缓存/共享）
			if (bravuraExists) {
				const appUri = this.app.vault.adapter.getResourcePath(bravuraPath);
				const resolved = await this.resolveBravuraUri(appUri, bravuraPath);
				resources.bravuraUri = resolved.uri;
				resources.bravuraSource = resolved.strategy;
			}

			if (alphaTabExists) {
				resources.alphaTabWorkerUri = this.app.vault.adapter.getResourcePath(alphaTabPath);
			}

			if (soundFontExists) {
				resources.soundFontUri = this.app.vault.adapter.getResourcePath(soundFontPath);
				// TO FIX: 应该限制 console.debug 的数量，避免污染开发者控制台
				// 原因: 过多的日志会影响性能并使调试变得困难
				console.debug('[ResourceLoaderService] SoundFont URI: ', resources.soundFontUri);
			}

			if (resources.resourcesComplete) {
				// TO FIX: 应该限制 console.debug 的数量，避免污染开发者控制台
				// 原因: 过多的日志会影响性能并使调试变得困难
				console.debug('[ResourceLoaderService] All resources loaded successfully.');
			}

			return resources;
		} catch (error) {
			console.error('[ResourceLoaderService] Failed to load resources:', error);
			// 返回不完整的资源，而不是抛出错误
			return {
				resourcesComplete: false,
			};
		}
	}

	// file existence check delegated to `src/utils/fileUtils.ts` which
	// supports both Obsidian adapters and Node fs.

	/**
	 * Resolve a usable Bravura font URI.
	 *
	 * Obsidian's `app://` resource URLs have broken `@font-face` loading more
	 * than once across app updates, so verify the URL at runtime and fall back
	 * to an in-memory data URL (read through the vault adapter) when it fails.
	 */
	private async resolveBravuraUri(
		appUri: string,
		relativePath: string
	): Promise<{ uri: string; strategy: FontSourceStrategy }> {
		if (await verifyFontUri(appUri)) {
			console.debug('[ResourceLoaderService] Bravura verified via app resource URL');
			return { uri: appUri, strategy: 'app-url' };
		}

		console.warn(
			'[ResourceLoaderService] Bravura app resource URL failed verification, falling back to data URL'
		);
		try {
			const buffer = await this.app.vault.adapter.readBinary(relativePath);
			const dataUrl = toFontDataUrl(buffer);
			if (await verifyFontUri(dataUrl)) {
				console.debug('[ResourceLoaderService] Bravura verified via data URL fallback');
				return { uri: dataUrl, strategy: 'data-url' };
			}
			console.error('[ResourceLoaderService] Bravura data URL fallback failed verification');
		} catch (error) {
			console.error('[ResourceLoaderService] Bravura data URL fallback failed:', error);
		}

		return { uri: appUri, strategy: 'unresolved' };
	}

	// 兼容旧实现保留方法（未使用）
	// private arrayBufferToBase64(buffer: ArrayBuffer): string {
	// 	const bytes = new Uint8Array(buffer);
	// 	const chunkSize = 0x8000;
	// 	let binaryString = "";
	// 	for (let i = 0; i < bytes.length; i += chunkSize) {
	// 		const chunk = bytes.slice(i, i + chunkSize);
	// 		binaryString += String.fromCharCode(...chunk);
	// 	}
	// 	return btoa(binaryString);
	// }
}
