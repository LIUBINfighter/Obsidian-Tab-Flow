import { App, Modal } from 'obsidian';

export class ShareCardModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h3', { text: '分享卡片（占位）' });
		// 占位：后续在此处添加分享 / 新建文件相关 UI
	}

	onClose() {
		this.contentEl.empty();
	}
}

export default ShareCardModal;
