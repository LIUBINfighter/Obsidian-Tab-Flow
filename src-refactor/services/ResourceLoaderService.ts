import { App } from "obsidian";
import * as path from "path";

export interface AlphaTabResources {
	bravuraUri: string;
	alphaTabWorkerUri: string;
	soundFontUri: string; // 改为URL而不是二进制数据
}

export class ResourceLoaderService {
	constructor(private app: App) {}

	public async load(pluginDir: string): Promise<AlphaTabResources> {
		try {
			const bravuraPath = path.join(
				pluginDir,
				"assets-refactor",
				"Bravura.woff2"
			);
			const alphaTabPath = path.join(
				pluginDir,
				"assets-refactor",
				"alphaTab.min.js"
			);
			const soundFontPath = path.join(
				pluginDir,
				"assets-refactor",
				"sonivox.sf3"
			);

			// 并行加载字体和脚本资源
			const [bravuraData, alphaTabData] =
				await Promise.all([
					this.app.vault.adapter.readBinary(bravuraPath),
					this.app.vault.adapter.readBinary(alphaTabPath),
				]);

			// 对于SoundFont，我们不预加载，而是提供URL供alphaTab自行加载
			const soundFontUri = this.app.vault.adapter.getResourcePath(soundFontPath);

			const bravuraUri = `data:font/woff2;base64,${this.arrayBufferToBase64(
				bravuraData
			)}`;
			const alphaTabWorkerUri = `data:application/javascript;base64,${this.arrayBufferToBase64(
				alphaTabData
			)}`;

			console.log(
				"[ResourceLoaderService] All resources loaded successfully."
			);
			console.log(
				"[ResourceLoaderService] SoundFont URI: ", soundFontUri
			);
			
			return {
				bravuraUri,
				alphaTabWorkerUri,
				soundFontUri,
			};
		} catch (error) {
			console.error(
				"[ResourceLoaderService] Failed to load essential resources:",
				error
			);
			throw new Error(
				"AlphaTab plugin resource loading failed. Please check the plugin installation."
			);
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
