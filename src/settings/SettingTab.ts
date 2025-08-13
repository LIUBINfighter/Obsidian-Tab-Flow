import {
	App,
	PluginSettingTab,
	Setting,
	Notice,
	normalizePath,
} from "obsidian";
import * as path from "path";
import MyPlugin from "../main";
import { ASSET_FILES } from "../services/ResourceLoaderService";

export interface TabFlowSettings {
	mySetting: string;
	assetsDownloaded?: boolean;
	lastAssetsCheck?: number;
	simpleAssetCheck?: boolean;
	/** 开发者选项：显示 Debug Bar */
	showDebugBar?: boolean;
    /** 播放栏配置 */
    playBar?: {
        components: PlayBarComponentVisibility;
        order?: string[];
    };
}

export const DEFAULT_SETTINGS: TabFlowSettings = {
	mySetting: "default",
	simpleAssetCheck: false, // 默认使用详细资产状态检查
	assetsDownloaded: false,
	lastAssetsCheck: 0,
	showDebugBar: false,
    playBar: {
        components: {
            playPause: true,
            stop: true,
            tracks: true,
            refresh: true,
            locateCursor: true,
            layoutToggle: true,
            exportMenu: true,
            toTop: true,
            toBottom: true,
            openSettings: true,
            metronome: true,
            countIn: true,
            speed: true,
            staveProfile: true,
            zoom: true,
            progressBar: false,
            audioPlayer: false,
        },
        order: [
            "playPause","stop","metronome","countIn","tracks","refresh",
            "locateCursor","layoutToggle","exportMenu","toTop","toBottom","openSettings",
            "progressBar","speed","staveProfile","zoom","audioPlayer"
        ],
    },
};

export interface PlayBarComponentVisibility {
    playPause: boolean;
    stop: boolean;
    tracks: boolean;
    refresh: boolean;
    locateCursor: boolean;
    layoutToggle: boolean;
    exportMenu: boolean;
    toTop: boolean;
    toBottom: boolean;
    openSettings: boolean;
    metronome: boolean;
    countIn: boolean;
    speed: boolean;
    staveProfile: boolean;
    zoom: boolean;
    progressBar: boolean;
    audioPlayer: boolean;
}

export interface AssetStatus {
	file: string; // 文件名（不含路径）
	exists: boolean; // 是否存在
	path: string; // vault 相对路径 (.obsidian/plugins/...)
	size?: number; // 读取到的大小（字节，可选）
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
		const assetsDir = this.vaultPath(
			".obsidian",
			"plugins",
			pluginId,
			"assets"
		);
		const files = [
			ASSET_FILES.ALPHA_TAB,
			ASSET_FILES.BRAVURA,
			ASSET_FILES.SOUNDFONT,
		];

		const dirExists = await this.app.vault.adapter.exists(assetsDir);
		if (!dirExists) {
			console.log("[SettingTab] Assets directory missing:", assetsDir);
			return files.map((f) => ({
				file: f,
				exists: false,
				path: this.vaultPath(assetsDir, f),
			}));
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
			{ id: "player", name: "播放器配置" },
			{ id: "about", name: "关于" },
		];

		let activeTab = "general";

