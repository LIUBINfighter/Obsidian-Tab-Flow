import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import * as path from "path";
import MyPlugin, { AssetStatus } from "../main";

export interface TabFlowSettings {
	mySetting: string;
	assetsDownloaded?: boolean;
	lastAssetsCheck?: number;
	simpleAssetCheck?: boolean;
}

export const DEFAULT_SETTINGS: TabFlowSettings = {
	mySetting: "default",
	simpleAssetCheck: false, // 默认使用详细资产状态检查
	assetsDownloaded: false,
	lastAssetsCheck: 0
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
				const assetsStatusContainer = tabContents.createDiv({ 
					cls: "setting-item-description",
					attr: { style: "margin-bottom: 1em; padding: 10px; border-radius: 5px; background-color: var(--background-secondary);" } 
				});
				assetsStatusContainer.createEl("strong", { text: "资产文件状态检查中..." });

				// 获取资产文件状态详情
				const assetStatusResult = await this.plugin.checkRequiredAssets?.();
				
				// 定义资产文件描述映射
				const assetDescriptions: Record<string, string> = {
					"alphaTab.min.js": "AlphaTab 主脚本",
					"Bravura.woff2": "乐谱字体文件",
					"sonivox.sf3": "音色库文件" 
				};
				
				// 更新状态容器
				assetsStatusContainer.empty();
				
				// 判断返回类型并处理
				let assetStatuses: AssetStatus[] = [];
				let allFilesExist = false;
				
				if (Array.isArray(assetStatusResult)) {
					// 使用详细的资产状态列表
					assetStatuses = assetStatusResult;
					allFilesExist = assetStatuses.every(status => status.exists);
				} else {
					// 使用简单的布尔结果
					allFilesExist = !!assetStatusResult;
					
					// 如果没有详细信息，则使用默认资产列表创建状态
					if (!Array.isArray(assetStatusResult)) {
						// 获取资产文件路径前缀
						const pluginId = this.plugin.manifest.id;
						const assetsPrefix = path.join(".obsidian", "plugins", pluginId, "assets");
						
						const assetFiles = [
							"alphaTab.min.js",
							"Bravura.woff2", 
							"sonivox.sf3"
						];
						
						// 构建基本的资产状态信息
						assetStatuses = assetFiles.map(file => ({
							file: file,
							exists: allFilesExist, // 使用整体状态
							path: path.join(assetsPrefix, file)
						}));
					}
				}
				
				// 显示总体状态
				assetsStatusContainer.createEl("div", {
					text: allFilesExist ? "✅ 所有资产文件已安装" : "❌ 资产文件不完整",
					attr: { style: `font-weight: bold; color: ${allFilesExist ? "var(--text-success)" : "var(--text-error)"}; margin-bottom: 10px;` }
				});
				
				// 显示各个文件状态
				const fileStatusList = assetsStatusContainer.createEl("ul", {
					attr: { style: "margin: 0; padding-left: 20px;" }
				});
				
				assetStatuses.forEach(status => {
					const item = fileStatusList.createEl("li", {
						attr: { style: "margin-bottom: 5px;" }
					});
					
					const fileName = path.basename(status.file);
					const description = assetDescriptions[fileName] || "资源文件";
					const icon = status.exists ? "✅" : "❌";
					const statusText = status.exists ? "已安装" : "未安装";
					const statusColor = status.exists ? "var(--text-success)" : "var(--text-error)";
					
					item.innerHTML = `<span style="color: ${statusColor}">${icon} ${fileName}</span> - ${description} <span style="color: ${statusColor}; font-style: italic;">(${statusText})</span>`;
				});
				
				// 检测上次下载时间
				if (this.plugin.settings.lastAssetsCheck) {
					const lastCheck = new Date(this.plugin.settings.lastAssetsCheck);
					assetsStatusContainer.createEl("div", {
						text: `上次检查时间: ${lastCheck.toLocaleString()}`,
						attr: { style: "margin-top: 10px; font-size: 0.9em; color: var(--text-muted);" }
					});
				}
				
				// 创建一个容器来放置下载按钮和重启按钮
				const downloadButtonContainer = tabContents.createDiv({
					cls: "setting-item",
					attr: { style: "display: flex; flex-direction: column;" }
				});
				
				// 下载按钮的设置
				const downloadSetting = new Setting(downloadButtonContainer)
					.setName(allFilesExist ? "重新下载资产文件" : "下载缺失的资产文件")
					.setDesc(allFilesExist ? 
						"当前所有资产文件已安装，如有问题可重新下载" : 
						"点击下载缺失的资源文件，完成后需重启 Obsidian"
					);
				
				// 按钮容器，用于水平排列下载和重启按钮
				const buttonsContainer = downloadSetting.controlEl.createDiv({
					attr: { style: "display: flex; gap: 8px;" }
				});
				
				// 下载按钮
				const downloadButton = buttonsContainer.createEl("button", {
					text: allFilesExist ? "重新下载" : "下载资源文件",
					cls: "mod-cta"
				});
				
				// 重启按钮（初始隐藏）
				const restartButton = buttonsContainer.createEl("button", {
					text: "重启 Obsidian",
					cls: "mod-warning",
					attr: { style: "display: none;" }
				});
				
				// 下载按钮点击事件
				downloadButton.onclick = async () => {
					downloadButton.textContent = "正在下载...";
					downloadButton.disabled = true;

					const success = await this.plugin.downloadAssets?.();

					if (success) {
						this.plugin.settings.assetsDownloaded = true;
						this.plugin.settings.lastAssetsCheck = Date.now();
						await this.plugin.saveSettings();
						
						// 成功下载后显示重启按钮
						restartButton.style.display = "inline-block";
						
						downloadButton.textContent = "下载完成";
						
						new Notice(
							"AlphaTab 资源文件已下载完成，请重启 Obsidian 以应用更改",
							5000
						);
					} else {
						downloadButton.textContent = allFilesExist ? "重新下载" : "重试下载";
						downloadButton.disabled = false;
						
						new Notice(
							"AlphaTab 资源文件下载失败，请检查网络连接后重试",
							5000
						);
					}
					
					// 不立即刷新整个界面，避免重启按钮消失
					// 重新检查资产状态但不使用返回值，不重新渲染整个界面
					await this.plugin.checkRequiredAssets?.();
				};
				
				// 重启按钮点击事件
				restartButton.onclick = () => {
					// 显示确认对话框
					const confirmRestart = confirm("确定要重启 Obsidian 吗？请确保已保存所有工作。");
					
					if (confirmRestart) {
						// 执行重启
						// @ts-ignore
						app.commands.executeCommandById('app:reload');
					}
				};
				
				// 如果已经下载过资产，直接显示重启按钮
				if (this.plugin.settings.assetsDownloaded) {
					restartButton.style.display = "inline-block";
				}

				// tabContents.createEl("div", {
				// 	text: "说明：AlphaTab 插件仅需以下关键资产文件：",
				// 	cls: "setting-item-description",
				// });

				// const assetsList = tabContents.createEl("ul", {
				// 	cls: "setting-item-description",
				// });
				// [
				// 	"alphaTab.min.js - AlphaTab 主脚本",
				// 	"Bravura.woff2 - 乐谱字体文件",
				// 	"sonivox.sf3 - 音色库文件",
				// ].forEach((item) => {
				// 	assetsList.createEl("li", { text: item });
				// });

				// tabContents.createEl("div", {
				// 	text: "这些文件总大小约为几MB，将保存在插件目录下的 assets 文件夹。",
				// 	cls: "setting-item-description",
				// });

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
