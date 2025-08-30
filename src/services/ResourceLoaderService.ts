import { App } from "obsidian";
import * as path from "path";
import { fileExists } from "../utils";

export interface AlphaTabResources {
	bravuraUri?: string; // 使用文件 URL（app 资源路径）
	alphaTabWorkerUri?: string; // 使用文件 URL（app 资源路径）
	soundFontUri?: string; // 使用文件 URL（app 资源路径）
	resourcesComplete: boolean;
}

// 资产文件常量
export const ASSET_FILES = {
	BRAVURA: "Bravura.woff2",
	ALPHA_TAB: "alphaTab.min.js", 
	SOUNDFONT: "sonivox.sf3"
};

export class ResourceLoaderService {
	constructor(private app: App) {}

	public async load(pluginDir: string): Promise<AlphaTabResources> {
		const bravuraPath = path.join(
			pluginDir,
			"assets",
			ASSET_FILES.BRAVURA
		);
		const alphaTabPath = path.join(
			pluginDir,
			"assets",
			ASSET_FILES.ALPHA_TAB
		);
		const soundFontPath = path.join(
			pluginDir,
			"assets",
			ASSET_FILES.SOUNDFONT
		);

		// 初始化资源对象
		const resources: AlphaTabResources = {
			resourcesComplete: true
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
				fileExists(soundFontPath, this.app.vault.adapter)
			]);

			// 如果有任何资源不存在，标记为不完整
			if (!bravuraExists || !alphaTabExists || !soundFontExists) {
				resources.resourcesComplete = false;
				// TO FIX: 应该限制 console.debug 的数量，避免污染开发者控制台
				// 原因: 过多的日志会影响性能并使调试变得困难
				console.debug("[ResourceLoaderService] Some resources are missing. Plugin will load with limited functionality.");

				if (!bravuraExists) console.debug(`[ResourceLoaderService] Missing: ${ASSET_FILES.BRAVURA}`);
				if (!alphaTabExists) console.debug(`[ResourceLoaderService] Missing: ${ASSET_FILES.ALPHA_TAB}`);
				if (!soundFontExists) console.debug(`[ResourceLoaderService] Missing: ${ASSET_FILES.SOUNDFONT}`);
			}

			// 使用 Obsidian 资源 URL（可被缓存/共享）
			if (bravuraExists) {
				resources.bravuraUri = this.app.vault.adapter.getResourcePath(bravuraPath);
			}

			if (alphaTabExists) {
				resources.alphaTabWorkerUri = this.app.vault.adapter.getResourcePath(alphaTabPath);
			}

			if (soundFontExists) {
				resources.soundFontUri = this.app.vault.adapter.getResourcePath(soundFontPath);
				// TO FIX: 应该限制 console.debug 的数量，避免污染开发者控制台
				// 原因: 过多的日志会影响性能并使调试变得困难
				console.debug("[ResourceLoaderService] SoundFont URI: ", resources.soundFontUri);
			}

			if (resources.resourcesComplete) {
				// TO FIX: 应该限制 console.debug 的数量，避免污染开发者控制台
				// 原因: 过多的日志会影响性能并使调试变得困难
				console.debug("[ResourceLoaderService] All resources loaded successfully.");
			}

			return resources;
		} catch (error) {
			console.error(
				"[ResourceLoaderService] Failed to load resources:",
				error
			);
			// 返回不完整的资源，而不是抛出错误
			return {
				resourcesComplete: false
			};
		}
	}

	// file existence check delegated to `src/utils/fileUtils.ts` which
	// supports both Obsidian adapters and Node fs.

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
