import { Plugin } from 'obsidian';
import { VIEW_TYPE_TABFLOW_DOC } from '../views/DocView';
import { VIEW_TYPE_ALPHATEX_EDITOR } from '../views/EditorView';
import { t } from '../i18n';

export function registerOpenViewCommands(plugin: Plugin) {
	plugin.addCommand({
		id: 'open-tabflow-doc-view',
		name: t('commands.openDocumentation', undefined, 'Open AlphaTex Documentation'),
		callback: async () => {
			const leaf = plugin.app.workspace.getLeaf(true);
			await leaf.setViewState({
				type: VIEW_TYPE_TABFLOW_DOC,
				active: true,
			});
			plugin.app.workspace.revealLeaf(leaf);
		},
	});

	plugin.addCommand({
		id: 'open-alphatex-editor',
		name: t('commands.openEditor', undefined, 'Open AlphaTex Editor'),
		callback: async () => {
			const leaf = plugin.app.workspace.getLeaf(true);
			await leaf.setViewState({
				type: VIEW_TYPE_ALPHATEX_EDITOR,
				active: true,
			});
			plugin.app.workspace.revealLeaf(leaf);
		},
	});

	plugin.addCommand({
		id: 'open-alphatex-editor-horizontal',
		name: t('commands.openEditorHorizontal', undefined, 'Open AlphaTex Editor (Horizontal)'),
		callback: async () => {
			const leaf = plugin.app.workspace.getLeaf(true);
			await leaf.setViewState({
				type: VIEW_TYPE_ALPHATEX_EDITOR,
				active: true,
				state: { layout: 'horizontal' },
			});
			plugin.app.workspace.revealLeaf(leaf);
		},
	});
}
