import { App, FuzzySuggestModal, TFile, FuzzyMatch } from 'obsidian';
import { t } from '../../i18n';

/**
 * 媒体文件选择 Modal
 * 使用 Obsidian 内置的 FuzzySuggestModal 简化实现
 */
export class MediaFileSuggestModal extends FuzzySuggestModal<TFile> {
	private static readonly AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
	private static readonly VIDEO_EXTENSIONS = ['mp4', 'webm', 'mkv', 'avi', 'mov'];

	private onSelectCallback: (file: TFile) => void;

	constructor(app: App, onSelect: (file: TFile) => void) {
		super(app);
		this.onSelectCallback = onSelect;
		this.setPlaceholder(t('media.searchPlaceholder'));
	}

	/**
	 * 获取所有媒体文件
	 */
	getItems(): TFile[] {
		const files = this.app.vault.getFiles();
		return files.filter((file) => this.isMediaFile(file));
	}

	/**
	 * 获取文件的显示文本（用于模糊搜索）
	 */
	getItemText(file: TFile): string {
		return file.path;
	}

	/**
	 * 渲染每个选项
	 */
	renderSuggestion(item: FuzzyMatch<TFile>, el: HTMLElement): void {
		const file = item.item;
		const isAudio = this.isAudioFile(file);
		const icon = isAudio ? '🎵' : '🎬';
		const type = isAudio ? 'Audio' : 'Video';

		el.createDiv({ cls: 'media-file-suggestion' }, (div) => {
			div.createSpan({ cls: 'media-file-icon', text: icon });
			div.createDiv({ cls: 'media-file-info' }, (info) => {
				info.createDiv({ cls: 'media-file-name', text: file.name });
				info.createDiv({
					cls: 'media-file-path',
					text: `${file.parent?.path || ''} • ${type}`,
				});
			});
		});
	}

	/**
	 * 处理文件选择
	 */
	onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.onSelectCallback(item);
	}

	/**
	 * 判断是否为媒体文件
	 */
	private isMediaFile(file: TFile): boolean {
		const ext = file.extension.toLowerCase();
		return (
			MediaFileSuggestModal.AUDIO_EXTENSIONS.includes(ext) ||
			MediaFileSuggestModal.VIDEO_EXTENSIONS.includes(ext)
		);
	}

	/**
	 * 判断是否为音频文件
	 */
	private isAudioFile(file: TFile): boolean {
		return MediaFileSuggestModal.AUDIO_EXTENSIONS.includes(file.extension.toLowerCase());
	}
}
