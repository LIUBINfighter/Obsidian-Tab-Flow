import { App, Notice, Setting } from 'obsidian';
import TabFlowPlugin from '../../main';
import { setIcon } from 'obsidian';
import { DEFAULT_SETTINGS, PlayBarComponentVisibility } from '../defaults';
import { t } from '../../i18n';

export function renderPlayerTab(
	tabContents: HTMLElement,
	plugin: TabFlowPlugin,
	app: App
): Promise<void> {
	tabContents.createEl('h4', { text: t('settings.player.visualEditorTitle') });

	new Setting(tabContents)
		.setName(t('settings.player.resetToDefault'))
		.setDesc(t('settings.player.resetToDefaultDesc'))
		.setClass('tabflow-no-border')
		.setClass('tabflow-no-border')
		.addButton((btn) => {
			btn.setButtonText(t('settings.player.resetToDefault')).onClick(async () => {
				try {
					plugin.settings.playBar = {
						components: JSON.parse(
							JSON.stringify(DEFAULT_SETTINGS.playBar?.components || {})
						),
						order: (DEFAULT_SETTINGS.playBar?.order || []).slice(),
					};
					await plugin.saveSettings();
					try {
						/* @ts-ignore */ app.workspace.trigger(
							'tabflow:playbar-components-changed'
						);
					} catch {
						// Ignore workspace trigger errors
					}
					new Notice(t('settings.player.resetToDefaultSuccess'));
				} catch (e) {
					new Notice(t('settings.player.resetToDefaultFailed') + ': ' + e);
				}
			});
		});

	const cardsWrap = tabContents.createDiv({
		cls: 'tabflow-card-list',
	});
	const meta: Array<{
		key: keyof PlayBarComponentVisibility;
		label: string;
		icon: string;
		desc?: string;
		disabled?: boolean;
	}> = [
		{ key: 'playPause', label: t('settings.player.components.playPause'), icon: 'play' },
		{ key: 'stop', label: t('settings.player.components.stop'), icon: 'square' },
		{
			key: 'metronome',
			label: t('settings.player.components.metronome'),
			icon: 'lucide-music-2',
		},
		{ key: 'countIn', label: t('settings.player.components.countIn'), icon: 'lucide-timer' },
		{ key: 'tracks', label: t('settings.player.components.tracks'), icon: 'lucide-layers' },
		{
			key: 'refresh',
			label: t('settings.player.components.refresh'),
			icon: 'lucide-refresh-ccw',
		},
		{
			key: 'locateCursor',
			label: t('settings.player.components.locateCursor'),
			icon: 'lucide-crosshair',
		},
		{
			key: 'layoutToggle',
			label: t('settings.player.components.layoutToggle'),
			icon: 'lucide-layout',
		},
		{
			key: 'exportMenu',
			label: t('settings.player.components.exportMenu'),
			icon: 'lucide-download',
		},
		{ key: 'toTop', label: t('settings.player.components.toTop'), icon: 'lucide-chevrons-up' },
		{
			key: 'toBottom',
			label: t('settings.player.components.toBottom'),
			icon: 'lucide-chevrons-down',
		},
		{
			key: 'openSettings',
			label: t('settings.player.components.openSettings'),
			icon: 'settings',
		},
		{
			key: 'progressBar',
			label: t('settings.player.components.progressBar'),
			icon: 'lucide-line-chart',
		},
		{ key: 'speed', label: t('settings.player.components.speed'), icon: 'lucide-gauge' },
		{
			key: 'staveProfile',
			label: t('settings.player.components.staveProfile'),
			icon: 'lucide-list-music',
		},
		{ key: 'zoom', label: t('settings.player.components.zoom'), icon: 'lucide-zoom-in' },
		{
			key: 'scrollMode',
			label: t('settings.player.components.scrollMode'),
			icon: 'lucide-scroll',
		},
		{
			key: 'scrollMode',
			label: t('settings.player.components.scrollMode'),
			icon: 'lucide-scroll',
		},
		{
			key: 'audioPlayer',
			label: t('settings.player.components.audioPlayer'),
			icon: 'audio-file',
			disabled: true,
			desc: t('settings.player.components.audioPlayerDesc'),
		},
	];

	const getOrder = (): string[] => {
		const def = [
			'playPause',
			'stop',
			'metronome',
			'countIn',
			'tracks',
			'refresh',
			'locateCursor',
			'layoutToggle',
			'exportMenu',
			'toTop',
			'toBottom',
			'openSettings',
			'progressBar',
			'speed',
			'staveProfile',
			'zoom',
			'scrollMode',
			'scrollMode',
			'audioPlayer',
		];
		const saved = plugin.settings.playBar?.order;

		if (Array.isArray(saved) && saved.length > 0) {
			const savedSet = new Set(saved);
			const missing = def.filter((item) => !savedSet.has(item));
			if (missing.length > 0) {
				const newOrder = [...saved, ...missing];
				if (plugin.settings.playBar) {
					plugin.settings.playBar.order = newOrder;
					void plugin.saveSettings();
				}
				return newOrder;
			}
			return saved.slice();
		}
		return def.slice();
	};

	let draggingKey: string | null = null;
	const clearDndHighlights = () => {
		const cards = cardsWrap.querySelectorAll('.tabflow-card');
		cards.forEach((el) => {
			el.classList.remove('insert-before', 'insert-after', 'swap-target');
		});
	};

	const renderCards = () => {
		cardsWrap.empty();
		const order = getOrder().filter((k): k is keyof PlayBarComponentVisibility =>
			meta.some((m) => m.key === k)
		);
		const comp = plugin.settings.playBar?.components;
		order.forEach((key) => {
			const m = meta.find((x) => x.key === key);
			if (!m) return;
			const card = cardsWrap.createDiv({
				cls: ['tabflow-card', 'tabflow-card--draggable'],
				attr: {
					draggable: 'true',
				},
			});
			card.dataset.key = String(key);
			const left = card.createDiv({
				cls: 'tabflow-card__left',
			});
			left.createSpan({
				text: '⠿',
				cls: 'tabflow-card__handle',
			});
			const iconEl = left.createSpan(); // Create the span element
			setIcon(iconEl, m.icon); // Use the imported setIcon function
			left.createEl('strong', { text: m.label });
			if (m.desc)
				left.createSpan({
					text: ` - ${m.desc}`,
					cls: 'tabflow-card__desc',
				});

			const right = card.createDiv({
				cls: 'tabflow-card__right',
			});
			const upIcon = right.createSpan({
				cls: 'icon-clickable',
				attr: { 'aria-label': t('settings.player.moveUp'), role: 'button', tabindex: '0' },
			});
			setIcon(upIcon, 'lucide-arrow-up');
			const downIcon = right.createSpan({
				cls: 'icon-clickable',
				attr: {
					'aria-label': t('settings.player.moveDown'),
					role: 'button',
					tabindex: '0',
				},
			});
			setIcon(downIcon, 'lucide-arrow-down');

			new Setting(right)
				.addToggle((toggle) => {
					const current = !!comp?.[key];
					toggle.setValue(m.disabled ? false : current).onChange(async (value) => {
						const playBarSettings =
							plugin.settings.playBar ??
							(plugin.settings.playBar = {
								components: JSON.parse(
									JSON.stringify(DEFAULT_SETTINGS.playBar?.components || {})
								) as PlayBarComponentVisibility,
								order: (DEFAULT_SETTINGS.playBar?.order || []).slice(),
							});
						const components =
							playBarSettings.components ??
							(playBarSettings.components = JSON.parse(
								JSON.stringify(DEFAULT_SETTINGS.playBar?.components || {})
							) as PlayBarComponentVisibility);

						components[key] = m.disabled ? false : value;
						await plugin.saveSettings();
						try {
							/* @ts-ignore */ app.workspace.trigger(
								'tabflow:playbar-components-changed'
							);
						} catch {
							// Ignore workspace trigger errors
						}
					});
					if (m.disabled) {
						toggle.toggleEl?.querySelector('input')?.setAttribute('disabled', 'true');
					}
				})
				.setClass('tabflow-no-border');

			const getScrollContainer = (el: HTMLElement): HTMLElement | Window => {
				let node: HTMLElement | null = el.parentElement;
				while (node) {
					const hasScrollableSpace = node.scrollHeight > node.clientHeight + 1;
					const style = getComputedStyle(node);
					const overflowY = style.overflowY;
					if (
						hasScrollableSpace &&
						(overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
					) {
						return node;
					}
					node = node.parentElement;
				}
				return window;
			};

			const keepPointerOverRow = async (
				rowKey: string,
				update: () => Promise<void> | void
			) => {
				const oldRect = card.getBoundingClientRect();
				const scrollContainer = getScrollContainer(card);
				await Promise.resolve(update());
				const newCard = cardsWrap.querySelector(`.tabflow-card[data-key="${rowKey}"]`);
				if (!newCard) return;
				const newRect = newCard.getBoundingClientRect();
				const delta = newRect.top - oldRect.top;
				if (delta !== 0) {
					if (scrollContainer === window) {
						window.scrollBy(0, delta);
					} else {
						(scrollContainer as HTMLElement).scrollTop += delta;
					}
				}
			};

			const moveUp = async () => {
				const cur = getOrder();
				const i = cur.indexOf(String(key));
				if (i > 0) {
					await keepPointerOverRow(String(key), async () => {
						[cur[i - 1], cur[i]] = [cur[i], cur[i - 1]];
						if (!plugin.settings.playBar) {
							plugin.settings.playBar = {
								components: {} as PlayBarComponentVisibility,
							};
						}
						plugin.settings.playBar.order = cur;
						await plugin.saveSettings();
						renderCards();
					});
					try {
						/* @ts-ignore */ app.workspace.trigger(
							'tabflow:playbar-components-changed'
						);
					} catch {
						// Ignore workspace trigger errors
					}
				}
			};

			const moveDown = async () => {
				const cur = getOrder();
				const i = cur.indexOf(String(key));
				if (i >= 0 && i < cur.length - 1) {
					await keepPointerOverRow(String(key), async () => {
						[cur[i + 1], cur[i]] = [cur[i], cur[i + 1]];
						if (!plugin.settings.playBar) {
							plugin.settings.playBar = {
								components: {} as PlayBarComponentVisibility,
							};
						}
						plugin.settings.playBar.order = cur;
						await plugin.saveSettings();
						renderCards();
					});
					try {
						/* @ts-ignore */ app.workspace.trigger(
							'tabflow:playbar-components-changed'
						);
					} catch {
						// Ignore workspace trigger errors
					}
				}
			};

			upIcon.addEventListener('click', () => {
				void moveUp();
			});
			upIcon.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					void moveUp();
				}
			});
			downIcon.addEventListener('click', () => {
				void moveDown();
			});
			downIcon.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					void moveDown();
				}
			});

			card.addEventListener('dragstart', (e) => {
				draggingKey = String(key);
				(e.dataTransfer as DataTransfer).effectAllowed = 'move';
			});
			card.addEventListener('dragover', (e) => {
				e.preventDefault();
				(e.dataTransfer as DataTransfer).dropEffect = 'move';
				clearDndHighlights();
				const rect = card.getBoundingClientRect();
				const offsetY = e.clientY - rect.top;
				const ratio = offsetY / rect.height;
				if (ratio < 0.33) {
					card.classList.add('insert-before');
				} else if (ratio > 0.66) {
					card.classList.add('insert-after');
				} else {
					card.classList.add('swap-target');
				}
			});
			card.addEventListener('dragleave', () => clearDndHighlights());
			card.addEventListener('dragend', () => clearDndHighlights());
			card.addEventListener('drop', () => {
				void (async () => {
					const isInsertAfter = card.classList.contains('insert-after');
					const isSwap = card.classList.contains('swap-target');
					clearDndHighlights();
					if (!draggingKey || draggingKey === key) return;
					const list = getOrder();
					const from = list.indexOf(String(draggingKey));
					const to = list.indexOf(String(key));
					if (from < 0 || to < 0) return;
					const cur = list.slice();
					if (isSwap) {
						[cur[from], cur[to]] = [cur[to], cur[from]];
					} else {
						let insertIndex = to + (isInsertAfter ? 1 : 0);
						const [moved] = cur.splice(from, 1);
						if (from < insertIndex) insertIndex -= 1;
						cur.splice(insertIndex, 0, moved);
					}
					plugin.settings.playBar = plugin.settings.playBar || {
						components: {} as PlayBarComponentVisibility,
					};
					if (plugin.settings.playBar) {
						if (plugin.settings.playBar) {
							plugin.settings.playBar.order = cur;
						}
					}
					await plugin.saveSettings();
					renderCards();
					try {
						/* @ts-ignore */ app.workspace.trigger(
							'tabflow:playbar-components-changed'
						);
					} catch {
						// Ignore workspace trigger errors
					}
					draggingKey = null;
				})();
			});
		});
	};
	renderCards();

	// Debug Bar section
	tabContents.createEl('h3', { text: t('settings.player.debugBar.title') });
	tabContents.createEl('div', {
		text: t('settings.player.debugBar.description'),
		cls: 'tabflow-setting-description',
	});

	new Setting(tabContents)
		.setName(t('settings.player.debugBar.showDebugBar'))
		.setDesc(t('settings.player.debugBar.showDebugBarDesc'))
		.setClass('tabflow-no-border')
		.setClass('tabflow-no-border')
		.addToggle((toggle) => {
			toggle.setValue(plugin.settings.showDebugBar ?? false).onChange(async (value) => {
				plugin.settings.showDebugBar = value;
				await plugin.saveSettings();
				try {
					// @ts-ignore
					app.workspace.trigger('tabflow:debugbar-toggle', value);
				} catch {
					// Ignore workspace trigger errors
				}
				new Notice(
					value
						? t('settings.player.debugBar.debugBarEnabled')
						: t('settings.player.debugBar.debugBarDisabled')
				);
			});
		});

	return Promise.resolve();
}
