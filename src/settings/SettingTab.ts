import { App, PluginSettingTab } from 'obsidian';
import TabFlowPlugin from '../main';
import { t } from '../i18n';

type AppWithSetting = App & {
	setting?: {
		open?: () => void;
		openTabById?: (id: string) => void;
	};
};

/**
 * 新的 SettingTab：将三个子页签的渲染逻辑委派给 tabs/* 下的模块。
 * 每个子页导出对应的 renderXTab(container, plugin, app)
 */
export class SettingTab extends PluginSettingTab {
	plugin: TabFlowPlugin;
	private _eventBound = false;
	private forcedTab?: string;

	constructor(app: App, plugin: TabFlowPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		if (!this._eventBound) {
			const workspaceOn = (this.app.workspace as { on?: unknown }).on as
				| ((name: string, callback: (...args: unknown[]) => void, ctx?: unknown) => unknown)
				| undefined;
			if (typeof workspaceOn === 'function') {
				const playerRef = workspaceOn.call(
					this.app.workspace,
					'tabflow:open-plugin-settings-player',
					async () => {
						try {
							const settingManager = (this.app as AppWithSetting).setting;
							settingManager?.open?.();
							const setting = settingManager;
							if (setting?.openTabById) {
								setting.openTabById(this.plugin.manifest.id);
							}
							// 标记强制激活 player 子页签
							this.forcedTab = 'player';
							try {
								await this.renderDisplay();
							} catch {
								// Ignore display errors
							}
						} catch {
							// Ignore event binding errors
						}
					},
					this
				);
				this.plugin.registerEvent(playerRef);

				const editorRef = workspaceOn.call(
					this.app.workspace,
					'tabflow:open-plugin-settings-editor',
					async () => {
						try {
							const settingManager = (this.app as AppWithSetting).setting;
							settingManager?.open?.();
							settingManager?.openTabById?.(this.plugin.manifest.id);
							this.forcedTab = 'editor';
							try {
								await this.renderDisplay();
							} catch {
								// Ignore display errors
							}
						} catch {
							// Ignore event binding errors
						}
					},
					this
				);
				this.plugin.registerEvent(editorRef);

				const aboutRef = workspaceOn.call(
					this.app.workspace,
					'tabflow:open-plugin-settings-about',
					async () => {
						try {
							const settingManager = (this.app as AppWithSetting).setting;
							settingManager?.open?.();
							settingManager?.openTabById?.(this.plugin.manifest.id);
							this.forcedTab = 'about';
							try {
								await this.renderDisplay();
							} catch {
								// Ignore display errors
							}
						} catch {
							// Ignore event binding errors
						}
					},
					this
				);
				this.plugin.registerEvent(aboutRef);
			}
			this._eventBound = true;
		}
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
				const mod = await import('./tabs/editorTab');
				await mod.renderEditorTab(contentsEl, this.plugin, this.app);
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
