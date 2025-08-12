import { App, PluginSettingTab, Setting, Notice, normalizePath } from "obsidian";
import * as path from "path";
import MyPlugin from "../main";
import { ASSET_FILES } from "../services/ResourceLoaderService";

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

export interface AssetStatus {
	file: string;      // 文件名（不含路径）
	exists: boolean;   // 是否存在
	path: string;      // vault 相对路径 (.obsidian/plugins/...)
	size?: number;     // 读取到的大小（字节，可选）
}

export class SettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * 获取 vault 相对路径（始终正斜杠）
	 */
	private vaultPath(...segments: string[]): string {
		return normalizePath(segments.join("/"));
	}

	/**
	 * 直接在 SettingTab 中重新实现独立的资产检测，不依赖 plugin.checkRequiredAssets。
	 * 避免 path.join 在 Windows 产生反斜杠，统一使用正斜杠。
	 */
	private async collectAssetStatuses(): Promise<AssetStatus[]> {
		const pluginId = this.plugin.manifest.id;
		const assetsDir = this.vaultPath(".obsidian", "plugins", pluginId, "assets");
		const files = [ASSET_FILES.ALPHA_TAB, ASSET_FILES.BRAVURA, ASSET_FILES.SOUNDFONT];

		const dirExists = await this.app.vault.adapter.exists(assetsDir);
		if (!dirExists) {
			console.log("[SettingTab] Assets directory missing:", assetsDir);
			return files.map(f => ({ file: f, exists: false, path: this.vaultPath(assetsDir, f) }));
		}

		const statuses: AssetStatus[] = [];
		for (const f of files) {
			const p = this.vaultPath(assetsDir, f);
			const exists = await this.app.vault.adapter.exists(p);
			let size: number | undefined = undefined;
			if (exists) {
				try {
					// 尝试读取文件大小（只读取二进制长度，避免 memory 过大——这些文件都较小）
					const data = await this.app.vault.adapter.readBinary(p);
					size = data.byteLength;
				} catch (e) {
					console.warn("[SettingTab] 读取文件大小失败:", p, e);
				}
			} else {
				console.log("[SettingTab] Missing asset file:", p);
			}
			statuses.push({ file: f, exists, path: p, size });
		}
		return statuses;
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
				tabContents.createEl("h3", { text: "资源文件管理" });

				const assetsStatusContainer = tabContents.createDiv({
					cls: "setting-item-description",
					attr: { style: "margin-bottom: 1em; padding: 10px; border-radius: 5px; background-color: var(--background-secondary);" }
				});
				assetsStatusContainer.createEl("strong", { text: "资产文件状态检查中..." });

				const statuses = await this.collectAssetStatuses();

				const descriptions: Record<string, string> = {
					[ASSET_FILES.ALPHA_TAB]: "AlphaTab 主脚本",
					[ASSET_FILES.BRAVURA]: "乐谱字体文件",
					[ASSET_FILES.SOUNDFONT]: "音色库文件"
				};

				assetsStatusContainer.empty();
				const allOk = statuses.every(s => s.exists);
				assetsStatusContainer.createEl("div", {
					text: allOk ? "✅ 所有资产文件已安装" : "❌ 资产文件不完整",
					attr: { style: `font-weight: bold; color: ${allOk ? 'var(--text-success)' : 'var(--text-error)'}; margin-bottom: 10px;` }
				});

				const list = assetsStatusContainer.createEl("ul", { attr: { style: "margin:0;padding-left:20px;" } });
				statuses.forEach(s => {
					const li = list.createEl("li");
					const color = s.exists ? 'var(--text-success)' : 'var(--text-error)';
					const icon = s.exists ? '✅' : '❌';
					const sizeText = s.size != null ? ` - ${(s.size/1024).toFixed(1)} KB` : '';
					li.innerHTML = `<span style="color:${color}">${icon} ${s.file}</span> - ${descriptions[s.file] || '资源文件'} <span style="color:${color};font-style:italic;">(${s.exists ? '已安装' : '未安装'})</span>${sizeText}`;
				});

				if (this.plugin.settings.lastAssetsCheck) {
					const lastCheck = new Date(this.plugin.settings.lastAssetsCheck);
					assetsStatusContainer.createEl("div", {
						text: `上次下载/检查时间: ${lastCheck.toLocaleString()}`,
						attr: { style: "margin-top:10px;font-size:0.9em;color:var(--text-muted);" }
					});
				}

				// 操作按钮区域
				const actionSetting = new Setting(tabContents)
					.setName(allOk ? "重新下载资产文件" : "下载缺失的资产文件")
					.setDesc(allOk ? "如怀疑文件损坏，可重新下载" : "下载后需重启 Obsidian")
				;
				const buttons = actionSetting.controlEl.createDiv({ attr: { style: "display:flex;gap:8px;" } });
				const downloadBtn = buttons.createEl("button", { text: allOk ? "重新下载" : "下载资源文件", cls: "mod-cta" });
				const restartBtn = buttons.createEl("button", { text: "重启 Obsidian", cls: "mod-warning", attr: { style: this.plugin.settings.assetsDownloaded ? '' : 'display:none;' } });

				downloadBtn.onclick = async () => {
					downloadBtn.disabled = true;
					downloadBtn.textContent = "正在下载...";
					const ok = await this.plugin.downloadAssets?.();
					if (ok) {
						new Notice("资源文件已下载，必要时请重启 Obsidian 应用");
						restartBtn.style.display = 'inline-block';
						await this.refreshAssetsUI(renderTab, tabId); // 重新渲染以更新状态
					} else {
						downloadBtn.disabled = false;
						downloadBtn.textContent = allOk ? "重新下载" : "重试下载";
					}
				};

				restartBtn.onclick = () => {
					if (confirm("确定要重启 Obsidian 吗？请确认已保存全部内容。")) {
						// @ts-ignore
						app.commands.executeCommandById('app:reload');
					}
				};

				tabContents.createEl("div", { text: "说明：插件需要以下文件：", cls: "setting-item-description", });
				const ul = tabContents.createEl("ul", { cls: "setting-item-description" });
				[
					`${ASSET_FILES.ALPHA_TAB} - AlphaTab 主脚本`,
					`${ASSET_FILES.BRAVURA} - 乐谱字体`,
					`${ASSET_FILES.SOUNDFONT} - 音色库`
				].forEach(t => ul.createEl("li", { text: t }));

				tabContents.createEl("div", { text: "这些文件保存在插件目录 assets/ 下。", cls: "setting-item-description" });
				const version = this.plugin.manifest?.version ?? 'latest';
				const assetsZipUrl = `https://github.com/LIUBINfighter/interactive-tabs/releases/download/${version}/assets.zip`;
				new Setting(tabContents)
					.setName("资源下载链接")
					.setDesc("自动下载失败时，可手动下载并解压到插件目录")
					.addButton(b => b.setButtonText("复制链接").onClick(() => {
						navigator.clipboard.writeText(assetsZipUrl).then(() => new Notice("已复制"), e => new Notice("复制失败: "+ e));
					}));
				const urlWrap = tabContents.createDiv({ cls: "setting-item-description" });
				urlWrap.createEl("strong", { text: "下载地址: " });
				const urlSpan = urlWrap.createEl("span", { text: assetsZipUrl });
				urlSpan.style.wordBreak = 'break-all';

				if (this.plugin.actualPluginDir) {
					new Setting(tabContents)
						.setName("打开资产目录")
						.setDesc("在系统文件管理器中打开 assets 文件夹")
						.addButton(b => b.setButtonText("打开目录").onClick(async () => {
							try {
								const assetsRel = this.vaultPath('.obsidian','plugins', this.plugin.manifest.id, 'assets');
								await this.app.vault.adapter.mkdir(assetsRel).catch(() => {});
								if (!this.plugin.actualPluginDir) {
									new Notice("插件目录未知，无法打开");
									return;
								}
								const fsPath = path.join(this.plugin.actualPluginDir, 'assets');
								const fileUrl = `file://${fsPath}`;
								window.open(fileUrl);
								new Notice("已尝试打开目录");
							} catch (e) {
								new Notice("打开失败: " + (e as Error).message);
							}
						}));
				}

				tabContents.createEl("div", { text: "手动安装步骤:", cls: "setting-item-description" });
				const steps = tabContents.createEl("ol", { cls: "setting-item-description" });
				[
					'下载 assets.zip',
					'解压得到 assets 文件夹',
					'放入本插件根目录',
					'重启 Obsidian'
				].forEach(s => steps.createEl('li', { text: s }));

				tabContents.createEl("div", { text: "预期文件结构:", cls: "setting-item-description", attr: { style: 'margin-top:20px;font-weight:bold;' } });
				const pre = tabContents.createEl("pre", { cls: "setting-item-description" });
				pre.createEl("code", { text: `插件根目录/\n├── main.js\n├── manifest.json\n├── styles.css\n└── assets/\n    ├── ${ASSET_FILES.ALPHA_TAB}\n    ├── ${ASSET_FILES.BRAVURA}\n    └── ${ASSET_FILES.SOUNDFONT}` });
			} else if (tabId === 'about') {
				tabContents.createEl('h3', { text: '关于' });
				tabContents.createEl('p', { text: 'AlphaTab 插件 by YourName.' });
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

	/** 刷新当前资产 UI（保留激活标签） */
	private async refreshAssetsUI(render: (id: string) => Promise<void>, current: string) {
		await render(current);
	}
}
