import { normalizeColorToHex } from '../utils/shareCardUtils';

interface BasicControlsInitial {
	t: (key: string) => string;
	cardWidth?: number;
	resolution?: string;
	format?: string;
	exportBgMode?: string;
	exportBgCustomColor?: string;
	disableLazy?: boolean;
}

interface BasicControlsCallbacks {
	onWidthChange?: (value: number) => void;
	onResolutionChange?: (value: string) => void;
	onFormatChange?: (value: string) => void;
	onExportBgModeChange?: (value: string) => void;
	onCustomColorChange?: (value: string) => void;
	onLazyChange?: (value: boolean) => void;
}

export function createBasicControls(
	parent: HTMLElement,
	initial: BasicControlsInitial,
	callbacks: BasicControlsCallbacks
) {
	const basicCard = parent.createDiv({ cls: 'share-card-basic-grid' });
	// 宽度
	basicCard.createEl('div', { text: initial.t('shareCard.cardWidth'), cls: 'sc-label' });
	const widthInput = basicCard.createEl('input') as HTMLInputElement;
	widthInput.type = 'number';
	widthInput.value = String(initial.cardWidth || 800);

	// 分辨率
	basicCard.createEl('div', { text: initial.t('shareCard.resolution'), cls: 'sc-label' });
	const resSelect = basicCard.createEl('select') as HTMLSelectElement;
	['1x', '2x', '3x'].forEach((r) => {
		const opt = resSelect.createEl('option', { text: r });
		opt.value = r;
	});
	resSelect.value = initial.resolution || '2x';

	// 格式
	basicCard.createEl('div', { text: initial.t('shareCard.format'), cls: 'sc-label' });
	const formatSelect = basicCard.createEl('select') as HTMLSelectElement;
	[
		['png', 'png'],
		['jpg', 'jpg'],
		['webp', 'webp'],
	].forEach(([tt, v]) => {
		const opt = formatSelect.createEl('option', { text: String(tt) });
		opt.value = String(v);
	});
	formatSelect.value = initial.format || 'png';

	// 导出背景模式
	basicCard.createEl('div', { text: initial.t('shareCard.exportBg.label'), cls: 'sc-label' });
	const bgModeSelect = basicCard.createEl('select') as HTMLSelectElement;
	[
		[initial.t('shareCard.exportBg.options.default'), 'default'],
		[initial.t('shareCard.exportBg.options.auto'), 'auto'],
		[initial.t('shareCard.exportBg.options.custom'), 'custom'],
	].forEach(([label, v]) => {
		const opt = bgModeSelect.createEl('option', { text: String(label) });
		opt.value = String(v);
	});
	bgModeSelect.value = initial.exportBgMode || 'default';

	const customColorLabel = basicCard.createEl('div', {
		text: initial.t('shareCard.customColor'),
		cls: 'sc-label',
	});
	const customColorInput = basicCard.createEl('input') as HTMLInputElement;
	customColorInput.type = 'color';
	customColorInput.value = normalizeColorToHex(initial.exportBgCustomColor || '#ffffff');
	customColorInput.style.display = initial.exportBgMode === 'custom' ? '' : 'none';

	// 禁用懒加载
	basicCard.createEl('div', { text: initial.t('shareCard.disableLazyLabel'), cls: 'sc-label' });
	const lazyWrapInner = basicCard.createDiv({ cls: 'share-card-field-checkbox' });
	const lazyCb = lazyWrapInner.createEl('input', {
		attr: { type: 'checkbox' },
	}) as HTMLInputElement;
	const lazyLabel = lazyWrapInner.createEl('label', { text: initial.t('shareCard.disableLazy') });
	lazyLabel.style.marginLeft = '4px';
	lazyCb.checked = !!initial.disableLazy;

	// Attach events
	widthInput.addEventListener(
		'change',
		() => callbacks.onWidthChange && callbacks.onWidthChange(Number(widthInput.value) || 800)
	);
	resSelect.addEventListener(
		'change',
		() => callbacks.onResolutionChange && callbacks.onResolutionChange(resSelect.value)
	);
	formatSelect.addEventListener(
		'change',
		() => callbacks.onFormatChange && callbacks.onFormatChange(formatSelect.value)
	);
	bgModeSelect.addEventListener(
		'change',
		() => callbacks.onExportBgModeChange && callbacks.onExportBgModeChange(bgModeSelect.value)
	);
	customColorInput.addEventListener(
		'change',
		() => callbacks.onCustomColorChange && callbacks.onCustomColorChange(customColorInput.value)
	);
	lazyCb.addEventListener(
		'change',
		() => callbacks.onLazyChange && callbacks.onLazyChange(lazyCb.checked)
	);

	return {
		basicCard,
		widthInput,
		resSelect,
		formatSelect,
		bgModeSelect,
		customColorLabel,
		customColorInput,
		lazyCb,
		setValues(values: Partial<BasicControlsInitial>) {
			if (values.cardWidth !== undefined) widthInput.value = String(values.cardWidth);
			if (values.resolution) resSelect.value = values.resolution;
			if (values.format) formatSelect.value = values.format;
			if (values.exportBgMode) bgModeSelect.value = values.exportBgMode;
			customColorInput.value = normalizeColorToHex(
				values.exportBgCustomColor || customColorInput.value
			);
			lazyCb.checked = !!values.disableLazy;
			customColorInput.style.display = values.exportBgMode === 'custom' ? '' : 'none';
		},
	};
}

export default createBasicControls;
