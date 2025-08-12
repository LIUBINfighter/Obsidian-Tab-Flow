import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import * as path from "path";
import MyPlugin from "../main";

export interface TabFlowSettings {
	mySetting: string;
	assetsDownloaded?: boolean;
	lastAssetsCheck?: number;
}

export const DEFAULT_SETTINGS: TabFlowSettings = {
	mySetting: "default",
};

export class SettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const { containerEl } = this;

		containerEl.empty();

		// 顶部标签页样式
		const tabs = containerEl.createDiv({ cls: "itabs-settings-tabs" });
		const tabContents = containerEl.createDiv({
			cls: "itabs-settings-contents",
		});

		const tabList = [
			{ id: "general", name: "资产管理" },
			{ id: "about", name: "关于" },
		];

		let activeTab = "general";

		const renderTab = async (tabId: string) => {
			tabContents.empty();
			if (tabId === "general") {
				// 资产管理页内容，参考 AlphaTabSettingTab.displayAssetsTab
				tabContents.createEl("h3", { text: "资源文件管理" });
				
				// 检查资产文件状态 - 异步获取
				const assetsExist = await this.plugin.checkRequiredAssets?.();
				const assetsStatus = assetsExist
					? "✅ 已安装"
					: "❌ 未安装或不完整";

				new Setting(tabContents)
					.setName("必要资源文件")
					.setDesc(`状态: ${assetsStatus}`)
					.addButton((button) =>
						button
							.setButtonText(assetsExist ? "重新下载" : "下载资源文件")
							.setCta()
							.onClick(async () => {
								button
									.setButtonText("正在下载...")
									.setDisabled(true);

								const success =
									await this.plugin.downloadAssets?.();

								if (success) {
									this.plugin.settings.assetsDownloaded =
										true;
									this.plugin.settings.lastAssetsCheck =
										Date.now();
									await this.plugin.saveSettings();
									new Notice(
										"AlphaTab 资源文件已下载完成，请重新启动 Obsidian 以应用更改",
										5000
									);
								} else {
									new Notice(
										"AlphaTab 资源文件下载失败，请检查网络连接后重试",
										5000
									);
								}

								this.display(); // 重新渲染设置页面以更新状态
							})
					);

				tabContents.createEl("div", {
					text: "说明：AlphaTab 插件仅需以下关键资产文件：",
					cls: "setting-item-description",
				});

				const assetsList = tabContents.createEl("ul", {
					cls: "setting-item-description",
				});
				[
					"alphaTab.min.js - AlphaTab 主脚本",
					"Bravura.woff2 - 乐谱字体文件",
					"sonivox.sf3 - 音色库文件",
				].forEach((item) => {
					assetsList.createEl("li", { text: item });
				});

				tabContents.createEl("div", {
					text: "这些文件总大小约为几MB，将保存在插件目录下的 assets 文件夹。",
					cls: "setting-item-description",
				});

				const version = this.plugin.manifest?.version ?? "latest";
				const assetsUrl = `https://github.com/LIUBINfighter/interactive-tabs/releases/download/${version}/assets.zip`;

				new Setting(tabContents)
					.setName("资源下载链接")
					.setDesc(
						"如果自动下载失败，您可以手动下载资源文件并解压到插件目录"
					)
					.addButton((button) =>
						button.setButtonText("复制链接").onClick(() => {
							navigator.clipboard
								.writeText(assetsUrl)
								.then(() => {
									new Notice("下载链接已复制到剪贴板");
								})
								.catch((err) => {
									new Notice("复制链接失败: " + err);
								});
						})
					);

				const urlContainer = tabContents.createDiv({
					cls: "setting-item-description",
				});
				urlContainer.createEl("strong", { text: "下载地址: " });
				const urlEl = urlContainer.createEl("span", {
					text: assetsUrl,
				});
				urlEl.style.wordBreak = "break-all";

				if (this.plugin.actualPluginDir) {
					new Setting(tabContents)
						.setName("打开资产目录")
						.setDesc(
							"打开插件的 assets 目录，方便手动管理资源文件"
						)
						.addButton((button) =>
							button.setButtonText("打开目录").onClick(async () => {
								// 使用Obsidian API处理目录
								const assetsDirRelative = path.join(".obsidian", "plugins", this.plugin.manifest.id, "assets");
								
								try {
									// 确保目录存在
									await this.app.vault.adapter.mkdir(assetsDirRelative);
									
									// 获取路径
									const assetsPath = path.join(
										this.plugin.actualPluginDir as string,
										"assets"
									);
									
									// 使用协议在浏览器中打开
									const fileUrl = `file://${assetsPath}`;
									window.open(fileUrl);
									new Notice("已尝试打开资产目录");
									
									console.log("资产目录:", assetsPath);
									console.log("资产目录（相对）:", assetsDirRelative);
								} catch (error) {
									console.error("打开资产目录失败:", error);
									new Notice(
										`打开目录失败: ${error.message}`
									);
								}
							})
						);
				}

				tabContents.createEl("div", {
					text: "手动安装步骤:",
					cls: "setting-item-description",
				});

				const installSteps = tabContents.createEl("ol", {
					cls: "setting-item-description",
				});
				[
					"下载上面链接中的 assets.zip 文件",
					"解压 assets.zip 文件（确保解压后有 assets 文件夹）",
					"将解压出的 assets 文件夹复制到本插件目录中",
					"重启 Obsidian 以应用更改",
				].forEach((step) => {
					installSteps.createEl("li", { text: step });
				});

				tabContents.createEl("div", {
					text: "预期的插件文件结构:",
					cls: "setting-item-description",
					attr: { style: "margin-top: 20px; font-weight: bold;" },
				});

				const codeBlock = tabContents.createEl("pre", {
					cls: "setting-item-description",
				});
				codeBlock.createEl("code", {
					text: `插件根目录/
├── main.js            # 主要插件代码
├── manifest.json      # 插件清单
├── styles.css         # 样式文件
└── assets/   # 资源目录
	├── alphaTab.min.js
	├── Bravura.woff2
	└── sonivox.sf3`,
				});
			} else if (tabId === "about") {
				tabContents.createEl("h3", { text: "关于" });
				tabContents.createEl("p", {
					text: "AlphaTab 插件 by YourName.",
				});
			}
		};

		tabList.forEach((tab) => {
			const tabEl = tabs.createEl("button", {
				text: tab.name,
				cls: [
					"itabs-settings-tab",
					tab.id === activeTab ? "active" : "",
				],
			});
			tabEl.onclick = async () => {
				tabs.querySelectorAll("button").forEach((btn) =>
					btn.removeClass("active")
				);
				tabEl.addClass("active");
				activeTab = tab.id;
				await renderTab(tab.id);
			};
		});

		await renderTab(activeTab);
	}
}
