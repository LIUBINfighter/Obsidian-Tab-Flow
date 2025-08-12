import { Plugin, TFile } from "obsidian";
import { TabView, VIEW_TYPE_TAB } from "./views/TabView";
import {
	ResourceLoaderService,
	AlphaTabResources,
} from "./services/ResourceLoaderService";
import * as path from "path";
import {
	SettingTab,
	TabFlowSettings,
	DEFAULT_SETTINGS,
} from "./settings/SettingTab";


export default class MyPlugin extends Plugin {
	settings: TabFlowSettings;
	resources!: AlphaTabResources;
	actualPluginDir?: string;

	checkRequiredAssets(): boolean {
		// 简单实现，实际可根据 assets-refactor 目录和文件判断
		return !!this.settings.assetsDownloaded;
	}

	async downloadAssets(): Promise<boolean> {
		// 这里应实现真实下载逻辑，暂返回 true
		this.settings.assetsDownloaded = true;
		this.settings.lastAssetsCheck = Date.now();
		await this.saveSettings();
		return true;
}

	async onload() {
		await this.loadSettings();

		// 注册设置面板
		this.addSettingTab(new SettingTab(this.app, this));

		// 获取插件目录
		const pluginDir = this.manifest.dir || "";

		// 使用 ResourceLoaderService 加载资源
		const resourceLoader = new ResourceLoaderService(this.app);
		this.resources = await resourceLoader.load(pluginDir);

		this.registerView(VIEW_TYPE_TAB, (leaf) => {
			return new TabView(leaf, this, this.resources);
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
							const parent =
								file instanceof TFile
									? this.app.vault.getAbstractFileByPath(
											path.dirname(file.path)
									)
									: file;
							const baseName = "New guitar tab";
							let filename = `${baseName}.alphatab`;
							let i = 1;
							const parentPath =
								parent && "path" in parent
									? (parent as { path: string }).path
									: "";
							while (
								await this.app.vault.adapter.exists(
									path.join(parentPath, filename)
								)
							) {
								filename = `${baseName} ${i}.alphatab`;
								i++;
							}
							const newFilePath = path.join(parentPath, filename);
							await this.app.vault.create(newFilePath, "");
							const newFile =
								this.app.vault.getAbstractFileByPath(
									newFilePath
								);
							if (newFile instanceof TFile) {
								const leaf = this.app.workspace.getLeaf(false);
								await leaf.openFile(newFile);
							}
						});
				});

				if (file instanceof TFile && isGuitarProFile(file.extension)) {
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
		// bravuraUri 和 alphaTabWorkerUri 现在都是 Data URL，不需要清理
		// 不再在 onunload 时主动 detach leaves，避免插件更新导致视图位置丢失
		console.log("AlphaTab Plugin Unloaded");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
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
