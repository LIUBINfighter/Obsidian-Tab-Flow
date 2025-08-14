import { Plugin, TFile, Notice, requestUrl, MarkdownRenderChild } from "obsidian";
import { TabView, VIEW_TYPE_TAB } from "./views/TabView";
import { DocView, VIEW_TYPE_TABFLOW_DOC } from "./views/DocView";
import {
	ResourceLoaderService,
	AlphaTabResources,
	ASSET_FILES
} from "./services/ResourceLoaderService";
import * as path from "path";
import {
	SettingTab,
	TabFlowSettings,
	DEFAULT_SETTINGS,
} from "./settings/SettingTab";

/**
 * 资产状态类型
 */
export interface AssetStatus {
	file: string;
	exists: boolean;
	path: string;
}

export default class MyPlugin extends Plugin {
	settings: TabFlowSettings;
	resources!: AlphaTabResources;
	actualPluginDir?: string;
	// 运行期 UI 覆盖：仅会话级，不落盘
		runtimeUiOverride?: { components?: Record<string, boolean>; order?: string[] | string } | null;
	
	// 加载和保存设置的方法
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
	
	/**
	 * 获取相对于vault的路径
	 * @param absolutePath 绝对路径
	 * @returns 相对于vault的路径
	 */
	getRelativePathToVault(absolutePath: string): string {
		// 获取插件目录相对于vault的路径
		// 通常插件目录是 vault/.obsidian/plugins/plugin-id/
		if (!this.actualPluginDir) {
			throw new Error("插件目录未定义");
		}
		
		// 使用manifest.dir作为基础计算相对路径
		// 替换反斜杠为正斜杠，保证跨平台兼容
		const normalizedPluginDir = this.actualPluginDir.replace(/\\/g, '/');
		const normalizedPath = absolutePath.replace(/\\/g, '/');
		
		// 打印调试信息
		console.log("插件路径:", normalizedPluginDir);
		console.log("目标路径:", normalizedPath);
		
		// 预期的结果是：.obsidian/plugins/interactive-tabs/assets/文件名
		if (normalizedPath.startsWith(normalizedPluginDir)) {
			// 从绝对路径中移除插件目录部分，得到相对路径
			return normalizedPath;
		}
		
		// 如果路径不匹配预期格式，尝试直接使用文件名部分
		const fileName = path.basename(absolutePath);
		return path.join(normalizedPluginDir, "assets", fileName);
	}



	/**
	 * 检查资产文件状态
	 * @returns 如果所有资产文件都存在则返回true，否则返回false
	 */
	async checkRequiredAssets(): Promise<boolean | AssetStatus[]> {
		try {
			if (!this.actualPluginDir) {
				console.error("[MyPlugin] Plugin directory not found");
				return false;
			}
			
			// 使用相对路径而非绝对路径
			const assetsDirRelative = path.join(".obsidian", "plugins", this.manifest.id, "assets");
			
			// 检查assets目录是否存在
			const assetsDirExists = await this.app.vault.adapter.exists(assetsDirRelative);
			if (!assetsDirExists) {
				console.log("[MyPlugin] Assets directory does not exist:", assetsDirRelative);
				return false;
			}
			
			// 要检查的资产文件
			const assetFiles = [
				ASSET_FILES.ALPHA_TAB,
				ASSET_FILES.BRAVURA,
				ASSET_FILES.SOUNDFONT
			];
			
			// 检查每个文件并返回详细状态
			const assetStatuses: AssetStatus[] = await Promise.all(
				assetFiles.map(async file => {
					const filePath = path.join(assetsDirRelative, file);
					const exists = await this.app.vault.adapter.exists(filePath);
					
					if (!exists) {
						console.log(`[MyPlugin] Missing asset file: ${filePath}`);
					} else {
						console.log(`[MyPlugin] Found asset file: ${filePath}`);
					}
					
					return {
						file,
						exists,
						path: filePath
					};
				})
			);
			
			// 检查是否所有文件都存在
			const allAssetsExist = assetStatuses.every(status => status.exists);
			
			// 如果只需要简单的布尔结果
			if (this.settings.simpleAssetCheck) {
				return allAssetsExist;
			}
			
			// 返回详细的资产状态列表
			return assetStatuses;
		} catch (error) {
			console.error("[MyPlugin] Error checking assets:", error);
			return false;
		}
	}

