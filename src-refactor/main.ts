import { Plugin, TFile } from 'obsidian';
import { AlphaTabResources, TabView, VIEW_TYPE_TAB } from "./views/TabView";
import * as path from "path";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	resources!: AlphaTabResources;

	async onload() {
		await this.loadSettings();

		// 获取正确的插件目录路径
		// 修复：this.manifest.dir 已经是完整路径，不需要额外的 vaultRoot 拼接
		const pluginDir = this.manifest.dir || '';
		
		console.log(`[AlphaTab] Plugin directory: ${pluginDir}`);

		try {
			// 使用 assets-refactor 目录中的压缩资源
			const bravuraPath = path.join(pluginDir, "assets-refactor", "Bravura.woff2");
			const alphaTabPath = path.join(pluginDir, "assets-refactor", "alphaTab.min.js");
			const soundFontPath = path.join(pluginDir, "assets-refactor", "sonivox.sf3");
			
			console.log(`[AlphaTab] Loading Bravura from: ${bravuraPath}`);
			console.log(`[AlphaTab] Loading AlphaTab from: ${alphaTabPath}`);
			console.log(`[AlphaTab] Loading SoundFont from: ${soundFontPath}`);

			// 检查文件是否存在
			if (!await this.app.vault.adapter.exists(bravuraPath)) {
				throw new Error(`Bravura font file not found at: ${bravuraPath}`);
			}
			if (!await this.app.vault.adapter.exists(alphaTabPath)) {
				throw new Error(`AlphaTab file not found at: ${alphaTabPath}`);
			}
			if (!await this.app.vault.adapter.exists(soundFontPath)) {
				throw new Error(`SoundFont file not found at: ${soundFontPath}`);
			}

			const bravura = await this.app.vault.adapter.readBinary(bravuraPath);
			const bravuraBlob = new Blob([new Uint8Array(bravura)], { type: 'font/woff2' });
			const bravuraUri = URL.createObjectURL(bravuraBlob);

			// NOTE: obsidian loads plugins in a similar way, they read the file and eval it.
			// Following this practice we load the alphaTab file from the plugin dir and create a blob URI for usage.
			const alphaTabWorkerData = await this.app.vault.adapter.readBinary(alphaTabPath);
			const alphaTabWorkerUri = URL.createObjectURL(new Blob([new Uint8Array(alphaTabWorkerData)], { type: 'application/javascript' }));

			const soundFontFile = await this.app.vault.adapter.readBinary(soundFontPath);
			this.resources = {
				bravuraUri,
				alphaTabWorkerUri: alphaTabWorkerUri,
				soundFontData: new Uint8Array(soundFontFile)
			};
			
			console.log('[AlphaTab] 所有资源文件加载成功');
			console.log(`[AlphaTab] Bravura URI: ${bravuraUri}`);
			console.log(`[AlphaTab] AlphaTab Worker URI: ${alphaTabWorkerUri}`);
		} catch (error) {
			console.error('[AlphaTab] 无法加载必需的资源文件:', error);
			console.error('[AlphaTab] Plugin directory:', pluginDir);
			throw new Error('AlphaTab 插件资源文件加载失败，请检查插件安装路径。');
		}

		this.registerView(VIEW_TYPE_TAB, (leaf) => {
			return new TabView(leaf, this, this.resources)
		});

		this.registerExtensions(
			["gp", "gp3", "gp4", "gp5", "gpx", "gp7"],
			VIEW_TYPE_TAB
		);

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				menu.addItem((item) => {
					item.setTitle("Create a new AlphaTab file")
						.setIcon("plus")
						.onClick(async () => {
							const parent = file instanceof TFile ? this.app.vault.getAbstractFileByPath(path.dirname(file.path)) : file;
							const baseName = "New guitar tab";
							let filename = `${baseName}.alphatab`;
							let i = 1;
							
							// 修复类型错误：确保 parent 存在且有 path 属性
							const parentPath = parent && 'path' in parent ? (parent as any).path : "";
							
							while (await this.app.vault.adapter.exists(path.join(parentPath, filename))) {
								filename = `${baseName} ${i}.alphatab`;
								i++;
							}
							const newFilePath = path.join(parentPath, filename);
							await this.app.vault.create(newFilePath, "");
							const newFile = this.app.vault.getAbstractFileByPath(newFilePath);
							if (newFile instanceof TFile) {
								const leaf = this.app.workspace.getLeaf(false);
								await leaf.openFile(newFile);
							}
						});
				});

				if (
					file instanceof TFile &&
					isGuitarProFile(file.extension)
				) {
					menu.addItem((item) => {
						item.setTitle("Open as Guitar Tab (AlphaTab)")
							.setIcon("music")
							.onClick(async () => {
								const leaf = this.app.workspace.getLeaf(false);
								await leaf.setViewState({
									type: VIEW_TYPE_TAB,
									state: { file: file.path },
								});
								this.app.workspace.revealLeaf(leaf); // 确保新叶子处于活动状态
							});
					});
				}

				menu.addItem((item) => {
					item.setTitle("Preview in AlphaTab")
						.setIcon("eye")
						.onClick(async () => {
							const leaf = this.app.workspace.getLeaf(false);
							await leaf.setViewState({
								type: VIEW_TYPE_TAB,
								state: { file: file.path },
							});
							this.app.workspace.revealLeaf(leaf);
						});
				});
			})
		);
	}

	onunload() {
		// 清理资源 URL
		if (this.resources) {
			if (this.resources.alphaTabWorkerUri) {
				URL.revokeObjectURL(this.resources.alphaTabWorkerUri);
			}
			if (this.resources.bravuraUri) {
				URL.revokeObjectURL(this.resources.bravuraUri);
			}
		}
		
		// 清理所有相关的视图
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TAB);
		
		console.log("AlphaTab Plugin Unloaded");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

export function isGuitarProFile(extension: string | undefined): boolean {
	if (!extension) return false;
	return ["gp", "gp3", "gp4", "gp5", "gpx", "gp7"].includes(
		extension.toLowerCase()
	);
}
