import {
	App,
	PluginSettingTab,
	Setting,
	Notice,
	normalizePath,
} from "obsidian";
import * as path from "path";
import TabFlowPlugin from "../main";
import { ASSET_FILES } from "../services/ResourceLoaderService";

export interface TabFlowSettings {
	mySetting: string;
	assetsDownloaded?: boolean;
	lastAssetsCheck?: number;
	simpleAssetCheck?: boolean;
	/** 开发者选项：显示 Debug Bar */
	showDebugBar?: boolean;
	/** 自动打开 AlphaTex 文件 */
	autoOpenAlphaTexFiles?: boolean;
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
	autoOpenAlphaTexFiles: false, // 默认不自动打开 AlphaTex 文件
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
			progressBar: true,
			audioPlayer: false,
		},
		order: [
			"playPause",
			"stop",
			"metronome",
			"countIn",
			"tracks",
			"refresh",
			"locateCursor",
			"layoutToggle",
			"exportMenu",
			"toTop",
			"toBottom",
			"openSettings",
			"progressBar",
			"speed",
			"staveProfile",
			"zoom",
			"audioPlayer",
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
	plugin: TabFlowPlugin;
	private _eventBound = false;

	constructor(app: App, plugin: TabFlowPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		// 绑定一次全局事件：跳转到本插件设置的“播放器配置”子页签
		if (!this._eventBound) {
			// @ts-ignore
			this.app.workspace.on("tabflow:open-plugin-settings-player",
				async () => {
					try {
						// 打开设置面板并定位到本插件设置页
						// @ts-ignore
						this.app.setting.open();
						// @ts-ignore 可能存在的API：openTabById
						if (this.app.setting.openTabById) {
							// @ts-ignore
							this.app.setting.openTabById(
								this.plugin.manifest.id
							);
						}
						// 提示 display 使用 player 作为默认活动子页签
						(this as any)._forceActiveInnerTab = "player";
						// 如果当前就是本插件设置页，强制重绘
						try {
							await this.display();
						} catch {}
					} catch {}
				}
			);
			this._eventBound = true;
		}
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

		let activeTab = (this as any)._forceActiveInnerTab || "general";
		(this as any)._forceActiveInnerTab = undefined;

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
				// const assetsZipUrl = `https://github.com/LIUBINfighter/obsidian-tab-flow/releases/download/${version}/assets.zip`;
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
				// new Setting(tabContents)
				// 	.setName("自动打开 AlphaTex 文件")
				// 	.setDesc(
				// 		"启用后，双击 .alphatab 或 .alphatex 文件时会自动使用 TabView 打开。禁用时只能通过右键菜单「Preview in AlphaTab」打开。"
				// 	)
				// 	.addToggle((toggle) => {
				// 		toggle
				// 			.setValue(
				// 				this.plugin.settings.autoOpenAlphaTexFiles ??
				// 					false
				// 			)
				// 			.onChange(async (value) => {
				// 				this.plugin.settings.autoOpenAlphaTexFiles =
				// 					value;
				// 				await this.plugin.saveSettings();
				// 				new Notice(
				// 					value
				// 						? "已启用自动打开 AlphaTex 文件"
				// 						: "已禁用自动打开 AlphaTex 文件，需重启 Obsidian 生效"
				// 				);
				// 			});
				// 	});

				// 可视化编辑（推荐）：组件卡片（拖拽/上下移动/开关）
				tabContents.createEl("h4", {
					text: "可视化编辑（拖拽排序 + 开关）",
				});
				// 恢复默认设置按钮
				new Setting(tabContents)
					.setName("恢复默认")
					.setDesc("重置播放栏组件的显示开关与顺序为默认配置")
					.addButton((btn) => {
						btn.setButtonText("恢复默认").onClick(async () => {
							try {
								this.plugin.settings.playBar = {
									components: JSON.parse(
										JSON.stringify(
											DEFAULT_SETTINGS.playBar
												?.components || {}
										)
									),
									order: (
										DEFAULT_SETTINGS.playBar?.order || []
									).slice(),
								};
								await this.plugin.saveSettings();
								renderCards();

								// 通知视图即时应用
								try {
									/* @ts-ignore */ this.app.workspace.trigger(
										"tabflow:playbar-components-changed"
									);
								} catch {}
								new Notice("已恢复默认设置");
							} catch (e) {
								new Notice("恢复默认失败: " + e);
							}
						});
					});
				const cardsWrap = tabContents.createDiv({
					attr: {
						style: "display:flex; flex-direction:column; gap:8px;",
					},
				});
				const meta: Array<{
					key: keyof PlayBarComponentVisibility | "audioPlayer";
					label: string;
					icon: string;
					desc?: string;
					disabled?: boolean;
				}> = [
					{ key: "playPause", label: "播放/暂停", icon: "play" },
					{ key: "stop", label: "停止", icon: "square" },
					{
						key: "metronome",
						label: "节拍器",
						icon: "lucide-music-2",
					},
					{ key: "countIn", label: "预备拍", icon: "lucide-timer" },
					{ key: "tracks", label: "选择音轨", icon: "lucide-layers" },
					{
						key: "refresh",
						label: "刷新/重建播放器",
						icon: "lucide-refresh-ccw",
					},
					{
						key: "locateCursor",
						label: "滚动到光标",
						icon: "lucide-crosshair",
					},
					{
						key: "layoutToggle",
						label: "布局切换",
						icon: "lucide-layout",
					},
					{
						key: "exportMenu",
						label: "导出菜单",
						icon: "lucide-download",
					},
					{
						key: "toTop",
						label: "回到顶部",
						icon: "lucide-chevrons-up",
					},
					{
						key: "toBottom",
						label: "回到底部",
						icon: "lucide-chevrons-down",
					},
					{
						key: "openSettings",
						label: "打开设置",
						icon: "settings",
					},
					{
						key: "progressBar",
						label: "进度条",
						icon: "lucide-line-chart",
					},
					{ key: "speed", label: "速度选择", icon: "lucide-gauge" },
					{
						key: "staveProfile",
						label: "谱表选择",
						icon: "lucide-list-music",
					},
					{ key: "zoom", label: "缩放选择", icon: "lucide-zoom-in" },
					{
						key: "audioPlayer",
						label: "原生音频播放器（实验性）",
						icon: "audio-file",
						disabled: true,
						desc: "暂不可用，存在与 AlphaTab 播放器冲突风险",
					},
				];

				const getOrder = (): string[] => {
					const def = [
						"playPause",
						"stop",
						"metronome",
						"countIn",
						"tracks",
						"refresh",
						"locateCursor",
						"layoutToggle",
						"exportMenu",
						"toTop",
						"toBottom",
						"openSettings",
						"progressBar",
						"speed",
						"staveProfile",
						"zoom",
						"audioPlayer",
					];
					const saved = this.plugin.settings.playBar?.order;
					return Array.isArray(saved) && saved.length
						? saved.slice()
						: def.slice();
				};

				let draggingKey: string | null = null;
				const clearDndHighlights = () => {
					const cards = cardsWrap.querySelectorAll(".tabflow-card");
					cards.forEach((el) => {
						el.classList.remove(
							"insert-before",
							"insert-after",
							"swap-target"
						);
						(el as HTMLElement).style.background = "";
					});
				};
				const renderCards = () => {
					cardsWrap.empty();
					const order = getOrder().filter((k) =>
						meta.some((m) => m.key === (k as any))
					);
					const comp =
						this.plugin.settings.playBar?.components || ({} as any);
					order.forEach((key) => {
						const m = meta.find((x) => x.key === (key as any));
						if (!m) return;
						const card = cardsWrap.createDiv({
							cls: "tabflow-card",
							attr: {
								draggable: "true",
								style: "display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px; border:1px solid var(--background-modifier-border); border-radius:6px;",
							},
						});
						card.dataset.key = String(key);
						const left = card.createDiv({
							attr: {
								style: "display:flex; align-items:center; gap:8px;",
							},
						});
						left.createSpan({
							text: "⠿",
							attr: { style: "cursor:grab; user-select:none;" },
						});
						const iconEl = left.createSpan();
						// @ts-ignore Obsidian setIcon
						(require("obsidian") as any).setIcon(iconEl, m.icon);
						left.createEl("strong", { text: m.label });
						if (m.desc)
							left.createSpan({
								text: ` - ${m.desc}`,
								attr: {
									style: "color:var(--text-muted);font-size:0.9em;",
								},
							});
						const right = card.createDiv({
							attr: {
								style: "display:flex; align-items:center; gap:6px;",
							},
						});
						const upIcon = right.createSpan({
							cls: "icon-clickable",
							attr: {
								"aria-label": "上移",
								role: "button",
								tabindex: "0",
							},
						});
						(require("obsidian") as any).setIcon(
							upIcon,
							"lucide-arrow-up"
						);
						const downIcon = right.createSpan({
							cls: "icon-clickable",
							attr: {
								"aria-label": "下移",
								role: "button",
								tabindex: "0",
							},
						});
						(require("obsidian") as any).setIcon(
							downIcon,
							"lucide-arrow-down"
						);
						new Setting(right).addToggle((t) => {
							const current = !!(comp as any)[key];
							t.setValue(m.disabled ? false : current).onChange(
								async (v) => {
									this.plugin.settings.playBar = this.plugin
										.settings.playBar || {
										components: {} as any,
									};
									(
										this.plugin.settings.playBar
											.components as any
									)[key] = m.disabled ? false : v;
									await this.plugin.saveSettings();
									try {
										/* @ts-ignore */ this.app.workspace.trigger(
											"tabflow:playbar-components-changed"
										);
									} catch {}
								}
							);
							if (m.disabled)
								(t as any).toggleEl
									.querySelector("input")
									?.setAttribute("disabled", "true");
						});

						const getScrollContainer = (
							el: HTMLElement
						): HTMLElement | Window => {
							let node: HTMLElement | null = el.parentElement;
							while (node) {
								const hasScrollableSpace =
									node.scrollHeight > node.clientHeight + 1;
								const style = getComputedStyle(node);
								const overflowY = style.overflowY;
								if (
									hasScrollableSpace &&
									(overflowY === "auto" ||
										overflowY === "scroll" ||
										overflowY === "overlay")
								) {
									return node;
								}
								node = node.parentElement;
							}
							return window;
						};

						const keepPointerOverRow = async (
							rowKey: string,
							update: () => Promise<void> | void
						) => {
							const oldRect = card.getBoundingClientRect();
							const scrollContainer = getScrollContainer(card);
							await Promise.resolve(update());
							const newCard = cardsWrap.querySelector(
								`.tabflow-card[data-key="${rowKey}"]`
							) as HTMLElement | null;
							if (!newCard) return;
							const newRect = newCard.getBoundingClientRect();
							const delta = newRect.top - oldRect.top;
							if (delta !== 0) {
								if (scrollContainer === window) {
									window.scrollBy(0, delta);
								} else {
									(
										scrollContainer as HTMLElement
									).scrollTop += delta;
								}
							}
						};

						const moveUp = async () => {
							const cur = getOrder();
							const i = cur.indexOf(String(key));
							if (i > 0) {
								await keepPointerOverRow(
									String(key),
									async () => {
										[cur[i - 1], cur[i]] = [
											cur[i],
											cur[i - 1],
										];
										this.plugin.settings.playBar = this
											.plugin.settings.playBar || {
											components: {} as any,
										};
										(
											this.plugin.settings.playBar as any
										).order = cur;
										await this.plugin.saveSettings();
										renderCards();
									}
								);
								try {
									/* @ts-ignore */ this.app.workspace.trigger(
										"tabflow:playbar-components-changed"
									);
								} catch {}
							}
						};
						const moveDown = async () => {
							const cur = getOrder();
							const i = cur.indexOf(String(key));
							if (i >= 0 && i < cur.length - 1) {
								await keepPointerOverRow(
									String(key),
									async () => {
										[cur[i + 1], cur[i]] = [
											cur[i],
											cur[i + 1],
										];
										this.plugin.settings.playBar = this
											.plugin.settings.playBar || {
											components: {} as any,
										};
										(
											this.plugin.settings.playBar as any
										).order = cur;
										await this.plugin.saveSettings();
										renderCards();
									}
								);
								try {
									/* @ts-ignore */ this.app.workspace.trigger(
										"tabflow:playbar-components-changed"
									);
								} catch {}
							}
						};

						upIcon.addEventListener("click", () => {
							moveUp();
						});
						upIcon.addEventListener(
							"keydown",
							(e: KeyboardEvent) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									moveUp();
								}
							}
						);
						downIcon.addEventListener("click", () => {
							moveDown();
						});
						downIcon.addEventListener(
							"keydown",
							(e: KeyboardEvent) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									moveDown();
								}
							}
						);

						card.addEventListener("dragstart", (e) => {
							draggingKey = String(key);
							(e.dataTransfer as DataTransfer).effectAllowed =
								"move";
						});
						card.addEventListener("dragover", (e) => {
							e.preventDefault();
							(e.dataTransfer as DataTransfer).dropEffect =
								"move";
							clearDndHighlights();
							const rect = card.getBoundingClientRect();
							const offsetY = (e as DragEvent).clientY - rect.top;
							const ratio = offsetY / rect.height;
							if (ratio < 0.33) {
								card.classList.add("insert-before");
							} else if (ratio > 0.66) {
								card.classList.add("insert-after");
							} else {
								card.classList.add("swap-target");
							}
						});
						card.addEventListener("dragleave", () => {
							clearDndHighlights();
						});
						card.addEventListener("dragend", () => {
							clearDndHighlights();
						});
						card.addEventListener("drop", async () => {
							const isInsertBefore =
								card.classList.contains("insert-before");
							const isInsertAfter =
								card.classList.contains("insert-after");
							const isSwap =
								card.classList.contains("swap-target");
							clearDndHighlights();
							if (!draggingKey || draggingKey === key) return;
							const list = getOrder();
							const from = list.indexOf(String(draggingKey));
							const to = list.indexOf(String(key));
							if (from < 0 || to < 0) return;
							const cur = list.slice();
							if (isSwap) {
								[cur[from], cur[to]] = [cur[to], cur[from]];
							} else {
								let insertIndex = to + (isInsertAfter ? 1 : 0);
								const [moved] = cur.splice(from, 1);
								if (from < insertIndex) insertIndex -= 1;
								cur.splice(insertIndex, 0, moved);
							}
							this.plugin.settings.playBar = this.plugin.settings
								.playBar || { components: {} as any };
							(this.plugin.settings.playBar as any).order = cur;
							await this.plugin.saveSettings();
							renderCards();
							try {
								/* @ts-ignore */ this.app.workspace.trigger(
									"tabflow:playbar-components-changed"
								);
							} catch {}
							draggingKey = null;
						});
					});
				};
				renderCards();

				// PlayBar 组件可见性
				// tabContents.createEl("h4", { text: "播放栏组件" });
				// const comp = this.plugin.settings.playBar?.components || ({} as any);
				// const addToggle = (name: string, key: keyof typeof comp, desc?: string) => {
				// 	new Setting(tabContents)
				// 		.setName(name)
				// 		.setDesc(desc || "")
				// 		.addToggle((t) => {
				// 			t.setValue(Boolean(comp[key] ?? true)).onChange(async (v) => {
				// 				this.plugin.settings.playBar = this.plugin.settings.playBar || { components: {} as any };
				// 				(this.plugin.settings.playBar.components as any)[key] = v;
				// 				await this.plugin.saveSettings();
				// 				try {
				// 					// @ts-ignore
				// 					this.app.workspace.trigger('tabflow:playbar-components-changed');
				// 				} catch {}
				// 			});
				// 		});
				// };
				// addToggle("播放/暂停", "playPause");
				// addToggle("停止", "stop");
				// addToggle("选择音轨", "tracks");
				// addToggle("刷新/重建播放器", "refresh");
				// addToggle("滚动到光标", "locateCursor");
				// addToggle("布局切换", "layoutToggle");
				// addToggle("导出菜单", "exportMenu");
				// addToggle("回到顶部", "toTop");
				// addToggle("回到底部", "toBottom");
				// addToggle("打开设置", "openSettings");
				// addToggle("节拍器", "metronome");
				// addToggle("预备拍", "countIn");
				// addToggle("速度选择", "speed");
				// addToggle("谱表选择", "staveProfile");
				// addToggle("缩放选择", "zoom");
				// addToggle("进度条", "progressBar", "与原生音频播放器二选一");

				// // 原生音频播放器：暂不可用（前端禁用，避免被激活）
				// {
				// 	const s = new Setting(tabContents)
				// 		.setName("原生音频播放器（实验性）")
				// 		.setDesc(
				// 			"暂不可用：与 AlphaTab 内置播放器存在冲突，可能导致双声叠加、播放位置不同步、导出占用冲突、内存消耗异常等问题。待后续修复。"
				// 		)
				// 		.addToggle((t) => {
				// 			const current = Boolean(comp["audioPlayer"] ?? false);
				// 			t.setValue(false);
				// 			t.setDisabled(true);
				// 			// 如历史上用户曾开启，这里强制关闭并保存，确保前端不激活
				// 			if (current) {
				// 				this.plugin.settings.playBar = this.plugin.settings.playBar || { components: {} as any };
				// 				(this.plugin.settings.playBar.components as any)["audioPlayer"] = false;
				// 				this.plugin.saveSettings();
				// 			}
				// 		});
				// }

				// // 顺序编辑（简单文本逗号分隔）
				// tabContents.createEl("h4", { text: "组件顺序" });
				// new Setting(tabContents)
				// 	.setName("渲染顺序")
				// 	.setDesc("使用逗号分隔组件键名，未知键将被忽略。清空则恢复默认顺序。")
				// 	.addText((t) => {
				// 		const current = (this.plugin.settings.playBar?.order || []).join(",");
				// 		t.setPlaceholder("playPause,stop,metronome,...")
				// 		 .setValue(current)
				// 		 .onChange(async (v) => {
				// 			const arr = v.split(",").map(s => s.trim()).filter(Boolean);
				// 			this.plugin.settings.playBar = this.plugin.settings.playBar || { components: {} as any };
				// 			(this.plugin.settings.playBar as any).order = arr.length > 0 ? arr : undefined;
				// 			await this.plugin.saveSettings();
				// 			try {
				// 				// @ts-ignore
				// 				this.app.workspace.trigger('tabflow:playbar-components-changed');
				// 			} catch {}
				// 		 });
				// 	});

				// 播放器配置
				tabContents.createEl("h3", { text: "Debug Bar" });
				tabContents.createEl("div", {
					text: "以下为开发者选项，用于显示/隐藏 Debug Bar（实验与诊断用途）",
					cls: "setting-item-description",
				});

				new Setting(tabContents)
					.setName("显示 Debug Bar（开发者选项）")
					.setDesc(
						"启用后在视图顶部显示调试栏，用于实验功能和问题诊断。"
					)
					.addToggle((toggle) => {
						toggle
							.setValue(
								this.plugin.settings.showDebugBar ?? false
							)
							.onChange(async (value) => {
								this.plugin.settings.showDebugBar = value;
								await this.plugin.saveSettings();
								// 实时通知工作区：调试栏开关变化
								try {
									// @ts-ignore - Obsidian 支持触发自定义事件
									this.app.workspace.trigger(
										"tabflow:debugbar-toggle",
										value
									);
								} catch {}
								new Notice(
									value
										? "已启用 Debug Bar"
										: "已隐藏 Debug Bar"
								);
							});
					});
			} else if (tabId === "about") {
				tabContents.createEl("h3", { text: "关于" });
				tabContents.createEl("p", {
					text: "Tab Flow by Jay Bridge",
				});

				// 快速打开 AlphaTex 文档视图按钮
				new Setting(tabContents)
					.setName("AlphaTex 文档")
					.setDesc("打开 AlphaTex 快速文档视图，包含语法速查与示例。")
					.addButton((btn) => {
						btn.setButtonText("打开文档").onClick(async () => {
							try {
								new Notice("尝试打开 AlphaTex 文档视图...");
								console.log(
									"[SettingTab] open-doc button clicked"
								);
								// 优先通过已注册的命令触发（某些环境命令API可能同步或不可await）
								try {
									const execFn =
										(this.app as any).commands &&
										(this.app as any).commands
											.executeCommandById;
									if (typeof execFn === "function") {
										const res = execFn.call(
											(this.app as any).commands,
											"open-tabflow-doc-view"
										);
										console.log(
											"[SettingTab] executeCommandById returned",
											res
										);
										// 如果命令没有生效（返回 falsy），回退到直接打开视图
										if (!res) {
											const leaf =
												this.app.workspace.getLeaf(
													true
												);
											await leaf.setViewState({
												type: "tabflow-doc-view",
												active: true,
											});
											this.app.workspace.revealLeaf(leaf);
										}
										// 尝试关闭设置面板（优先 API），以便文档视图成为唯一活动视图
										try {
											if (
												(this.app as any).setting &&
												typeof (this.app as any).setting
													.close === "function"
											) {
												(
													this.app as any
												).setting.close();
											} else if (
												(this.app as any).workspace &&
												typeof (this.app as any)
													.workspace
													.detachLeavesOfType ===
													"function"
											) {
												(
													this.app as any
												).workspace.detachLeavesOfType(
													"settings"
												);
											} else {
												console.debug(
													"[SettingTab] no API to close settings view"
												);
											}
										} catch (closeErr) {
											console.warn(
												"[SettingTab] failed to close settings view",
												closeErr
											);
										}
									} else {
										// commands API 不可用，直接打开视图
										const leaf =
											this.app.workspace.getLeaf(true);
										await leaf.setViewState({
											type: "tabflow-doc-view",
											active: true,
										});
										this.app.workspace.revealLeaf(leaf);
									}
								} catch (innerErr) {
									console.error(
										"[SettingTab] executeCommandById error",
										innerErr
									);
									// 回退：直接打开视图
									const leaf =
										this.app.workspace.getLeaf(true);
									await leaf.setViewState({
										type: "tabflow-doc-view",
										active: true,
									});
									this.app.workspace.revealLeaf(leaf);
								}
							} catch (e) {
								console.error(
									"[SettingTab] Open AlphaTex doc failed",
									e
								);
								new Notice("打开文档失败，请查看控制台日志");
							}
						});
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