	async downloadAssets(): Promise<boolean> {
		try {
			if (!this.actualPluginDir) {
				new Notice("无法确定插件目录，下载失败");
				return false;
			}

			console.log("当前插件路径:", this.actualPluginDir);
			
			// 使用Obsidian API创建资产目录
			const assetsDir = path.join(this.actualPluginDir, "assets");
			const assetsDirRelative = path.join(".obsidian", "plugins", this.manifest.id, "assets");
			
			try {
				await this.app.vault.adapter.mkdir(assetsDirRelative);
				console.log("资产目录创建成功:", assetsDirRelative);
			} catch (err) {
				console.log("创建目录时出错（可能已存在）:", err);
			}

			// 使用固定版本号0.0.5，而不是当前插件版本
			// 因为您提到日志中显示的是从0.0.5版本下载的资产
			const version = "0.0.5";
			const baseUrl = `https://github.com/LIUBINfighter/Obsidian-Tab-Flow/releases/download/${version}`;
			
			// 定义要下载的资产
			const assets = [
				{ url: `${baseUrl}/${ASSET_FILES.ALPHA_TAB}`, path: path.join(assetsDir, ASSET_FILES.ALPHA_TAB) },
				{ url: `${baseUrl}/${ASSET_FILES.BRAVURA}`, path: path.join(assetsDir, ASSET_FILES.BRAVURA) },
				{ url: `${baseUrl}/${ASSET_FILES.SOUNDFONT}`, path: path.join(assetsDir, ASSET_FILES.SOUNDFONT) }
			];

			// 获取plugins目录的完整路径
			console.log("插件目录:", this.actualPluginDir);
			
			// 并行下载所有资产文件
			const downloadPromises = assets.map(async (asset) => {
				try {
					new Notice(`正在下载 ${path.basename(asset.path)}...`);
					const response = await requestUrl({
						url: asset.url,
						method: "GET"
					});
					
					if (response.status !== 200) {
						console.error(`Failed to download ${asset.url}, status: ${response.status}`);
						return false;
					}
					
					// 文件路径处理，获取相对于vault的路径
					// 从actualPluginDir计算相对路径 (.obsidian/plugins/interactive-tabs/assets/...)
					// 解析出相对于插件目录的路径
					const relativeToVault = this.getRelativePathToVault(asset.path);
					
					try {
						// 使用obsidian API创建目录
						const dirPath = path.dirname(relativeToVault);
						if (dirPath && dirPath !== ".") {
							await this.app.vault.adapter.mkdir(dirPath);
						}
						
						// 使用obsidian API写入文件
						await this.app.vault.adapter.writeBinary(
							relativeToVault, 
							response.arrayBuffer
						);
						
						console.log(`Downloaded ${asset.url} to ${relativeToVault}`);
						
						// 检查文件是否确实写入成功
						const exists = await this.app.vault.adapter.exists(relativeToVault);
						if (!exists) {
							console.error(`File appears to be written but doesn't exist: ${relativeToVault}`);
							return false;
						}
						
						return true;
					} catch (fsError) {
						console.error(`文件系统错误 (${relativeToVault}):`, fsError);
						return false;
					}
				} catch (error) {
					console.error(`Error downloading ${asset.url}:`, error);
					return false;
				}
			});

			const results = await Promise.all(downloadPromises);
			const success = results.every(result => result);
			
			if (success) {
				this.settings.assetsDownloaded = true;
				this.settings.lastAssetsCheck = Date.now();
				await this.saveSettings();
				new Notice("所有资产文件下载成功！");
			} else {
				new Notice("部分资产文件下载失败，请检查网络连接后重试");
			}
			
			return success;
		} catch (error) {
			console.error("[MyPlugin] Error downloading assets:", error);
			new Notice(`下载资产文件失败: ${error.message}`);
			return false;
		}
	}

