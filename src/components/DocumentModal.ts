import { App, Modal } from 'obsidian';
import type TabFlowPlugin from '../main';
import { t } from '../i18n';

export class DocumentModal extends Modal {
	plugin: TabFlowPlugin;

	constructor(app: App, plugin: TabFlowPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('tabflow-document-modal');

		contentEl.createEl('h2', { text: t('documentModal.title', undefined, 'Document') });

		const body = contentEl.createDiv({ cls: 'document-modal-body' });
		body.createEl('p', { text: 'Coming soon...' });
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
