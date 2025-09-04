import { App, PluginSettingTab } from 'obsidian';
import TabFlowPlugin from '../main';
import { t } from '../i18n';

/**
 * 新的 SettingTab：将三个子页签的渲染逻辑委派给 tabs/* 下的模块。
 * 每个子页导出对应的 renderXTab(container, plugin, app)
 */
export class SettingTab extends PluginSettingTab {
	plugin: TabFlowPlugin;
	private _eventBound = false;

	constructor(app: App, plugin: TabFlowPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		if (!this._eventBound) {
			// 保留来自旧实现的事件：打开 plugin settings 的 player 子页签
			// @ts-ignore
			this.app.workspace.on('tabflow:open-plugin-settings-player', async () => {
				try {
					// 打开设置面板并定位到本插件设置页
					// @ts-ignore
					(this.app as any).setting?.open?.();
					if ((this.app as any).setting?.openTabById) {
						(this.app as any).setting.openTabById(this.plugin.manifest.id);
					}
					// 标记强制激活 player 子页签
					(this as any)._forceActiveInnerTab = 'player';
					try {
						await this.display();
					} catch {
						// Ignore display errors
					}
				} catch {
					// Ignore event binding errors
				}
			});

			// 添加 editor 子页签的事件监听
			// @ts-ignore
			this.app.workspace.on('tabflow:open-plugin-settings-editor', async () => {
				try {
					// 打开设置面板并定位到本插件设置页
					// @ts-ignore
					(this.app as any).setting?.open?.();
					if ((this.app as any).setting?.openTabById) {
						(this.app as any).setting.openTabById(this.plugin.manifest.id);
					}
					// 标记强制激活 editor 子页签
					(this as any)._forceActiveInnerTab = 'editor';
					try {
						await this.display();
					} catch {
						// Ignore display errors
					}
				} catch {
					// Ignore event binding errors
				}
			});
			this._eventBound = true;
		}
	}

	async display(): Promise<void> {
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

		let activeTab = (this as any)._forceActiveInnerTab || 'general';
		(this as any)._forceActiveInnerTab = undefined;

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
			tabEl.onclick = async () => {
				tabsEl.querySelectorAll('button').forEach((b) => b.removeClass('active'));
				tabEl.addClass('active');
				activeTab = tab.id;
				await renderTab(tab.id);
			};
		});

		await renderTab(activeTab);
	}
}

export {};
