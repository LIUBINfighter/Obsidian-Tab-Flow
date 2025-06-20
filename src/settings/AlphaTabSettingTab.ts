import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import * as path from "path";
import * as fs from "fs";
import AlphaTabPlugin from "../main";

export class AlphaTabSettingTab extends PluginSettingTab {
	plugin: AlphaTabPlugin;

	constructor(app: App, plugin: AlphaTabPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "AlphaTab 吉他谱插件设置" });

		// 资源文件管理区域
		containerEl.createEl("h3", { text: "资源文件管理" });

		// 显示资源文件状态
		const assetsStatus = this.plugin.checkRequiredAssets()
			? "✅ 已安装"
			: "❌ 未安装或不完整";

		new Setting(containerEl)
			.setName("必要资源文件")
			.setDesc(`状态: ${assetsStatus}`)
			.addButton((button) =>
				button
					.setButtonText(
						this.plugin.checkRequiredAssets()
							? "重新下载"
							: "下载资源文件"
					)
					.setCta()
					.onClick(async () => {
						button.setButtonText("正在下载...").setDisabled(true);

						const success = await this.plugin.downloadAssets();

						if (success) {
							this.plugin.settings.assetsDownloaded = true;
							this.plugin.settings.lastAssetsCheck = Date.now();
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

		// 添加资源文件说明
		containerEl.createEl("div", {
			text: "说明：AlphaTab 插件需要以下关键资产文件才能正常工作：",
			cls: "setting-item-description",
		});

		const assetsList = containerEl.createEl("ul", {
			cls: "setting-item-description",
		});
		[
			"alphaTab.worker.mjs - 用于提高性能的 Worker 文件",
			"alphatab.js - AlphaTab 核心库文件",
			"sonivox.sf2 - 音色库文件，用于播放吉他谱",
			"Bravura 字体文件 - 用于显示乐谱符号",
		].forEach((item) => {
			assetsList.createEl("li", { text: item });
		});

		containerEl.createEl("div", {
			text: "这些文件总大小约为几MB，将保存在插件目录下。",
			cls: "setting-item-description",
		});

		// 添加资产下载 URL 信息
		const version = this.plugin.manifest.version;
		const assetsUrl = `https://github.com/LIUBINfighter/interactive-tabs/releases/download/${version}/assets.zip`;

		new Setting(containerEl)
			.setName("资源下载链接")
			.setDesc("如果自动下载失败，您可以手动下载资源文件并解压到插件目录")
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
		// .addButton(button => button
		//     .setButtonText("浏览器打开")
		//     .onClick(() => {
		//         window.open(assetsUrl, '_blank');
		//     })
		// );

		const urlContainer = containerEl.createDiv({
			cls: "setting-item-description",
		});
		urlContainer.createEl("strong", { text: "下载地址: " });
		const urlEl = urlContainer.createEl("span", { text: assetsUrl });
		urlEl.style.wordBreak = "break-all";
		// 添加打开资产目录的按钮
		if (this.plugin.actualPluginDir) {
			new Setting(containerEl)
				.setName("打开资产目录")
				.setDesc("打开插件的 assets 目录，方便手动管理资源文件")
				.addButton((button) =>
					button.setButtonText("打开目录").onClick(() => {
						const assetsPath = path.join(
							this.plugin.actualPluginDir as string,
							"assets"
						);
						try {
							// 确保目录存在
							if (!fs.existsSync(assetsPath)) {
								fs.mkdirSync(assetsPath, { recursive: true });
							}

							// 尝试用系统文件管理器打开
							// 使用 Obsidian API 打开URL，这样会使用系统默认的文件管理器
							// file:// 协议用于打开本地文件或文件夹
							const fileUrl = `file://${assetsPath}`;
							window.open(fileUrl);
							new Notice("已尝试打开资产目录");
						} catch (error) {
							console.error("打开资产目录失败:", error);
							new Notice(`打开目录失败: ${error.message}`);
						}
					})
				);
		}
		
		// 添加手动安装说明
		containerEl.createEl("div", {
			text: "手动安装步骤:",
			cls: "setting-item-description",
		});

		const installSteps = containerEl.createEl("ol", {
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

		// 显示预期的文件结构
		containerEl.createEl("div", {
			text: "预期的插件文件结构:",
			cls: "setting-item-description",
			attr: { style: "margin-top: 20px; font-weight: bold;" },
		});

		const codeBlock = containerEl.createEl("pre", {
			cls: "setting-item-description",
		});
		codeBlock.createEl("code", {
			text: `插件根目录/
├── main.js            # 主要插件代码
├── manifest.json      # 插件清单
├── styles.css         # 样式文件
└── assets/            # 资源目录
    └── alphatab/      # AlphaTab 资源
        ├── alphaTab.worker.mjs  # Worker 脚本
        ├── alphatab.js          # AlphaTab 核心库
        ├── font/                # 字体目录
        │   ├── Bravura.woff2
        │   ├── Bravura.woff
        │   └── bravura_metadata.json
        └── soundfont/           # 音色库目录
            └── sonivox.sf2      # 音色文件`,
		});

		// 添加自定义样式，使代码块更美观
		containerEl.createEl("style", {
			text: `
                pre {
                    background-color: var(--background-secondary);
                    padding: 10px;
                    border-radius: 5px;
                    overflow-x: auto;
                    font-family: monospace;
                    margin-top: 8px;
                    margin-bottom: 16px;
                }
                code {
                    white-space: pre;
                    font-size: 0.85em;
                }
            `,
		});

		// 添加功能设置
		containerEl.createEl("h3", { text: "功能设置" });

		// 这里可以添加其他功能设置项...
		new Setting(containerEl)
			.setName("示例设置")
			.setDesc("这是一个示例设置项")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);

		// 显示预期的文件结构
		containerEl.createEl("div", {
			text: "预期的插件文件结构:",
			cls: "setting-item-description",
		});

		// 添加自定义样式，使代码块更美观
	}
}
