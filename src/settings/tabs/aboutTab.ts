import { App, Notice, Setting } from 'obsidian';
import TabFlowPlugin from '../../main';
import { t } from '../../i18n';

export async function renderAboutTab(
	tabContents: HTMLElement,
	plugin: TabFlowPlugin,
	app: App
): Promise<void> {
	tabContents.createEl('h3', { text: t('settings.tabs.about') });
	tabContents.createEl('p', {
		text: t('settings.about.title'),
	});

	// 快速打开 AlphaTex 文档视图按钮
	new Setting(tabContents)
		.setName(t('settings.about.alphaTexDoc'))
		.setDesc(t('settings.about.alphaTexDocDesc'))
		.addButton((btn) => {
			btn.setButtonText(t('settings.about.openDoc')).onClick(async () => {
				try {
					new Notice(t('settings.about.openingDoc'));
					// 优先通过已注册的命令触发
					try {
						const execFn =
							(app as any).commands && (app as any).commands.executeCommandById;
						if (typeof execFn === 'function') {
							const res = execFn.call((app as any).commands, 'open-tabflow-doc-view');
							if (!res) {
								const leaf = app.workspace.getLeaf(true);
								await leaf.setViewState({ type: 'tabflow-doc-view', active: true });
								app.workspace.revealLeaf(leaf);
							}
						} else {
							const leaf = app.workspace.getLeaf(true);
							await leaf.setViewState({ type: 'tabflow-doc-view', active: true });
							app.workspace.revealLeaf(leaf);
						}
					} catch (innerErr) {
						console.error('[SettingTab.about] executeCommandById error', innerErr);
						const leaf = app.workspace.getLeaf(true);
						await leaf.setViewState({ type: 'tabflow-doc-view', active: true });
						app.workspace.revealLeaf(leaf);
					}

					// 尝试关闭设置面板以便文档视图可见
					try {
						if (
							(app as any).setting &&
							typeof (app as any).setting.close === 'function'
						) {
							(app as any).setting.close();
						} else if (
							(app as any).workspace &&
							typeof (app as any).workspace.detachLeavesOfType === 'function'
						) {
							(app as any).workspace.detachLeavesOfType('settings');
						}
					} catch (closeErr) {
						console.warn('[SettingTab.about] failed to close settings view', closeErr);
					}
				} catch (e) {
					console.error('[SettingTab] Open AlphaTex doc failed', e);
					new Notice(t('settings.about.openDocFailed'));
				}
			});
		});
}
