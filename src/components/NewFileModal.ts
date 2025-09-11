import { App, Modal, Notice } from 'obsidian';

export class NewFileModal extends Modal {
	private onCreated: (path: string) => void;

	constructor(app: App, onCreated: (path: string) => void) {
		super(app);
		this.onCreated = onCreated;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h3', { text: '创建新文件' });

		contentEl.createEl('label', { text: '文件路径（相对 Vault 根）' });
		const nameInput = contentEl.createEl('input');
		nameInput.addClass('mod-chooser-input');
		nameInput.style.width = '100%';

		contentEl.createEl('label', { text: '初始内容' });
		const textArea = contentEl.createEl('textarea');
		textArea.style.width = '100%';
		textArea.style.height = '160px';

		const btnRow = contentEl.createDiv({ cls: 'modal-button-row' });
		const createBtn = btnRow.createEl('button', { text: '创建' });
		const cancelBtn = btnRow.createEl('button', { text: '取消' });

		createBtn.addEventListener('click', async () => {
			const path = nameInput.value.trim();
			const data = textArea.value;
			if (!path) {
				new Notice('请输入文件路径');
				return;
			}
			try {
				// create file; if exists, reject
				const exists = await this.app.vault.adapter.exists(path);
				if (exists) {
					new Notice('文件已存在');
					return;
				}
				await this.app.vault.create(path, data);
				new Notice('文件已创建');
				this.close();
				try {
					this.onCreated(path);
				} catch (err) {
					console.error('[NewFileModal] onCreated 回调失败', err);
				}
			} catch (e) {
				console.error('[NewFileModal] 创建文件失败', e);
				new Notice('创建文件失败');
			}
		});

		cancelBtn.addEventListener('click', () => {
			this.close();
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

export default NewFileModal;
