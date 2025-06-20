// main.ts
import { App, Notice, Plugin, TFile, PluginSettingTab, requestUrl } from "obsidian";
import { TabView, VIEW_TYPE_TAB } from "./views/TabView";
import { TexEditorView, VIEW_TYPE_TEX_EDITOR } from "./views/TexEditorView";
import * as path from "path";
import * as fs from "fs";
import { registerStyles, isGuitarProFile, getCurrentThemeMode, watchThemeModeChange } from "./utils/utils";
import { AlphaTabSettingTab } from "./settings/AlphaTabSettingTab";
import * as JSZip from "jszip";

// 定义 App 类型的扩展，添加 setting 属性
declare module "obsidian" {
    interface App {
        setting: {
            open: () => void;
            openTabById: (id: string) => void;
        };
    }
}

interface AlphaTabPluginSettings {
	// 插件设置，可以根据需要扩展
	mySetting: string;
	assetsDownloaded: boolean; // 添加资产下载状态标记
	lastAssetsCheck: number; // 上次检查资产的时间戳
}

const DEFAULT_SETTINGS: AlphaTabPluginSettings = {
	mySetting: "default",
	assetsDownloaded: false,
	lastAssetsCheck: 0
};

export default class AlphaTabPlugin extends Plugin {
	settings: AlphaTabPluginSettings;
	actualPluginDir: string | null = null; // 新增属性
	themeMode: 'dark' | 'light' = 'dark'; // 新增全局变量

