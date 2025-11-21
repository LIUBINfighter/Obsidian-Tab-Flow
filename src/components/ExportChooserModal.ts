import { App, Modal, Notice } from 'obsidian';
import { t } from '../i18n';

export interface ExportChooserOptions {
	app: App;
	eventBus: {
		publish: (event: string, payload?: unknown) => void;
		subscribe: (event: string, handler: (p?: unknown) => void) => void;
		unsubscribe?: (event: string, handler: (p?: unknown) => void) => void;
	};
	getFileName: () => string;
}

export class ExportChooserModal extends Modal {
	private eventBus: ExportChooserOptions['eventBus'];
	private getFileName: () => string;

	constructor(opts: ExportChooserOptions) {
		super(opts.app);
		this.eventBus = opts.eventBus;
		this.getFileName = opts.getFileName;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('tabflow-export-chooser');

		contentEl.createEl('h3', { text: t('export.export') });

		// 文件名编辑框
		const nameWrap = contentEl.createDiv({
			cls: 'tabflow-export-chooser__name-row',
		});
		nameWrap.createEl('label', { text: t('export.fileName') });
		const nameInput = nameWrap.createEl('input', {
			type: 'text',
			cls: 'tabflow-export-chooser__name-input',
		});
		const defaultName = (this.getFileName?.() || 'Untitled').trim();
		nameInput.value = defaultName;

		const row = contentEl.createDiv({
			cls: 'tabflow-export-chooser__actions',
		});

		// 音频导出（触发事件，由服务层导出并在状态回调时呼出音频播放器）
		const audioBtn = row.createEl('button', { text: t('export.audioWav'), cls: 'mod-cta' });
		audioBtn.onclick = () => {
			void (() => {
				try {
					const chosenName = (nameInput.value || 'Untitled').trim() || 'Untitled';
					const onOk = async (url?: string) => {
						try {
							// Lazy load audio player modal to reduce initial bundle size
							const { AudioExportModal } = await import('./AudioExportModal');
							const fileName = chosenName + '.wav';
							new AudioExportModal(this.app, url || '', fileName).open();
							new Notice(t('export.audioExportCompleted'));
						} catch (e) {
							console.error('[ExportChooserModal] ' + t('export.openAudioPlayerFailed'), e);
						}
					};
					const okHandler = (url?: string) => {
						void onOk(url);
						try {
							this.eventBus.unsubscribe?.('状态:音频导出完成', okHandler);
						} catch {
							// Ignore unsubscribe errors
						}
						try {
							this.eventBus.unsubscribe?.('状态:音频导出失败', failHandler);
						} catch {
							// Ignore unsubscribe errors
						}
					};
					const failHandler = (err?: unknown) => {
						const errMsg = err instanceof Error ? err.message : err ? String(err) : '';
						if (errMsg) {
							new Notice(t('export.audioExportFailedWithError', { error: errMsg }));
						} else {
							new Notice(t('export.audioExportFailed'));
						}
						try {
							this.eventBus.unsubscribe?.('状态:音频导出完成', okHandler);
						} catch {
							// Ignore unsubscribe errors
						}
						try {
							this.eventBus.unsubscribe?.('状态:音频导出失败', failHandler);
						} catch {
							// Ignore unsubscribe errors
						}
					};
					this.eventBus.subscribe('状态:音频导出完成', okHandler);
					this.eventBus.subscribe('状态:音频导出失败', failHandler);
					this.eventBus.publish('命令:导出音频', { fileName: chosenName });
					this.close();
				} catch (e) {
					new Notice(t('export.exportStartFailed') + ': ' + e);
				}
			})();
		};

		// MIDI
		const midiBtn = row.createEl('button', { text: t('export.exportMidi') });
		midiBtn.onclick = () => {
			try {
				const chosenName = (nameInput.value || 'Untitled').trim() || 'Untitled';
				this.eventBus.publish('命令:导出MIDI', { fileName: chosenName });
				this.close();
			} catch (e) {
				new Notice(t('export.midiExportFailed') + ': ' + e);
			}
		};

		// PDF
		const pdfBtn = row.createEl('button', { text: t('export.exportPdf') });
		pdfBtn.onclick = () => {
			try {
				const chosenName = (nameInput.value || 'Untitled').trim() || 'Untitled';
				this.eventBus.publish('命令:导出PDF', { fileName: chosenName });
				this.close();
			} catch (e) {
				new Notice(t('export.pdfExportFailed') + ': ' + e);
			}
		};

		// GP
		const gpBtn = row.createEl('button', { text: t('export.exportGp') });
		gpBtn.onclick = () => {
			try {
				const chosenName = (nameInput.value || 'Untitled').trim() || 'Untitled';
				this.eventBus.publish('命令:导出GP', { fileName: chosenName });
				this.close();
			} catch (e) {
				new Notice(t('export.gpExportFailed') + ': ' + e);
			}
		};
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
