import { App } from "obsidian";
import * as path from "path";

export interface AlphaTabResources {
	bravuraUri?: string;
	alphaTabWorkerUri?: string;
	soundFontUri?: string; // 改为URL而不是二进制数据
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

			// 尝试加载每个资源，如果不存在则跳过
			if (bravuraExists) {
				const bravuraData = await this.app.vault.adapter.readBinary(bravuraPath);
				resources.bravuraUri = `data:font/woff2;base64,${this.arrayBufferToBase64(bravuraData)}`;
			}

			if (alphaTabExists) {
				const alphaTabData = await this.app.vault.adapter.readBinary(alphaTabPath);
				resources.alphaTabWorkerUri = `data:application/javascript;base64,${this.arrayBufferToBase64(alphaTabData)}`;
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

	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		const chunkSize = 0x8000;
		let binaryString = "";
		for (let i = 0; i < bytes.length; i += chunkSize) {
			const chunk = bytes.slice(i, i + chunkSize);
			binaryString += String.fromCharCode(...chunk);
		}
		return btoa(binaryString);
	}
}
