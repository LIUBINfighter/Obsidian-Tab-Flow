import { Plugin, TFile, Notice, requestUrl, MarkdownRenderChild } from 'obsidian';
import { TabView, VIEW_TYPE_TAB } from './views/TabView';
import { DocView, VIEW_TYPE_TABFLOW_DOC } from './views/DocView';
import { EditorView, VIEW_TYPE_ALPHATEX_EDITOR } from './views/EditorView';
import {
	ResourceLoaderService,
	AlphaTabResources,
	ASSET_FILES,
} from './services/ResourceLoaderService';
import * as path from 'path';
import { SettingTab } from './settings/SettingTab';
import { DEFAULT_SETTINGS, TabFlowSettings } from './settings/defaults';
import ShareCardPresetService from './services/ShareCardPresetService';
import { AssetStatus } from './types/assets';
import { loadTranslations, addLanguageChangeListener, getCurrentLanguageCode, t } from './i18n';
import { TrackStateStore } from './state/TrackStateStore';

// AssetStatus moved to src/types/assets.ts

export default class TabFlowPlugin extends Plugin {
	settings: TabFlowSettings;
	resources!: AlphaTabResources;
	actualPluginDir?: string;
	trackStateStore!: TrackStateStore; // 新增：全局音轨状态存储
	// 运行期 UI 覆盖：仅会话级，不落盘
	runtimeUiOverride?: {
		components?: Record<string, boolean>;
		order?: string[] | string;
	} | null;
	// 语言变化监听器清理函数
	private languageChangeCleanup?: () => void;