	async onload() {
		await this.loadSettings();
		
		// 存储实际的插件目录路径
		this.actualPluginDir = this.manifest.dir || "";
		console.log("插件实际路径:", this.actualPluginDir);
		console.log("Manifest ID:", this.manifest.id);
		
		// 注册设置面板
		this.addSettingTab(new SettingTab(this.app, this));

		// 注册 AlphaTex 文档视图
		this.registerView(VIEW_TYPE_TABFLOW_DOC, (leaf) => new DocView(leaf, this));

		this.addCommand({
			id: 'open-tabflow-doc-view',
			name: 'Open AlphaTex Documentation',
			callback: async () => {
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.setViewState({ type: VIEW_TYPE_TABFLOW_DOC, active: true });
				this.app.workspace.revealLeaf(leaf);
			}
		});

		// 使用 ResourceLoaderService 加载资源
		const resourceLoader = new ResourceLoaderService(this.app);
		this.resources = await resourceLoader.load(this.actualPluginDir);
		
		// 检查资源是否完整，如果不完整则显示通知
		if (!this.resources.resourcesComplete) {
			new Notice(
				"AlphaTab 插件资源文件不完整，某些功能可能无法正常工作。请在插件设置中下载资源文件。",
				10000
			);
		}
		
		// 全局注入一次 @font-face，避免每块重复注入
		try {
			if (this.resources.bravuraUri) {
				const style = document.createElement('style');
				style.id = 'tabflow-global-alphatab-font';
				style.textContent = `@font-face { font-family: 'alphaTab'; src: url(${this.resources.bravuraUri}); }`;
				if (!document.getElementById(style.id)) document.head.appendChild(style);
			}
		} catch {}

		// 只在有足够资源的情况下注册视图
		if (this.resources.bravuraUri && this.resources.alphaTabWorkerUri) {
			this.registerView(VIEW_TYPE_TAB, (leaf) => {
				// 这里我们需要确保传递的资源对象符合 TabView 所需的格式
				return new TabView(leaf, this, {
					bravuraUri: this.resources.bravuraUri || "",
					alphaTabWorkerUri: this.resources.alphaTabWorkerUri || "",
					soundFontUri: this.resources.soundFontUri || ""
				});
			});

			// 注册 Markdown 代码块处理器: alphatex
			try {
				// 动态引入以避免在测试环境下的循环依赖
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const { mountAlphaTexBlock } = require("./markdown/AlphaTexBlock");
				this.registerMarkdownCodeBlockProcessor("alphatex", async (source, el, ctx) => {
					// 资源缺失：在块内提示并提供下载按钮
					if (!this.resources.bravuraUri || !this.resources.alphaTabWorkerUri) {
						const holder = el.createEl("div");
						holder.addClass("alphatex-block");
						const msg = holder.createEl("div", { text: "AlphaTab 资源缺失，无法渲染此代码块。" });
						const btn = holder.createEl("button", { text: "下载资源" });
						btn.addEventListener("click", async () => {
							btn.setAttr("disabled", "true");
							btn.setText("下载中...");
							const ok = await this.downloadAssets();
							btn.removeAttribute("disabled");
							btn.setText(ok ? "下载完成，请刷新预览" : "下载失败，重试");
						});
						return;
					}

					// remove legacy two-way binding to init line (UI options now runtime-only)
					const onUpdateInit = async (_partial: any) => { /* no-op by design */ };

					const block = mountAlphaTexBlock(el, source, this.resources, {
						scale: 1.0,
						speed: 1.0,
						scrollMode: "Continuous",
						metronome: false,
						onUpdateInit,
						setUiOverride: (override: { components?: Record<string, boolean>; order?: string[] | string } | null) => {
							try { (this as any).runtimeUiOverride = override || null; } catch {}
							try { this.app.workspace.trigger('tabflow:playbar-components-changed'); } catch {}
						},
						clearUiOverride: () => {
							try { (this as any).runtimeUiOverride = null; } catch {}
							try { this.app.workspace.trigger('tabflow:playbar-components-changed'); } catch {}
						},
					});
					const child = new MarkdownRenderChild(el);
					child.onunload = () => block.destroy();
					ctx.addChild(child);
				});
			} catch (e) {
				console.warn("Failed to register alphatex code block processor:", e);
			}
		}

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

}

export function isGuitarProFile(extension: string | undefined): boolean {
	if (!extension) return false;
	return ["gp", "gp3", "gp4", "gp5", "gpx", "gp7"].includes(
		extension.toLowerCase()
	);
}