	async onload() {
		await this.loadSettings();

		const vaultRoot = (this.app.vault.adapter as any).basePath as string;
		// 确保 manifest.dir 有值
		const pluginDir = path.join(vaultRoot, this.manifest.dir || '');

		// 检查 manifest.json 是否存在且 id 匹配
		let actualPluginDir: string | null = null;
		const manifestPath = path.join(pluginDir, "manifest.json");
		if (fs.existsSync(manifestPath)) {
			try {
				const manifestContent = JSON.parse(
					fs.readFileSync(manifestPath, "utf8")
				);
				if (manifestContent.id === this.manifest.id) {
					actualPluginDir = pluginDir;
				}
			} catch {
				// ignore
			}
		}

		if (!actualPluginDir) {
			console.error(
				`[AlphaTab] Could not find valid plugin directory from vault: ${pluginDir}`
			);
			throw new Error(
				"AlphaTab 插件根目录查找失败，请检查插件安装路径。"
			);
		}

		this.actualPluginDir = actualPluginDir;
		// console.log(`[AlphaTab Debug] Using plugin directory: ${actualPluginDir}`);

		// 添加设置选项卡
		this.addSettingTab(new AlphaTabSettingTab(this.app, this));

		// 检查是否有必要的资产文件，如果没有则显示通知提醒用户
		if (!this.checkRequiredAssets()) {
			// 在 2 秒后显示通知，让用户有时间先看到 Obsidian 界面
			setTimeout(() => {
				const notice = new Notice(
					"AlphaTab 吉他谱插件需要下载额外资源文件才能正常工作。请前往插件设置下载资源文件。",
					10000
				);
				
				// 添加点击事件，点击通知可以直接打开设置
				// @ts-ignore - 访问私有属性以添加点击事件
				if (notice.noticeEl) {
					// @ts-ignore
					notice.noticeEl.addEventListener("click", () => {
						// 打开插件设置
						this.app.setting?.open();
						this.app.setting?.openTabById(this.manifest.id);
					});
				}
			}, 2000);
		}

		// 加载自定义样式
		registerStyles(this);
		// 获取当前主题模式并赋值到全局变量
		this.themeMode = getCurrentThemeMode();

		// 监听主题切换，动态更新 themeMode 并刷新所有已打开的 AlphaTab 视图
		watchThemeModeChange((mode) => {
			this.themeMode = mode;
			// 遍历所有已打开的 TabView，调用其刷新方法（如有）
			this.app.workspace.iterateAllLeaves((leaf) => {
				if (leaf.view instanceof TabView && typeof leaf.view.refreshTheme === 'function') {
					leaf.view.refreshTheme(mode);
				}
			});
		});

		// 注册吉他谱文件扩展名的查看器
		this.registerView(VIEW_TYPE_TAB, (leaf) => {
			const view = new TabView(leaf, this);
			return view;
		});

		// 注册 AlphaTab/AlphaTex 编辑器视图
		this.registerView(VIEW_TYPE_TEX_EDITOR, (leaf) => {
			return new TexEditorView(leaf, this);
		});

		// 注册文件扩展名处理
		this.registerExtensions(
			["gp", "gp3", "gp4", "gp5", "gpx", "gp7"],
			VIEW_TYPE_TAB
		);
		this.registerExtensions(
			["alphatab", "alphatex"],
			VIEW_TYPE_TEX_EDITOR
		);

		// 添加右键菜单项用于打开吉他谱文件
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				// 新建 AlphaTab 文件菜单项
				menu.addItem((item) => {
					item.setTitle("新建 AlphaTab 文件")
						.setIcon("plus")
						.onClick(async () => {
							const parent = file instanceof TFile ? this.app.vault.getAbstractFileByPath(path.dirname(file.path)) : file;
							const baseName = "新建吉他谱";
							let filename = `${baseName}.alphatab`;
							let i = 1;
							while (await this.app.vault.adapter.exists(path.join((parent as any).path, filename))) {
								filename = `${baseName} ${i}.alphatab`;
								i++;
							}
							const newFilePath = path.join((parent as any).path, filename);
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
				if (
					file instanceof TFile &&
					["alphatab", "alphatex"].includes(file.extension)
				) {
					menu.addItem((item) => {
						item.setTitle("用 AlphaTab 编辑器打开")
							.setIcon("pencil")
							.onClick(async () => {
								const leaf = this.app.workspace.getLeaf(false);
								await leaf.setViewState({
									type: VIEW_TYPE_TEX_EDITOR,
									state: { file: file.path },
								});
								this.app.workspace.revealLeaf(leaf);
							});
					});
					
					// 添加预览选项
					menu.addItem((item) => {
						item.setTitle("在 AlphaTab 中预览")
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
					
					// 添加同时打开编辑和预览的选项
					menu.addItem((item) => {
						item.setTitle("同时打开编辑和预览")
							.setIcon("columns")
							.onClick(async () => {
								try {
									// 先打开编辑视图
									const editorLeaf = this.app.workspace.getLeaf();
									await editorLeaf.setViewState({
										type: VIEW_TYPE_TEX_EDITOR,
										state: { file: file.path }
									});
									
									// 水平分割当前叶子，创建并排视图
									const previewLeaf = this.app.workspace.splitActiveLeaf("vertical");
									
									// 在右侧打开预览视图
									await previewLeaf.setViewState({
										type: VIEW_TYPE_TAB,
										state: { file: file.path }
									});
									
									// 聚焦到编辑器视图
									this.app.workspace.setActiveLeaf(editorLeaf, { focus: true });
									
									// 使用通知（保留这个全局通知，因为这时还没有视图来显示内部通知）
									// new Notice("已打开编辑和预览并排视图");
								} catch (error) {
									console.error("打开视图出错:", error);
									new Notice(`打开视图失败: ${error.message}`);
								}
							});
					});
				}
			})
		);

		// 日志
		console.log("AlphaTab Plugin Loaded");
	}

	onunload() {
		// 清理工作
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TAB);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TEX_EDITOR);
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

	/**
	 * 检查并下载必要的资产文件
	 */
	async checkAssets(): Promise<void> {
		// 如果不需要检查资产（例如，最近已经检查过）
		const currentTime = Date.now();
		const timeThreshold = 24 * 60 * 60 * 1000; // 24小时，单位毫秒
		
		if (
			this.settings.assetsDownloaded && 
			currentTime - this.settings.lastAssetsCheck < timeThreshold
		) {
			console.log("[AlphaTab] 跳过资产检查，上次检查时间:", new Date(this.settings.lastAssetsCheck));
			return;
		}
		
		if (!this.actualPluginDir) {
			console.error("[AlphaTab] 插件目录未找到");
			return;
		}
		
		// 检查资产是否已存在
		const assetsExists = this.checkRequiredAssets();
		if (assetsExists) {
			console.log("[AlphaTab] 所有必需资产已存在");
			// 更新最后检查时间
			this.settings.lastAssetsCheck = currentTime;
			await this.saveSettings();
			return;
		}
		
		// 显示下载提示
		new Notice("AlphaTab 插件需要下载额外资源文件...", 3000);
		
		// 下载资产包
		const success = await this.downloadAssets();
		if (success) {
			this.settings.assetsDownloaded = true;
			this.settings.lastAssetsCheck = currentTime;
			await this.saveSettings();
			new Notice("AlphaTab 资源文件已下载完成", 3000);
		} else {
			new Notice("AlphaTab 资源文件下载失败，部分功能可能无法正常使用", 5000);
		}
	}
	
	/**
	 * 检查必需的资产文件是否存在
	 */
	checkRequiredAssets(): boolean {
		try {
			if (!this.actualPluginDir) return false;
			
			// 定义必需的资产文件列表
			const requiredAssets = [
				"assets/alphatab/alphaTab.worker.mjs",
				"assets/alphatab/alphatab.js",
				"assets/alphatab/soundfont/sonivox.sf2",
				"assets/alphatab/font/Bravura.woff2",
				"assets/alphatab/font/Bravura.woff",
				"assets/alphatab/font/bravura_metadata.json"
			];
			
			for (const asset of requiredAssets) {
				const assetPath = path.join(this.actualPluginDir, asset);
				if (!fs.existsSync(assetPath)) {
					console.log(`[AlphaTab] 缺少必需资产: ${asset}`);
					return false;
				}
			}
			
			return true;
		} catch (error) {
			console.error("[AlphaTab] 检查资产时出错:", error);
			return false;
		}
	}
	
	/**
	 * 下载并解压资产文件
	 */
	async downloadAssets(): Promise<boolean> {
		try {
			if (!this.actualPluginDir) return false;
			
			// 构建资产包URL - 使用当前插件版本号
			const version = this.manifest.version;
			const assetsUrl = `https://github.com/yourusername/interactive-tabs/releases/download/${version}/assets.zip`;
			
			// 显示下载进度通知
			const notice = new Notice("正在下载 AlphaTab 资源文件...", 0);
			
			
			try {
				// 使用 requestUrl 下载资产包
				const response = await requestUrl({
					url: assetsUrl,
					method: "GET"
				});
				
				if (!response || !response.arrayBuffer) {
					notice.hide();
					new Notice("下载资源文件失败：无法获取响应内容", 5000);
					return false;
				}
				
				// 将响应转换为ArrayBuffer
				const arrayBuffer = response.arrayBuffer;
				
				// 使用JSZip解压资产
				const zip = await JSZip.loadAsync(arrayBuffer);
				
				// 解压所有文件到插件目录
				const extractionPromises: Promise<void>[] = [];
				
				zip.forEach((relativePath: string, zipEntry: JSZip.JSZipObject) => {
					if (!zipEntry.dir && this.actualPluginDir) {
						const extractPromise = zipEntry.async("arraybuffer").then((content: ArrayBuffer) => {
							const targetPath = path.join(this.actualPluginDir as string, relativePath);
							const targetDir = path.dirname(targetPath);
							
							// 确保目标目录存在
							if (!fs.existsSync(targetDir)) {
								fs.mkdirSync(targetDir, { recursive: true });
							}
							
							// 写入文件
							fs.writeFileSync(targetPath, Buffer.from(content));
							console.log(`[AlphaTab] 解压文件: ${relativePath}`);
						});
						
						extractionPromises.push(extractPromise);
					}
				});
				
				// 等待所有文件解压完成
				await Promise.all(extractionPromises);
				
				// 关闭通知
				notice.hide();
				new Notice("AlphaTab 资源文件下载并解压成功", 3000);
				
				return true;
			} catch (downloadError) {
				notice.hide();
				console.error("[AlphaTab] 下载或解压资产时出错:", downloadError);
				new Notice(`下载资源文件失败: ${downloadError.message}`, 5000);
				return false;
			}
		} catch (error) {
			console.error("[AlphaTab] 下载或解压资产时出错:", error);
			return false;
		}
	}
}
