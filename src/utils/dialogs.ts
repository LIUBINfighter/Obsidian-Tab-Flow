import { App, Modal } from 'obsidian';

interface ConfirmDialogOptions {
	message: string;
	title?: string;
	confirmText?: string;
	cancelText?: string;
}

interface PromptDialogOptions {
	message: string;
	title?: string;
	confirmText?: string;
	cancelText?: string;
	placeholder?: string;
	initialValue?: string;
}

class ConfirmDialogModal extends Modal {
	private resolved = false;
	constructor(
		app: App,
		private options: ConfirmDialogOptions,
		private resolve: (value: boolean) => void
	) {
		super(app);
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		if (this.options.title) modalEl.createEl('h2', { text: this.options.title });
		contentEl.createEl('p', { text: this.options.message });

		const buttonBar = contentEl.createDiv({ cls: 'modal-button-container' });
		const cancelBtn = buttonBar.createEl('button', {
			text: this.options.cancelText ?? 'Cancel',
		});
		cancelBtn.addEventListener('click', () => this.closeWith(false));

		const confirmBtn = buttonBar.createEl('button', {
			text: this.options.confirmText ?? 'OK',
			cls: 'mod-cta',
		});
		confirmBtn.addEventListener('click', () => this.closeWith(true));
	}

	onClose() {
		this.closeWith(false);
	}

	private closeWith(result: boolean) {
		if (this.resolved) return;
		this.resolved = true;
		super.close();
		this.resolve(result);
	}
}

class PromptDialogModal extends Modal {
	private resolved = false;
	constructor(
		app: App,
		private options: PromptDialogOptions,
		private resolve: (value: string | null) => void
	) {
		super(app);
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		if (this.options.title) modalEl.createEl('h2', { text: this.options.title });
		contentEl.createEl('p', { text: this.options.message });

		const input = contentEl.createEl('input', {
			attr: {
				type: 'text',
				placeholder: this.options.placeholder ?? '',
			},
		});
		if (this.options.initialValue) input.value = this.options.initialValue;

		const buttonBar = contentEl.createDiv({ cls: 'modal-button-container' });
		const cancelBtn = buttonBar.createEl('button', {
			text: this.options.cancelText ?? 'Cancel',
		});
		cancelBtn.addEventListener('click', () => this.closeWith(null));

		const confirmBtn = buttonBar.createEl('button', {
			text: this.options.confirmText ?? 'OK',
			cls: 'mod-cta',
		});
		confirmBtn.addEventListener('click', () => {
			const value = input.value.trim();
			if (!value) return;
			this.closeWith(value);
		});

		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				const value = input.value.trim();
				if (!value) return;
				this.closeWith(value);
			}
		});
	}

	onClose() {
		this.closeWith(null);
	}

	private closeWith(result: string | null) {
		if (this.resolved) return;
		this.resolved = true;
		super.close();
		this.resolve(result);
	}
}

export function showConfirmDialog(app: App, options: ConfirmDialogOptions): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new ConfirmDialogModal(app, options, resolve);
		modal.open();
	});
}

export function showPromptDialog(app: App, options: PromptDialogOptions): Promise<string | null> {
	return new Promise((resolve) => {
		const modal = new PromptDialogModal(app, options, resolve);
		modal.open();
	});
}