	// 加载和保存设置的方法
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
			throw new Error(t('errors.pluginDirNotDefined', undefined, '插件目录未定义'));
		}

		// 使用manifest.dir作为基础计算相对路径
		// 替换反斜杠为正斜杠，保证跨平台兼容
		const normalizedPluginDir = this.actualPluginDir.replace(/\\/g, '/');
		const normalizedPath = absolutePath.replace(/\\/g, '/');

		// 打印调试信息
		console.debug(t('debug.pluginPath', { path: normalizedPluginDir }, '插件路径: {path}'));
		console.debug(t('debug.targetPath', { path: normalizedPath }, '目标路径: {path}'));

		// 预期的结果是：.obsidian/plugins/obsidian-tab-flow/assets/文件名
		if (normalizedPath.startsWith(normalizedPluginDir)) {
			// 从绝对路径中移除插件目录部分，得到相对路径
			return normalizedPath;
		}

		// 如果路径不匹配预期格式，尝试直接使用文件名部分
		const fileName = path.basename(absolutePath);
		return path.join(normalizedPluginDir, 'assets', fileName);
	}

	/**
	 * 检查资产文件状态
	 * @returns 如果所有资产文件都存在则返回true，否则返回false
	 */
	async checkRequiredAssets(): Promise<boolean | AssetStatus[]> {
		try {
			if (!this.actualPluginDir) {
				console.error('[TabFlowPlugin] Plugin directory not found');
				return false;
			}

			// 使用相对路径而非绝对路径
			const assetsDirRelative = path.join(
				this.app.vault.configDir,
				'plugins',
				this.manifest.id,
				'assets'
			);

			// 检查assets目录是否存在
			const assetsDirExists = await this.app.vault.adapter.exists(assetsDirRelative);
			if (!assetsDirExists) {
				console.debug(
					'[TabFlowPlugin] Assets directory does not exist:',
					assetsDirRelative
				);
				return false;
			}

			// 要检查的资产文件
			const assetFiles = [ASSET_FILES.ALPHA_TAB, ASSET_FILES.BRAVURA, ASSET_FILES.SOUNDFONT];

			// 检查每个文件并返回详细状态
			const assetStatuses: AssetStatus[] = await Promise.all(
				assetFiles.map(async (file) => {
					const filePath = path.join(assetsDirRelative, file);
					const exists = await this.app.vault.adapter.exists(filePath);

					if (!exists) {
						console.debug(`[TabFlowPlugin] Missing asset file: ${filePath}`);
					} else {
						console.debug(`[TabFlowPlugin] Found asset file: ${filePath}`);
					}

					return {
						file,
						exists,
						path: filePath,
					};
				})
			);

			// 检查是否所有文件都存在
			const allAssetsExist = assetStatuses.every((status) => status.exists);

			// 如果只需要简单的布尔结果
			if (this.settings.simpleAssetCheck) {
				return allAssetsExist;
			}

			// 返回详细的资产状态列表
			return assetStatuses;
		} catch (error) {
			console.error('[TabFlowPlugin] Error checking assets:', error);
			return false;
		}
	}

	async downloadAssets(): Promise<boolean> {
		try {
			if (!this.actualPluginDir) {
				new Notice(
					t('assets.download.pluginDirNotFound', undefined, '无法确定插件目录，下载失败')
				);
				return false;
			}
			console.debug(
				t('debug.currentPluginPath', { path: this.actualPluginDir }, '当前插件路径: {path}')
			);

			// 使用Obsidian API创建资产目录
			const assetsDir = path.join(this.actualPluginDir, 'assets');
			const assetsDirRelative = path.join(
				this.app.vault.configDir,
				'plugins',
				this.manifest.id,
				'assets'
			);

			try {
				await this.app.vault.adapter.mkdir(assetsDirRelative);
				console.debug(
					t(
						'debug.assetsDirCreated',
						{ path: assetsDirRelative },
						'资产目录创建成功: {path}'
					)
				);
			} catch (err) {
				console.debug('创建目录时出错（可能已存在）:', err);
			}

			// 使用固定版本号0.0.5，而不是当前插件版本
			// 因为您提到日志中显示的是从0.0.5版本下载的资产
			const version = '0.0.5';
			const baseUrl = `https://github.com/LIUBINfighter/Obsidian-Tab-Flow/releases/download/${version}`;

			// 定义要下载的资产
			const assets = [
				{
					url: `${baseUrl}/${ASSET_FILES.ALPHA_TAB}`,
					path: path.join(assetsDir, ASSET_FILES.ALPHA_TAB),
				},
				{
					url: `${baseUrl}/${ASSET_FILES.BRAVURA}`,
					path: path.join(assetsDir, ASSET_FILES.BRAVURA),
				},
				{
					url: `${baseUrl}/${ASSET_FILES.SOUNDFONT}`,
					path: path.join(assetsDir, ASSET_FILES.SOUNDFONT),
				},
			];

			// 获取plugins目录的完整路径
			console.debug('插件目录:', this.actualPluginDir);

			// 并行下载所有资产文件
			const downloadPromises = assets.map(async (asset) => {
				try {
					new Notice(`正在下载 ${path.basename(asset.path)}...`);
					const response = await requestUrl({
						url: asset.url,
						method: 'GET',
					});

					if (response.status !== 200) {
						console.error(
							`Failed to download ${asset.url}, status: ${response.status}`
						);
						return false;
					}

					// 文件路径处理，获取相对于vault的路径
					// 从actualPluginDir计算相对路径 (.obsidian/plugins/obsidian-tab-flow/assets/...)
					// 解析出相对于插件目录的路径
					const relativeToVault = this.getRelativePathToVault(asset.path);

					try {
						// 使用obsidian API创建目录
						const dirPath = path.dirname(relativeToVault);
						if (dirPath && dirPath !== '.') {
							await this.app.vault.adapter.mkdir(dirPath);
						}

						// 使用obsidian API写入文件
						await this.app.vault.adapter.writeBinary(
							relativeToVault,
							response.arrayBuffer
						);

						console.debug(`Downloaded ${asset.url} to ${relativeToVault}`);

						// 检查文件是否确实写入成功
						const exists = await this.app.vault.adapter.exists(relativeToVault);
						if (!exists) {
							console.error(
								`File appears to be written but doesn't exist: ${relativeToVault}`
							);
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
			const success = results.every((result) => result);

			if (success) {
				this.settings.assetsDownloaded = true;
				this.settings.lastAssetsCheck = Date.now();
				await this.saveSettings();
				new Notice(t('assets.download.success', undefined, '所有资产文件下载成功！'));
			} else {
				new Notice(
					t(
						'assets.download.partialFailure',
						undefined,
						'部分资产文件下载失败，请检查网络连接后重试'
					)
				);
			}

			return success;
		} catch (error) {
			console.error('[TabFlowPlugin] Error downloading assets:', error);
			new Notice(
				t(
					'assets.download.failed',
					{ error: error.message },
					`下载资产文件失败: ${error.message}`
				)
			);
			return false;
		}
	}

	async onload() {
		await this.loadSettings();

		// 初始化 TrackStateStore（依赖 settings 已加载）
		this.trackStateStore = new TrackStateStore(this);

		// ShareCard 预设迁移 / 初始化
		try {
			const presetSvc = new ShareCardPresetService(this);
			presetSvc.ensureMigration();
			await this.saveSettings();
		} catch (e) {
			console.warn('[TabFlowPlugin] ShareCard preset migration failed', e);
		}

		// Apply editor UI preferences as CSS variables so they take effect immediately
		try {
			document.documentElement.style.setProperty(
				'--alphatex-editor-font-size',
				this.settings.editorFontSize || '0.95rem'
			);
			document.documentElement.style.setProperty(
				'--alphatex-editor-bottom-gap',
				this.settings.editorBottomGap || '40vh'
			);
		} catch (_) {
			// ignore environments without DOM
		}

		// 加载翻译系统
		loadTranslations(this.app);

		// 设置语言变化监听器
		this.languageChangeCleanup = addLanguageChangeListener((language) => {
			console.debug(`[TabFlow] Language changed to: ${language}`);
			// 当语言变化时，可以在这里添加刷新UI或重新加载组件的逻辑
			// 例如：刷新设置面板、更新菜单项文本等
			this.refreshLanguageDependentUI();
		});

		// 存储实际的插件目录路径
		this.actualPluginDir = this.manifest.dir || '';
		console.debug('插件实际路径:', this.actualPluginDir);
		console.debug('Manifest ID:', this.manifest.id);

		// 注册设置面板
		this.addSettingTab(new SettingTab(this.app, this));

		// 添加侧边栏 Robin 图标，调用打开 TabFlow 文档命令
		this.addRibbonIcon(
			'guitar',
			t('ribbon.openDocumentation', undefined, '打开 TabFlow 文档'),
			async () => {
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.setViewState({
					type: VIEW_TYPE_TABFLOW_DOC,
					active: true,
				});
				this.app.workspace.revealLeaf(leaf);
			}
		);

		// 注册 AlphaTex 文档视图
		this.registerView(VIEW_TYPE_TABFLOW_DOC, (leaf) => new DocView(leaf, this));

		// 注册 AlphaTex 编辑器视图
		this.registerView(VIEW_TYPE_ALPHATEX_EDITOR, (leaf) => new EditorView(leaf, this));

		this.addCommand({
			id: 'open-tabflow-doc-view',
			name: t('commands.openDocumentation', undefined, 'Open AlphaTex Documentation'),
			callback: async () => {
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.setViewState({
					type: VIEW_TYPE_TABFLOW_DOC,
					active: true,
				});
				this.app.workspace.revealLeaf(leaf);
			},
		});

		this.addCommand({
			id: 'open-alphatex-editor',
			name: t('commands.openEditor', undefined, 'Open AlphaTex Editor'),
			callback: async () => {
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.setViewState({
					type: VIEW_TYPE_ALPHATEX_EDITOR,
					active: true,
				});
				this.app.workspace.revealLeaf(leaf);
			},
		});

		this.addCommand({
			id: 'open-alphatex-editor-horizontal',
			name: t(
				'commands.openEditorHorizontal',
				undefined,
				'Open AlphaTex Editor (Horizontal)'
			),
			callback: async () => {
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.setViewState({
					type: VIEW_TYPE_ALPHATEX_EDITOR,
					active: true,
					state: { layout: 'horizontal' },
				});
				this.app.workspace.revealLeaf(leaf);
			},
		});

		// 使用 ResourceLoaderService 加载资源
		const resourceLoader = new ResourceLoaderService(this.app);
		this.resources = await resourceLoader.load(this.actualPluginDir);

		// 检查资源是否完整，如果不完整则显示通知
		if (!this.resources.resourcesComplete) {
			new Notice(
				t(
					'assets.incomplete',
					undefined,
					'AlphaTab 插件资源文件不完整，某些功能可能无法正常工作。请在插件设置中下载资源文件。'
				),
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
		} catch {
			// Ignore font loading errors
		}

		// 只在有足够资源的情况下注册视图
		if (this.resources.bravuraUri && this.resources.alphaTabWorkerUri) {
			this.registerView(VIEW_TYPE_TAB, (leaf) => {
				// 这里我们需要确保传递的资源对象符合 TabView 所需的格式
				return new TabView(leaf, this, {
					bravuraUri: this.resources.bravuraUri || '',
					alphaTabWorkerUri: this.resources.alphaTabWorkerUri || '',
					soundFontUri: this.resources.soundFontUri || '',
				});
			});

			// 注册 Markdown 代码块处理器: alphatex
			try {
				// Dynamically import to avoid circular dependency in test environment
				const { mountAlphaTexBlock } = await import('./markdown/AlphaTexBlock');
				this.registerMarkdownCodeBlockProcessor('alphatex', async (source, el, ctx) => {
					// 资源缺失：在块内提示并提供下载按钮
					if (!this.resources.bravuraUri || !this.resources.alphaTabWorkerUri) {
						const holder = el.createEl('div');
						holder.addClass('alphatex-block');
						holder.createEl('div', {
							text: t(
								'alphatex.missingResources',
								undefined,
								'AlphaTab 资源缺失，无法渲染此代码块。'
							),
						});
						const btn = holder.createEl('button', {
							text: t('common.download', undefined, '下载资源'),
						});
						btn.addEventListener(
							'click',
							() =>
								void (async () => {
									btn.setAttr('disabled', 'true');
									btn.setText(t('common.downloading', undefined, '下载中...'));
									const ok = await this.downloadAssets();
									btn.removeAttribute('disabled');
									btn.setText(
										ok
											? t(
													'common.downloadComplete',
													undefined,
													'下载完成，请刷新预览'
												)
											: t(
													'common.downloadFailed',
													undefined,
													'下载失败，重试'
												)
									);
								})()
						);
						return;
					}

					// remove legacy two-way binding to init line (UI options now runtime-only)
					const onUpdateInit = async (_partial: Partial<Record<string, boolean>>) => {
						/* no-op by design */
					};

					const block = mountAlphaTexBlock(el, source, this.resources, {
						scale: 1.0,
						speed: 1.0,
						scrollMode: 'Continuous',
						metronome: false,
						onUpdateInit,
						setUiOverride: (
							override: {
								components?: Record<string, boolean>;
								order?: string[] | string;
							} | null
						) => {
							try {
								this.runtimeUiOverride = override || null;
							} catch {
								// Ignore UI override errors
							}
							try {
								this.app.workspace.trigger('tabflow:playbar-components-changed');
							} catch {
								/* empty */
							}
						},
						clearUiOverride: () => {
							try {
								this.runtimeUiOverride = null;
							} catch {
								/* empty */
							}
							try {
								this.app.workspace.trigger('tabflow:playbar-components-changed');
							} catch {
								/* empty */
							}
						},
					});
					const child = new MarkdownRenderChild(el);
					child.onunload = () => block.destroy();
					ctx.addChild(child);
				});
			} catch (e) {
				console.warn('Failed to register alphatex code block processor:', e);
			}
		}

		// 注册文件扩展名 - 根据设置决定是否自动打开
		if (this.settings.autoOpenAlphaTexFiles) {
			this.registerExtensions(
				['gp', 'gp3', 'gp4', 'gp5', 'gpx', 'gp7', 'alphatab', 'alphatex'],
				VIEW_TYPE_TAB
			);
		} else {
			this.registerExtensions(['gp', 'gp3', 'gp4', 'gp5', 'gpx', 'gp7'], VIEW_TYPE_TAB);
		}

		// 注册 AlphaTex 编辑器文件扩展名
		this.registerExtensions(['alphatex', 'alphatab'], VIEW_TYPE_ALPHATEX_EDITOR);

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				// 添加分隔线
				menu.addSeparator();

				menu.addItem((item) => {
					item.setTitle(
						t('fileMenu.createNewAlphaTab', undefined, 'Create a new AlphaTab file')
					)
						.setIcon('plus')
						.onClick(async () => {
							const parent =
								file instanceof TFile
									? this.app.vault.getAbstractFileByPath(path.dirname(file.path))
									: file;
							const baseName = t(
								'fileMenu.newFileBaseName',
								undefined,
								'New guitar tab'
							);
							let filename = `${baseName}.alphatab`;
							let i = 1;
							const parentPath =
								parent && 'path' in parent ? (parent as { path: string }).path : '';
							while (
								await this.app.vault.adapter.exists(path.join(parentPath, filename))
							) {
								filename = `${baseName} ${i}.alphatab`;
								i++;
							}
							const newFilePath = path.join(parentPath, filename);
							await this.app.vault.create(newFilePath, '');
							const newFile = this.app.vault.getAbstractFileByPath(newFilePath);
							if (newFile instanceof TFile) {
								const leaf = this.app.workspace.getLeaf(false);
								await leaf.openFile(newFile);
							}
						});
				});

				// 在编辑器中打开菜单项
				if (file instanceof TFile) {
					menu.addItem((item) => {
						item.setTitle(t('fileMenu.openInEditor', undefined, 'Open in Editor'))
							.setIcon('edit')
							.onClick(async () => {
								const leaf = this.app.workspace.getLeaf(false);
								await leaf.setViewState({
									type: VIEW_TYPE_ALPHATEX_EDITOR,
									state: { file: file.path },
								});
								this.app.workspace.revealLeaf(leaf);
							});
					});
				}

				// Preview 菜单项 - 在当前面板预览
				if (file instanceof TFile) {
					menu.addItem((item) => {
						item.setTitle(t('fileMenu.preview', undefined, 'Preview'))
							.setIcon('eye')
							.onClick(async () => {
								const leaf = this.app.workspace.getLeaf(false);
								await leaf.setViewState({
									type: VIEW_TYPE_TAB,
									state: { file: file.path },
								});
								this.app.workspace.revealLeaf(leaf);
							});
					});
				}

				// Open editor & Preview 菜单项 - 左栏编辑器，右栏预览
				if (file instanceof TFile) {
					menu.addItem((item) => {
						item.setTitle(
							t('fileMenu.openEditorAndPreview', undefined, 'Open editor & Preview')
						)
							.setIcon('columns')
							.onClick(async () => {
								// 在左栏打开默认编辑器
								const leftLeaf = this.app.workspace.getLeaf(false);
								await leftLeaf.openFile(file);

								// 在右栏打开 TabView 预览
								const rightLeaf = this.app.workspace.getLeaf('split', 'vertical');
								await rightLeaf.setViewState({
									type: VIEW_TYPE_TAB,
									state: { file: file.path },
								});
								this.app.workspace.revealLeaf(rightLeaf);

								// 手动触发刷新事件，确保 TabView 正确加载
								setTimeout(() => {
									// 通过全局事件总线触发刷新（如果存在的话）
									try {
										// 尝试获取右栏 TabView 的事件总线并触发刷新
										const tabViews =
											this.app.workspace.getLeavesOfType(VIEW_TYPE_TAB);
										tabViews.forEach((leaf) => {
											const view = leaf.view as TabView;
											if (
												view &&
												view.eventBus &&
												typeof view.eventBus.publish === 'function'
											) {
												view.eventBus.publish('命令:手动刷新');
											}
										});
									} catch (e) {
										console.warn('[Main] 手动刷新事件触发失败:', e);
									}
								}, 50);
							});
					});
				}
			})
		);
	}

	/**
	 * 刷新依赖语言的UI组件
	 */
	private refreshLanguageDependentUI(): void {
		try {
			// 刷新设置面板（如果打开的话）
			const settingInstance = Reflect.get(this.app, 'setting') as {
				activeTab?: { id?: string };
				openTabById?: (id: string) => void;
			} | undefined;
			const settingTabs = settingInstance?.activeTab;
			if (settingTabs && settingTabs.id === 'tabflow') {
				// 重新渲染设置标签页
				settingInstance?.openTabById?.('tabflow');
			}

			// 触发自定义事件，通知其他组件语言已变化
			this.app.workspace.trigger('tabflow:language-changed', {
				language: getCurrentLanguageCode(),
			});

			console.debug('[TabFlow] Language-dependent UI refreshed');
		} catch (error) {
			console.warn('[TabFlow] Failed to refresh language-dependent UI:', error);
		}
	}

	onunload() {
		// 清理语言变化监听器
		if (this.languageChangeCleanup) {
			this.languageChangeCleanup();
			this.languageChangeCleanup = undefined;
		}

		// bravuraUri 和 alphaTabWorkerUri 现在都是 Data URL，不需要清理
		// 不再在 onunload 时主动 detach leaves，避免插件更新导致视图位置丢失
		console.debug('AlphaTab Plugin Unloaded');
	}
}
