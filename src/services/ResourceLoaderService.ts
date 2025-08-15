import { App } from "obsidian";
import * as path from "path";

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
			const [bravuraExists, alphaTabExists, soundFontExists] = await Promise.all([
				this.fileExists(bravuraPath),
				this.fileExists(alphaTabPath),
				this.fileExists(soundFontPath)
			]);

			// 如果有任何资源不存在，标记为不完整
			if (!bravuraExists || !alphaTabExists || !soundFontExists) {
				resources.resourcesComplete = false;
				console.log("[ResourceLoaderService] Some resources are missing. Plugin will load with limited functionality.");
				
				if (!bravuraExists) console.log(`[ResourceLoaderService] Missing: ${ASSET_FILES.BRAVURA}`);
				if (!alphaTabExists) console.log(`[ResourceLoaderService] Missing: ${ASSET_FILES.ALPHA_TAB}`);
				if (!soundFontExists) console.log(`[ResourceLoaderService] Missing: ${ASSET_FILES.SOUNDFONT}`);
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
				console.log("[ResourceLoaderService] SoundFont URI: ", resources.soundFontUri);
			}

			if (resources.resourcesComplete) {
				console.log("[ResourceLoaderService] All resources loaded successfully.");
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

	private async fileExists(filePath: string): Promise<boolean> {
		try {
			return await this.app.vault.adapter.exists(filePath);
		} catch (error) {
			console.error(`[ResourceLoaderService] Error checking if file exists: ${filePath}`, error);
			return false;
		}
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
