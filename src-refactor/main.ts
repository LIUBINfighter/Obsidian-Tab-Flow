import { Plugin, TFile } from "obsidian";
import { TabView, VIEW_TYPE_TAB } from "./views/TabView";
import {
	initAlphaTabResources,
	AlphaTabResources,
} from "./initAlphaTabResources";
import * as path from "path";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	resources!: AlphaTabResources;
	private isResourcesLoaded = false;

	async onload() {
		await this.loadSettings();

		try {
			this.resources = await initAlphaTabResources(
				this,
				"assets-refactor"
			);
			this.isResourcesLoaded = true;
		} catch (error) {
			console.error("Failed to load plugin resources:", error);
			// 提供默认的空资源作为后备
			this.resources = {
				bravuraUri: "",
				alphaTabWorkerUri: "",
				soundFontData: new Uint8Array(),
			};
		}

		this.registerView(VIEW_TYPE_TAB, (leaf) => {
			if (!this.isResourcesLoaded) {
				console.warn(
					"Resources not loaded, TabView may not function properly"
				);
			}
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
							if (!parent) {
								console.error(
									"Could not determine parent directory"
								);
								return;
							}

							const baseName = "New guitar tab";
							let filename = `${baseName}.alphatab`;
							let i = 1;
							while (
								await this.app.vault.adapter.exists(
									path.join(parent.path, filename)
								)
							) {
								filename = `${baseName} ${i}.alphatab`;
								i++;
							}
							const newFilePath = path.join(
								parent.path,
								filename
							);
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
		// 清理 blob URLs
		if (this.resources) {
			if (this.resources.alphaTabWorkerUri) {
				URL.revokeObjectURL(this.resources.alphaTabWorkerUri);
			}
			if (this.resources.bravuraUri) {
				URL.revokeObjectURL(this.resources.bravuraUri);
			}
		}

		// 分离所有相关的视图
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TAB);
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
