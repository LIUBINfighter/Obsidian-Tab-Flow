// initAlphaTabResources.ts
// 用于初始化 AlphaTab 所需的资源，解耦主插件逻辑
import { Plugin } from "obsidian";

export interface AlphaTabResources {
	bravuraUri: string;
	alphaTabWorkerUri: string;
	soundFontData: Uint8Array;
}

/**
 * 初始化 AlphaTab 资源
 * @param plugin 插件实例（用于获取 manifest.dir 和 vault.adapter）
 * @param assetsDir 资源目录（如 "assets-refactor"）
 */
export async function initAlphaTabResources(
	plugin: Plugin,
	assetsDir = "assets-refactor"
): Promise<AlphaTabResources> {
	// 统一使用 assetsDir 目录下的三个文件
	const base = plugin.manifest.dir + "/" + assetsDir;
	const bravura = await plugin.app.vault.adapter.readBinary(
		base + "/Bravura.woff2"
	);
	const bravuraBlob = new Blob([new Uint8Array(bravura)]);
	const bravuraUri = URL.createObjectURL(bravuraBlob);

	const alphaTabWorkerData = await plugin.app.vault.adapter.readBinary(
		base + "/alphaTab.min.js"
	);
	const alphaTabWorkerUri = URL.createObjectURL(
		new Blob([new Uint8Array(alphaTabWorkerData)])
	);

	const soundFontFile = await plugin.app.vault.adapter.readBinary(
		base + "/sonivox.sf3"
	);

	return {
		bravuraUri,
		alphaTabWorkerUri,
		soundFontData: new Uint8Array(soundFontFile),
	};
}