		const renderTab = async (tabId: string) => {
			tabContents.empty();
			if (tabId === "general") {
				tabContents.createEl("h3", { text: "资源文件管理" });

				const assetsStatusContainer = tabContents.createDiv({
					cls: "setting-item-description",
					attr: {
						style: "margin-bottom: 1em; padding: 10px; border-radius: 5px; background-color: var(--background-secondary);",
					},
				});
				assetsStatusContainer.createEl("strong", {
					text: "资产文件状态检查中...",
				});

				const statuses = await this.collectAssetStatuses();

				const descriptions: Record<string, string> = {
					[ASSET_FILES.ALPHA_TAB]: "AlphaTab 主脚本",
					[ASSET_FILES.BRAVURA]: "乐谱字体文件",
					[ASSET_FILES.SOUNDFONT]: "音色库文件",
				};

				assetsStatusContainer.empty();
				const allOk = statuses.every((s) => s.exists);
				assetsStatusContainer.createEl("div", {
					text: allOk ? "✅ 所有资产文件已安装" : "❌ 资产文件不完整",
					attr: {
						style: `font-weight: bold; color: ${
							allOk ? "var(--text-success)" : "var(--text-error)"
						}; margin-bottom: 10px;`,
					},
				});

				const list = assetsStatusContainer.createEl("ul", {
					attr: { style: "margin:0;padding-left:20px;" },
				});
				statuses.forEach((s) => {
					const li = list.createEl("li");
					const color = s.exists
						? "var(--text-success)"
						: "var(--text-error)";
					const icon = s.exists ? "✅" : "❌";
					const sizeText =
						s.size != null
							? ` - ${(s.size / 1024).toFixed(1)} KB`
							: "";
					li.innerHTML = `<span style="color:${color}">${icon} ${
						s.file
					}</span> - ${
						descriptions[s.file] || "资源文件"
					} <span style="color:${color};font-style:italic;">(${
						s.exists ? "已安装" : "未安装"
					})</span>${sizeText}`;
				});

				if (this.plugin.settings.lastAssetsCheck) {
					const lastCheck = new Date(
						this.plugin.settings.lastAssetsCheck
					);
					assetsStatusContainer.createEl("div", {
						text: `上次下载/检查时间: ${lastCheck.toLocaleString()}`,
						attr: {
							style: "margin-top:10px;font-size:0.9em;color:var(--text-muted);",
						},
					});
				}

				// 操作按钮区域
				const actionSetting = new Setting(tabContents)
					.setName(allOk ? "重新下载资产文件" : "下载缺失的资产文件")
					.setDesc(
						allOk
							? "如怀疑文件损坏，可重新下载"
							: "下载后需重启 Obsidian"
					);
				const buttons = actionSetting.controlEl.createDiv({
					attr: { style: "display:flex;gap:8px;" },
				});

				const downloadBtn = buttons.createEl("button", {
					text: allOk ? "重新下载" : "下载资源文件",
					cls: "mod-cta",
				});
				const restartBtn = buttons.createEl("button", {
					text: "重启 Obsidian",
					cls: "mod-warning",
					attr: {
						style: this.plugin.settings.assetsDownloaded
							? ""
							: "display:none;",
					},
				});

				downloadBtn.onclick = async () => {
					downloadBtn.disabled = true;
					downloadBtn.textContent = "正在下载...";
					const ok = await this.plugin.downloadAssets?.();
					if (ok) {
						new Notice(
							"资源文件已下载，必要时请重启 Obsidian 应用"
						);
						restartBtn.style.display = "inline-block";
						await this.refreshAssetsUI(renderTab, tabId); // 重新渲染以更新状态
					} else {
						downloadBtn.disabled = false;
						downloadBtn.textContent = allOk
							? "重新下载"
							: "重试下载";
					}
				};

				// 新增：打开插件根目录按钮
				const openDirBtn = buttons.createEl("button", {
					text: "打开插件根目录",
					cls: "mod-info",
				});
				openDirBtn.onclick = () => {
					// 仅桌面端可用
					try {
						// 获取 main.js 的绝对路径
						const basePath = (
							this.app.vault.adapter as any
						).getBasePath?.();
						if (!basePath) {
							new Notice("仅支持桌面端 Obsidian");
							return;
						}
						const pluginDir = path.join(
							basePath,
							".obsidian",
							"plugins",
							this.plugin.manifest.id
						);
						const mainJsPath = path.join(pluginDir, "main.js");
						// Electron shell API
						// @ts-ignore
						const { shell } = require("electron");
						shell.showItemInFolder(mainJsPath);
					} catch (e) {
						new Notice("打开目录失败: " + e);
					}
				};

				restartBtn.onclick = () => {
					if (
						confirm(
							"确定要重启 Obsidian 吗？请确认已保存全部内容。"
						)
					) {
						// @ts-ignore
						app.commands.executeCommandById("app:reload");
					}
				};

				// tabContents.createEl("div", { text: "说明：插件需要以下文件：", cls: "setting-item-description", });
				// const ul = tabContents.createEl("ul", { cls: "setting-item-description" });
				// [
				// 	`${ASSET_FILES.ALPHA_TAB} - AlphaTab 主脚本`,
				// 	`${ASSET_FILES.BRAVURA} - 乐谱字体`,
				// 	`${ASSET_FILES.SOUNDFONT} - 音色库`
				// ].forEach(t => ul.createEl("li", { text: t }));

				// tabContents.createEl("div", { text: "这些文件保存在插件目录 assets/ 下。", cls: "setting-item-description" });
				// const version = this.plugin.manifest?.version ?? "latest";
				// const assetsZipUrl = `https://github.com/LIUBINfighter/interactive-tabs/releases/download/${version}/assets.zip`;
				// new Setting(tabContents)
				// 	.setName("资源下载链接")
				// 	.setDesc("自动下载失败时，可手动下载并解压到插件目录")
				// 	.addButton((b) =>
				// 		b.setButtonText("复制链接").onClick(() => {
				// 			navigator.clipboard.writeText(assetsZipUrl).then(
				// 				() => new Notice("已复制"),
				// 				(e) => new Notice("复制失败: " + e)
				// 			);
				// 		})
				// 	);
				// const urlWrap = tabContents.createDiv({
				// 	cls: "setting-item-description",
				// });
				// urlWrap.createEl("strong", { text: "下载地址: " });
				// const urlSpan = urlWrap.createEl("span", {
				// 	text: assetsZipUrl,
				// });
				// urlSpan.style.wordBreak = "break-all";

				// tabContents.createEl("div", {
				// 	text: "手动安装步骤:",
				// 	cls: "setting-item-description",
				// });
				// const steps = tabContents.createEl("ol", {
				// 	cls: "setting-item-description",
				// });
				// [
				// 	"下载 assets.zip",
				// 	"解压得到 assets 文件夹",
				// 	"放入本插件根目录",
				// 	"重启 Obsidian",
				// ].forEach((s) => steps.createEl("li", { text: s }));

				tabContents.createEl("div", {
					// text: "预期文件结构:",
					cls: "setting-item-description",
					attr: { style: "margin-top:20px;font-weight:bold;" },
				});
				const pre = tabContents.createEl("pre", {
					cls: "setting-item-description",
				});
				pre.createEl("code", {
					text: `.obsidian/tab-flow/\n├── main.js\n├── manifest.json\n├── styles.css\n└── assets/\n    ├── ${ASSET_FILES.ALPHA_TAB}\n    ├── ${ASSET_FILES.BRAVURA}\n    └── ${ASSET_FILES.SOUNDFONT}`,
				});
			} else if (tabId === "player") {
				// 播放器配置
				tabContents.createEl("h3", { text: "播放器配置" });
				tabContents.createEl("div", {
					text: "以下为开发者选项，用于显示/隐藏 Debug Bar（实验与诊断用途）",
					cls: "setting-item-description",
				});

				new Setting(tabContents)
					.setName("显示 Debug Bar（开发者选项）")
					.setDesc("启用后在视图顶部显示调试栏，用于实验功能和问题诊断。")
					.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.showDebugBar ?? false)
							.onChange(async (value) => {
								this.plugin.settings.showDebugBar = value;
								await this.plugin.saveSettings();
								// 实时通知工作区：调试栏开关变化
								try {
									// @ts-ignore - Obsidian 支持触发自定义事件
									this.app.workspace.trigger('tabflow:debugbar-toggle', value);
								} catch {}
								new Notice(value ? "已启用 Debug Bar" : "已隐藏 Debug Bar");
							});
					});

				// 可视化编辑（推荐）：组件卡片（拖拽/上下移动/开关）
				tabContents.createEl("h4", { text: "可视化编辑（拖拽排序 + 开关）" });
				const cardsWrap = tabContents.createDiv({ attr: { style: "display:flex; flex-direction:column; gap:8px;" } });
				const meta: Array<{ key: keyof PlayBarComponentVisibility | 'audioPlayer'; label: string; desc?: string; disabled?: boolean }>= [
					{ key: 'playPause', label: '播放/暂停' },
					{ key: 'stop', label: '停止' },
					{ key: 'metronome', label: '节拍器' },
					{ key: 'countIn', label: '预备拍' },
					{ key: 'tracks', label: '选择音轨' },
					{ key: 'refresh', label: '刷新/重建播放器' },
					{ key: 'locateCursor', label: '滚动到光标' },
					{ key: 'layoutToggle', label: '布局切换' },
					{ key: 'exportMenu', label: '导出菜单' },
					{ key: 'toTop', label: '回到顶部' },
					{ key: 'toBottom', label: '回到底部' },
					{ key: 'openSettings', label: '打开设置' },
					{ key: 'progressBar', label: '进度条' },
					{ key: 'speed', label: '速度选择' },
					{ key: 'staveProfile', label: '谱表选择' },
					{ key: 'zoom', label: '缩放选择' },
					{ key: 'audioPlayer', label: '原生音频播放器（实验性）', disabled: true, desc: '暂不可用，存在与 AlphaTab 播放器冲突风险' },
				];

				const getOrder = (): string[] => {
					const def = [
						"playPause","stop","metronome","countIn","tracks","refresh",
						"locateCursor","layoutToggle","exportMenu","toTop","toBottom","openSettings",
						"progressBar","speed","staveProfile","zoom","audioPlayer"
					];
					const saved = this.plugin.settings.playBar?.order;
					return Array.isArray(saved) && saved.length ? saved.slice() : def.slice();
				};

				let draggingKey: string | null = null;
				const renderCards = () => {
					cardsWrap.empty();
					const order = getOrder().filter(k => meta.some(m => m.key === (k as any)));
					const comp = this.plugin.settings.playBar?.components || ({} as any);
					order.forEach((key) => {
						const m = meta.find(x => x.key === (key as any));
						if (!m) return;
						const card = cardsWrap.createDiv({ cls: 'tabflow-card', attr: { draggable: 'true', style: 'display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px; border:1px solid var(--background-modifier-border); border-radius:6px;' } });
						card.dataset.key = String(key);
						const left = card.createDiv({ attr: { style: 'display:flex; align-items:center; gap:8px;' } });
						left.createSpan({ text: '⠿', attr: { style: 'cursor:grab; user-select:none;' } });
						left.createEl('strong', { text: m.label });
						if (m.desc) left.createSpan({ text: ` - ${m.desc}`, attr: { style: 'color:var(--text-muted);font-size:0.9em;' } });
						const right = card.createDiv({ attr: { style: 'display:flex; align-items:center; gap:6px;' } });
						const upBtn = right.createEl('button', { text: '↑' });
						const downBtn = right.createEl('button', { text: '↓' });
						new Setting(right).addToggle(t => {
							const current = !!(comp as any)[key];
							t.setValue(m.disabled ? false : current).onChange(async (v) => {
								this.plugin.settings.playBar = this.plugin.settings.playBar || { components: {} as any };
								(this.plugin.settings.playBar.components as any)[key] = m.disabled ? false : v;
								await this.plugin.saveSettings();
								try { /* @ts-ignore */ this.app.workspace.trigger('tabflow:playbar-components-changed'); } catch {}
							});
							if (m.disabled) (t as any).toggleEl.querySelector('input')?.setAttribute('disabled','true');
						});

						upBtn.onclick = async () => {
							const cur = getOrder();
							const i = cur.indexOf(String(key));
							if (i > 0) {
								[cur[i-1], cur[i]] = [cur[i], cur[i-1]];
								this.plugin.settings.playBar = this.plugin.settings.playBar || { components: {} as any };
								(this.plugin.settings.playBar as any).order = cur;
								await this.plugin.saveSettings();
								renderCards();
								try { /* @ts-ignore */ this.app.workspace.trigger('tabflow:playbar-components-changed'); } catch {}
							}
						};
						downBtn.onclick = async () => {
							const cur = getOrder();
							const i = cur.indexOf(String(key));
							if (i >= 0 && i < cur.length - 1) {
								[cur[i+1], cur[i]] = [cur[i], cur[i+1]];
								this.plugin.settings.playBar = this.plugin.settings.playBar || { components: {} as any };
								(this.plugin.settings.playBar as any).order = cur;
								await this.plugin.saveSettings();
								renderCards();
								try { /* @ts-ignore */ this.app.workspace.trigger('tabflow:playbar-components-changed'); } catch {}
							}
						};

						card.addEventListener('dragstart', (e) => { draggingKey = String(key); (e.dataTransfer as DataTransfer).effectAllowed = 'move'; });
						card.addEventListener('dragover', (e) => { e.preventDefault(); (e.dataTransfer as DataTransfer).dropEffect = 'move'; card.style.background = 'var(--background-modifier-hover)'; });
						card.addEventListener('dragleave', () => { card.style.background = ''; });
						card.addEventListener('drop', async () => {
							card.style.background = '';
							if (!draggingKey || draggingKey === key) return;
							const cur = getOrder();
							const from = cur.indexOf(String(draggingKey));
							const to = cur.indexOf(String(key));
							if (from < 0 || to < 0) return;
							// 互换位置（覆盖则交换，更符合直觉）
							[cur[from], cur[to]] = [cur[to], cur[from]];
							this.plugin.settings.playBar = this.plugin.settings.playBar || { components: {} as any };
							(this.plugin.settings.playBar as any).order = cur;
							await this.plugin.saveSettings();
							renderCards();
							try { /* @ts-ignore */ this.app.workspace.trigger('tabflow:playbar-components-changed'); } catch {}
							draggingKey = null;
						});
					});
				};
				renderCards();

				// PlayBar 组件可见性
				tabContents.createEl("h4", { text: "播放栏组件" });
				const comp = this.plugin.settings.playBar?.components || ({} as any);
				const addToggle = (name: string, key: keyof typeof comp, desc?: string) => {
					new Setting(tabContents)
						.setName(name)
						.setDesc(desc || "")
						.addToggle((t) => {
							t.setValue(Boolean(comp[key] ?? true)).onChange(async (v) => {
								this.plugin.settings.playBar = this.plugin.settings.playBar || { components: {} as any };
								(this.plugin.settings.playBar.components as any)[key] = v;
								await this.plugin.saveSettings();
								try {
									// @ts-ignore
									this.app.workspace.trigger('tabflow:playbar-components-changed');
								} catch {}
							});
						});
				};
				addToggle("播放/暂停", "playPause");
				addToggle("停止", "stop");
				addToggle("选择音轨", "tracks");
				addToggle("刷新/重建播放器", "refresh");
				addToggle("滚动到光标", "locateCursor");
				addToggle("布局切换", "layoutToggle");
				addToggle("导出菜单", "exportMenu");
				addToggle("回到顶部", "toTop");
				addToggle("回到底部", "toBottom");
				addToggle("打开设置", "openSettings");
				addToggle("节拍器", "metronome");
				addToggle("预备拍", "countIn");
				addToggle("速度选择", "speed");
				addToggle("谱表选择", "staveProfile");
				addToggle("缩放选择", "zoom");
				addToggle("进度条", "progressBar", "与原生音频播放器二选一");

				// 原生音频播放器：暂不可用（前端禁用，避免被激活）
				{
					const s = new Setting(tabContents)
						.setName("原生音频播放器（实验性）")
						.setDesc(
							"暂不可用：与 AlphaTab 内置播放器存在冲突，可能导致双声叠加、播放位置不同步、导出占用冲突、内存消耗异常等问题。待后续修复。"
						)
						.addToggle((t) => {
							const current = Boolean(comp["audioPlayer"] ?? false);
							t.setValue(false);
							t.setDisabled(true);
							// 如历史上用户曾开启，这里强制关闭并保存，确保前端不激活
							if (current) {
								this.plugin.settings.playBar = this.plugin.settings.playBar || { components: {} as any };
								(this.plugin.settings.playBar.components as any)["audioPlayer"] = false;
								this.plugin.saveSettings();
							}
						});
				}

				// 顺序编辑（简单文本逗号分隔）
				tabContents.createEl("h4", { text: "组件顺序" });
				new Setting(tabContents)
					.setName("渲染顺序")
					.setDesc("使用逗号分隔组件键名，未知键将被忽略。清空则恢复默认顺序。")
					.addText((t) => {
						const current = (this.plugin.settings.playBar?.order || []).join(",");
						t.setPlaceholder("playPause,stop,metronome,...")
						 .setValue(current)
						 .onChange(async (v) => {
							const arr = v.split(",").map(s => s.trim()).filter(Boolean);
							this.plugin.settings.playBar = this.plugin.settings.playBar || { components: {} as any };
							(this.plugin.settings.playBar as any).order = arr.length > 0 ? arr : undefined;
							await this.plugin.saveSettings();
							try {
								// @ts-ignore
								this.app.workspace.trigger('tabflow:playbar-components-changed');
							} catch {}
						 });
					});

			} else if (tabId === "about") {
				tabContents.createEl("h3", { text: "关于" });
				tabContents.createEl("p", {
					text: "Tab Flow by Jay Bridge",
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

	/** 刷新当前资产 UI（保留激活标签） */
	private async refreshAssetsUI(
		render: (id: string) => Promise<void>,
		current: string
	) {
		await render(current);
	}
}
