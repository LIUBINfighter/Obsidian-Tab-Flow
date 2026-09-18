import { App, EventRef, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import TabFlowPlugin from '../main';
import { t } from '../i18n';

type AppWithSetting = App & {
	setting?: {
		open?: () => void;
		openTabById?: (id: string) => void;
	};
};

type WorkspaceWithCustomEvents = {
	on(name: string, callback: (...data: unknown[]) => unknown, ctx?: unknown): EventRef;
};

/**
 * SettingTab
 *
 * - Obsidian 1.13+: settings are described with `getSettingDefinitions()` so
 *   they show up in the settings search.
 * - Older versions keep using the imperative `display()` implementation below.
 */
export class SettingTab extends PluginSettingTab {
	plugin: TabFlowPlugin;
	private _eventBound = false;
	private forcedTab?: string;

	constructor(app: App, plugin: TabFlowPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		if (!this._eventBound) {
			const workspace = this.app.workspace as unknown as WorkspaceWithCustomEvents;
			const openSettingsTab = async (tab: string) => {
				try {
					const settingManager = (this.app as AppWithSetting).setting;
					settingManager?.open?.();
					settingManager?.openTabById?.(this.plugin.manifest.id);
					// 标记强制激活目标子页签
					this.forcedTab = tab;
					// Obsidian 1.13+ renders the declarative definitions; only the
					// imperative fallback needs a manual re-render.
					if (!this.usesDeclarativeSettings()) {
						try {
							await this.renderDisplay();
						} catch {
							// Ignore display errors
						}
					}
				} catch {
					// Ignore event binding errors
				}
			};

			this.plugin.registerEvent(
				workspace.on(
					'tabflow:open-plugin-settings-player',
					() => void openSettingsTab('player'),
					this
				)
			);
			this.plugin.registerEvent(
				workspace.on(
					'tabflow:open-plugin-settings-editor',
					() => void openSettingsTab('editor'),
					this
				)
			);
			this.plugin.registerEvent(
				workspace.on(
					'tabflow:open-plugin-settings-about',
					() => void openSettingsTab('about'),
					this
				)
			);
			this._eventBound = true;
		}
	}

	/**
	 * Declarative settings (Obsidian 1.13+). Pages mirror the imperative tabs
	 * below; the tab modules render into a single row each so the existing UI
	 * is reused, while plain settings become searchable controls.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			this.createPage(t('settings.tabs.general'), async (container) => {
				const renderGeneral = async (host: HTMLElement) => {
					const mod = await import('./tabs/generalTab');
					await mod.renderGeneralTab(host, this.plugin, this.app, async () => {
						host.empty();
						await renderGeneral(host);
					});
				};
				await renderGeneral(container);
			}),
			this.createPage(t('settings.tabs.player'), async (container) => {
				const mod = await import('./tabs/playerTab');
				await mod.renderPlayerTab(container, this.plugin, this.app);
			}),
			{
				type: 'page',
				name: t('settings.tabs.editor'),
				items: [
					{
						name: t(
							'settings.editor.autoOpenFiles',
							undefined,
							'Open .atex files in the editor'
						),
						desc: t(
							'settings.editor.autoOpenFilesDesc',
							undefined,
							'Open alphaTex files with the Tab Flow editor when you click them.'
						),
						control: { type: 'toggle', key: 'autoOpenAlphaTexFiles' },
					},
					{
						name: t(
							'settings.editor.defaultLayout',
							undefined,
							'Default editor layout'
						),
						control: {
							type: 'dropdown',
							key: 'editorViewDefaultLayout',
							defaultValue: 'horizontal',
							options: {
								horizontal: t(
									'settings.editor.layout.horizontal',
									undefined,
									'Horizontal'
								),
								vertical: t(
									'settings.editor.layout.vertical',
									undefined,
									'Vertical'
								),
								'horizontal-swapped': t(
									'settings.editor.layout.horizontalSwapped',
									undefined,
									'Horizontal (swapped)'
								),
								'vertical-swapped': t(
									'settings.editor.layout.verticalSwapped',
									undefined,
									'Vertical (swapped)'
								),
								'single-bar': t(
									'settings.editor.layout.singleBar',
									undefined,
									'Single bar'
								),
							},
						},
					},
					{
						name: t('settings.editor.title', undefined, 'Editor'),
						render: (setting) => {
							setting.settingEl.empty();
							const container = setting.settingEl.createDiv({
								cls: 'tabflow-settings-page-content',
							});
							void import('./tabs/editorTab').then((mod) =>
								mod.renderEditorTab(container, this.plugin, this.app)
							);
						},
					},
				],
			},
			this.createPage(t('settings.tabs.about'), async (container) => {
				const mod = await import('./tabs/aboutTab');
				await mod.renderAboutTab(container, this.plugin, this.app);
			}),
		];
	}

	private createPage(
		name: string,
		renderContent: (container: HTMLElement) => void | Promise<void>
	): SettingDefinitionItem {
		return {
			type: 'page',
			name,
			items: [
				{
					name,
					render: (setting) => {
						setting.settingEl.empty();
						const container = setting.settingEl.createDiv({
							cls: 'tabflow-settings-page-content',
						});
						void renderContent(container);
					},
				},
			],
		};
	}

	/**
	 * True when Obsidian renders this tab from `getSettingDefinitions()`
	 * (Obsidian 1.13+). Older versions call `display()` instead.
	 */
	private usesDeclarativeSettings(): boolean {
		const items = (this as { settingItems?: unknown }).settingItems;
		return Array.isArray(items) && items.length > 0;
	}

	display(): void {
		void this.renderDisplay();
	}

	private async renderDisplay(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		const tabsEl = containerEl.createDiv({ cls: 'itabs-settings-tabs' });
		const contentsEl = containerEl.createDiv({ cls: 'itabs-settings-contents' });

		const tabList = [
			{ id: 'general', name: t('settings.tabs.general') },
			{ id: 'player', name: t('settings.tabs.player') },
			{ id: 'editor', name: t('settings.tabs.editor') },
			{ id: 'about', name: t('settings.tabs.about') },
		];

		let activeTab = this.forcedTab || 'general';
		// 如果强制激活的标签页是 editor，但 editor 标签页已暂时取消挂载，则回退到 general
		if (activeTab === 'editor') {
			activeTab = 'general';
		}
		this.forcedTab = undefined;

		const renderTab = async (tabId: string) => {
			contentsEl.empty();
			if (tabId === 'general') {
				const mod = await import('./tabs/generalTab');
				await mod.renderGeneralTab(contentsEl, this.plugin, this.app, renderTab);
			} else if (tabId === 'player') {
				const mod = await import('./tabs/playerTab');
				await mod.renderPlayerTab(contentsEl, this.plugin, this.app);
			} else if (tabId === 'editor') {
				// 暂时取消 editor 标签页的挂载，避免重复挂载问题
				// const mod = await import('./tabs/editorTab');
				// await mod.renderEditorTab(contentsEl, this.plugin, this.app);
				// 如果尝试访问 editor 标签页，回退到 general
				const mod = await import('./tabs/generalTab');
				await mod.renderGeneralTab(contentsEl, this.plugin, this.app, renderTab);
			} else if (tabId === 'about') {
				const mod = await import('./tabs/aboutTab');
				await mod.renderAboutTab(contentsEl, this.plugin, this.app);
			}
		};

		tabList.forEach((tab) => {
			const tabEl = tabsEl.createEl('button', {
				text: tab.name,
				cls: ['itabs-settings-tab', tab.id === activeTab ? 'active' : ''],
			});
			tabEl.onclick = () => {
				void (async () => {
					tabsEl.querySelectorAll('button').forEach((b) => b.removeClass('active'));
					tabEl.addClass('active');
					activeTab = tab.id;
					await renderTab(tab.id);
				})();
			};
		});

		await renderTab(activeTab);
	}
}

export {};
