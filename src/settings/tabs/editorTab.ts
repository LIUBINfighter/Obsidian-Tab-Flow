import { App, Notice, Setting, TextComponent, DropdownComponent } from 'obsidian';
import { setIcon } from 'obsidian';
import TabFlowPlugin from '../../main';
import { t } from '../../i18n';
import { formatError } from '../../utils/errorUtils';
import { DEFAULT_SETTINGS, EditorBarComponentVisibility } from '../defaults';
import {
	createEmbeddableMarkdownEditor,
	type EmbeddableMarkdownEditor,
} from '../../editor/EmbeddableMarkdownEditor';
import { setCssProps } from '../../utils/styleUtils';

type WorkspaceEventBus = {
	trigger: (eventName: string, ...args: unknown[]) => void;
};

function triggerWorkspaceEvent(app: App, eventName: string, ...args: unknown[]): void {
	const workspace = app.workspace as unknown as WorkspaceEventBus;
	workspace.trigger(eventName, ...args);
}

export function renderEditorTab(
	tabContents: HTMLElement,
	plugin: TabFlowPlugin,
	app: App
): Promise<void> {
	// Editor View Settings
	new Setting(tabContents).setName(t('settings.editor.viewTitle')).setHeading();

	// Editor display preferences: font size and bottom gap (number input + unit dropdown)
	{
		const unitsFont = ['px', 'rem'];
		const unitsGap = ['px', 'vh'];

		const parseCssValue = (
			val: string | undefined,
			defaultNum: string,
			defaultUnit: string
		): { num: string; unit: string } => {
			if (!val) return { num: defaultNum, unit: defaultUnit };
			const m = String(val)
				.trim()
				.match(/^([0-9]+(?:\.[0-9]+)?)([a-z%]+)$/i);
			if (m) return { num: m[1], unit: m[2] };
			// fallback
			return { num: defaultNum, unit: defaultUnit };
		};

		const fontDefault = parseCssValue(
			plugin.settings.editorFontSize || DEFAULT_SETTINGS.editorFontSize,
			'0.95',
			'rem'
		);

		let fontText: TextComponent;
		let fontDropdown: DropdownComponent;
		let fontUnit = fontDefault.unit;
		let fontValue = fontDefault.num;

		const sFont = new Setting(tabContents)
			.setName(t('settings.editor.fontSize'))
			.setDesc(t('settings.editor.fontSizeDesc'));

		sFont
			.addText((text) => {
				fontText = text;
				const inputEl = text.inputEl;
				if (inputEl) {
					inputEl.setAttribute('type', 'number');
					inputEl.setAttribute('step', '0.01');
					inputEl.setAttribute('min', '0');
				}
				text.setValue(fontDefault.num).onChange((numStr) => {
					void (async () => {
						fontValue = numStr;
						const composed = `${numStr}${fontUnit}`;
						const valid = /^\d+(?:\.\d+)?(px|rem)$/.test(composed);
						if (!valid) {
							fontText.inputEl.classList.add('tabflow-invalid-input');
							return;
						}
						fontText.inputEl.classList.remove('tabflow-invalid-input');
						plugin.settings.editorFontSize = composed;
						await plugin.saveSettings();
						setCssProps(document.documentElement, {
							'--alphatex-editor-font-size': composed,
						});
					})();
				});
			})
			.addDropdown((dd) => {
				fontDropdown = dd;
				unitsFont.forEach((u) => {
					dd.addOption(u, u);
				});
				dd.setValue(fontDefault.unit).onChange((unit) => {
					void (async () => {
						fontUnit = unit;
						const composed = `${fontValue}${unit}`;
						const valid = /^\d+(?:\.\d+)?(px|rem)$/.test(composed);
						if (!valid) {
							fontText.inputEl.classList.add('tabflow-invalid-input');
							return;
						}
						fontText.inputEl.classList.remove('tabflow-invalid-input');
						plugin.settings.editorFontSize = composed;
						await plugin.saveSettings();
						setCssProps(document.documentElement, {
							'--alphatex-editor-font-size': composed,
						});
					})();
				});
			})
			.addButton((btn) => {
				btn.setIcon('rotate-ccw')
					.setTooltip(t('settings.editor.resetToDefault'))
					.onClick(async () => {
						const defaultVal = DEFAULT_SETTINGS.editorFontSize || '0.95rem';
						const parsed = parseCssValue(defaultVal, '0.95', 'rem');
						fontUnit = parsed.unit;
						fontValue = parsed.num;
						plugin.settings.editorFontSize = defaultVal;
						await plugin.saveSettings();
						setCssProps(document.documentElement, {
							'--alphatex-editor-font-size': defaultVal,
						});
						fontText.setValue(parsed.num);
						fontDropdown.setValue(parsed.unit);
						new Notice(t('settings.editor.resetToDefaultMessage'));
					});
			});

		// Bottom gap
		const gapDefault = parseCssValue(
			plugin.settings.editorBottomGap || DEFAULT_SETTINGS.editorBottomGap,
			'40',
			'vh'
		);

		const sGap = new Setting(tabContents)
			.setName(t('settings.editor.bottomGap'))
			.setDesc(t('settings.editor.bottomGapDesc'));

		let gapText: TextComponent;
		let gapDropdown: DropdownComponent;
		let gapUnit = gapDefault.unit;
		let gapValue = gapDefault.num;

		sGap.addText((text) => {
			gapText = text;
			const inputEl = text.inputEl;
			if (inputEl) {
				inputEl.setAttribute('type', 'number');
				inputEl.setAttribute('step', '1');
				inputEl.setAttribute('min', '0');
			}
			text.setValue(gapDefault.num).onChange((numStr) => {
				void (async () => {
					gapValue = numStr;
					const composed = `${numStr}${gapUnit}`;
					const valid = /^\d+(?:\.\d+)?(px|vh)$/.test(composed);
					if (!valid) {
						gapText.inputEl.classList.add('tabflow-invalid-input');
						return;
					}
					gapText.inputEl.classList.remove('tabflow-invalid-input');
					plugin.settings.editorBottomGap = composed;
					await plugin.saveSettings();
					setCssProps(document.documentElement, {
						'--alphatex-editor-bottom-gap': composed,
					});
				})();
			});
		})
			.addDropdown((dd) => {
				gapDropdown = dd;
				unitsGap.forEach((u) => {
					dd.addOption(u, u);
				});
				dd.setValue(gapDefault.unit).onChange((unit) => {
					void (async () => {
						gapUnit = unit;
						const composed = `${gapValue}${unit}`;
						const valid = /^\d+(?:\.\d+)?(px|vh)$/.test(composed);
						if (!valid) {
							gapText.inputEl.classList.add('tabflow-invalid-input');
							return;
						}
						gapText.inputEl.classList.remove('tabflow-invalid-input');
						plugin.settings.editorBottomGap = composed;
						await plugin.saveSettings();
						setCssProps(document.documentElement, {
							'--alphatex-editor-bottom-gap': composed,
						});
					})();
				});
			})
			.addButton((btn) => {
				btn.setIcon('rotate-ccw')
					.setTooltip(t('settings.editor.resetToDefault'))
					.onClick(async () => {
						const defaultVal = DEFAULT_SETTINGS.editorBottomGap || '40vh';
						const parsed = parseCssValue(defaultVal, '40', 'vh');
						gapUnit = parsed.unit;
						gapValue = parsed.num;
						plugin.settings.editorBottomGap = defaultVal;
						await plugin.saveSettings();
						setCssProps(document.documentElement, {
							'--alphatex-editor-bottom-gap': defaultVal,
						});
						gapText.setValue(parsed.num);
						gapDropdown.setValue(parsed.unit);
						new Notice(t('settings.editor.resetToDefaultMessage'));
					});
			});
	}

	new Setting(tabContents)
		.setName(t('settings.editor.defaultLayout'))
		.setDesc(t('settings.editor.defaultLayoutDesc'))
		.addDropdown((dropdown) => {
			dropdown
				.addOption('horizontal', t('settings.editor.layoutHorizontal'))
				.addOption('single-bar', t('settings.editor.layoutSingleBar'))
				.addOption('vertical', t('settings.editor.layoutVertical'))
				.addOption('horizontal-swapped', t('settings.editor.layoutHorizontalSwapped'))
				.addOption('vertical-swapped', t('settings.editor.layoutVerticalSwapped'))
				.setValue(plugin.settings.editorViewDefaultLayout || 'horizontal')
				.onChange(
					async (
						value:
							| 'horizontal'
							| 'vertical'
							| 'horizontal-swapped'
							| 'vertical-swapped'
							| 'single-bar'
					) => {
						plugin.settings.editorViewDefaultLayout = value;
						await plugin.saveSettings();
						new Notice(t('settings.editor.layoutSaved'));
					}
				);
		});

	// Custom Highlight settings (collapsible)
	{
		const details = tabContents.createEl('details', {
			cls: 'tabflow-highlight-section',
		});
		details.createEl('summary', {
			text: 'Custom highlight',
			cls: 'tabflow-highlight-section__summary',
		});

		// Helper: render a compact preview for each highlight type using existing CSS classes
		const renderHighlightPreview = (key: string): DocumentFragment => {
			const wrap = createDiv();
			wrap.classList.add('cm-content', 'tabflow-highlight-preview');

			const span = (cls: string, text?: string) => {
				const el = createSpan();
				el.className = cls;
				if (text != null) el.textContent = text;
				return el;
			};

			switch (key) {
				case 'dot': {
					wrap.append(
						span('', 'Example: '),
						span('highlighted-dot', '.'),
						span('', ' • '),
						span('highlighted-dot', '.')
					);
					break;
				}
				case 'bar': {
					wrap.append(
						span('', 'Example: '),
						span('highlighted-bar', '|'),
						span('bar-number', '12')
					);
					break;
				}
				case 'bracket': {
					wrap.append(
						span('', 'Example: '),
						span('cm-bracket', '('),
						span('cm-bracket', ')')
					);
					break;
				}
				case 'meta': {
					wrap.append(
						span('', 'Example: '),
						span('cm-metadata', '\\tempo'),
						span('', '120')
					);
					break;
				}
				case 'comment': {
					wrap.append(span('', 'Example: '), span('cm-comment', '// comment 注释'));
					break;
				}
				case 'debug': {
					wrap.append(
						span('', 'Example: '),
						span('cm-debug-meta', '\\title'),
						span('cm-debug-number', '120'),
						span('cm-debug-effect-key', 'tr'),
						span('cm-debug-lbrace', '{'),
						span('cm-debug-effect-arg', '4'),
						span('cm-debug-rbrace', '}'),
						span('cm-debug-duration', ':4'),
						span('cm-debug-pipe', '|'),
						span('cm-debug-dot', '.')
					);
					break;
				}
				case 'whitespace': {
					const a = createSpan();
					a.textContent = 'A';
					const space = span('cm-whitespace-space', ' '); // render visible dot via ::before
					const b = createSpan();
					b.textContent = 'B';
					wrap.append(span('', 'Example: '), a, space, b);
					break;
				}
				case 'surrounded': {
					wrap.append(
						span('', 'Example: '),
						span('', '('),
						span('cm-surrounded', 'abc'),
						span('', ')'),
						span('', ' / '),
						span('', ' '),
						span('cm-surrounded', 'foo'),
						span('', ' ')
					);
					break;
				}
				case 'duration': {
					wrap.append(span('', 'Example: '), span('cm-duration', ':4'));
					break;
				}
				case 'effect': {
					wrap.append(
						span('', 'Example: '),
						span('cm-effect-beat', 'tempo'),
						span('cm-effect-note', 'tr')
					);
					break;
				}
				case 'tuning': {
					wrap.append(span('', 'Example: '), span('cm-tuning', 'A4'));
					break;
				}
				case 'boolean': {
					wrap.append(
						span('', 'Example: '),
						span('cm-boolean', 'true'),
						span('', '/'),
						span('cm-boolean', 'false')
					);
					break;
				}
				default: {
					wrap.append(span('', 'Example')); // fallback
				}
			}
			const frag = createFragment();
			frag.appendChild(wrap);
			return frag;
		};
		const highlights = [
			{ key: 'dot', label: t('settings.editor.highlights.dot') },
			{ key: 'bar', label: t('settings.editor.highlights.bar') },
			{ key: 'bracket', label: t('settings.editor.highlights.bracket') },
			{ key: 'meta', label: t('settings.editor.highlights.meta') },
			{ key: 'comment', label: t('settings.editor.highlights.comment') },
			{ key: 'debug', label: t('settings.editor.highlights.debug') },
			{ key: 'whitespace', label: t('settings.editor.highlights.whitespace') },
			{ key: 'surrounded', label: t('settings.editor.highlights.surrounded') },
			{ key: 'duration', label: t('settings.editor.highlights.duration') },
			{ key: 'effect', label: t('settings.editor.highlights.effect') },
			{ key: 'tuning', label: t('settings.editor.highlights.tuning') },
			{ key: 'boolean', label: t('settings.editor.highlights.boolean') },
		];

		// Markdown editor preview for highlight settings (syntax highlighting only)
		const previewContainer = details.createDiv({
			cls: 'tabflow-highlight-preview-container',
		});

		const sampleCode = `\\title "Sample Song"
\\tempo 120
.
// To do: 完善这里的示例
\\chord "Bm/D" 2 3 4 0 x x
\\chord "Cadd9" 0 3 0 2 3 x
\\chord "G/B" x 3 0 0 2 x
\\chord "Am7" 3 1 0 2 0 x
\\chord "G" 3 0 0 0 2 3
\\chord "F" 2 2 3 4 4 2
\\chord "B7" 2 0 2 1 2 x
\\chord "Em" 0 0 0 2 2 0
.
`;

		let currentEditorHandle: EmbeddableMarkdownEditor | null = null;

		const renderPreview = () => {
			if (currentEditorHandle) {
				currentEditorHandle.destroy();
			}
			previewContainer.empty();
			const editorWrap = previewContainer.createDiv({
				cls: 'tabflow-highlight-preview-editor',
			});
			currentEditorHandle = createEmbeddableMarkdownEditor(app, editorWrap, {
				value: sampleCode,
				highlightSettings: plugin.settings.editorHighlights || {},
			});
		};
		// Initial preview load
		renderPreview();

		// Reset to default button for Custom Highlight settings (visual matches other resets)
		new Setting(details)
			.setName(t('settings.editor.resetHighlightToDefault'))
			.setDesc(t('settings.editor.resetHighlightToDefaultDesc'))
			.setClass('tabflow-no-border')
			.addButton((btn) => {
				btn.setButtonText(t('settings.editor.resetHighlightToDefault')).onClick(
					async () => {
						try {
							plugin.settings.editorHighlights = structuredClone(
								DEFAULT_SETTINGS.editorHighlights || {}
							);
							await plugin.saveSettings();
							// Refresh preview to show default highlight settings
							renderPreview();
							renderHighlightControls();
							new Notice(t('settings.editor.resetHighlightToDefaultSuccess'));
						} catch (e) {
							new Notice(
								t('settings.editor.resetHighlightToDefaultFailed') +
									': ' +
									formatError(e)
							);
						}
					}
				);
			});

		const highlightedGroup = details.createDiv({
			cls: 'tabflow-highlight-grid',
		});

		const renderHighlightControls = () => {
			highlightedGroup.empty();
			highlights.forEach((h) => {
				new Setting(highlightedGroup)
					.setName(h.label)
					.setDesc(renderHighlightPreview(h.key))
					.addToggle((t) => {
						const enabled = !!(
							plugin.settings.editorHighlights &&
							plugin.settings.editorHighlights[h.key]
						);
						t.setValue(enabled).onChange((v) => {
							void (async () => {
								plugin.settings.editorHighlights =
									plugin.settings.editorHighlights || {};
								plugin.settings.editorHighlights[h.key] = v;
								await plugin.saveSettings();
								// Refresh markdown editor preview to apply new highlight settings
								renderPreview();
							})();
						});
					})
					.setClass('tabflow-no-border');
			});
		};

		// Initial render of highlight controls
		renderHighlightControls();
	}

	// Editor Bar Settings
	new Setting(tabContents).setName(t('settings.editor.barTitle')).setHeading();
	new Setting(tabContents)
		.setName(t('settings.editor.resetToDefault'))
		.setDesc(t('settings.editor.resetToDefaultDesc'))
		.setClass('tabflow-no-border')
		.addButton((btn) => {
			btn.setButtonText(t('settings.editor.resetToDefault')).onClick(async () => {
				try {
					plugin.settings.editorBar = {
						components: structuredClone(
							DEFAULT_SETTINGS.editorBar?.components ?? {}
						) as EditorBarComponentVisibility,
						order: (DEFAULT_SETTINGS.editorBar?.order || []).slice(),
					};
					await plugin.saveSettings();
					try {
						triggerWorkspaceEvent(app, 'tabflow:editorbar-components-changed');
					} catch {
						// Ignore workspace trigger errors
					}
					renderCards(); // 重新渲染设置界面
					new Notice(t('settings.editor.resetToDefaultSuccess'));
				} catch (e) {
					new Notice(t('settings.editor.resetToDefaultFailed') + ': ' + formatError(e));
				}
			});
		});

	const cardsWrap = tabContents.createDiv({
		cls: 'tabflow-card-list',
	});

	const meta: Array<{
		key: keyof EditorBarComponentVisibility;
		label: string;
		icon: string;
		desc?: string;
		disabled?: boolean;
	}> = [
		{
			key: 'playPause',
			label: t('settings.editor.components.playPause'),
			icon: 'play',
		},
		{
			key: 'stop',
			label: t('settings.editor.components.stop'),
			icon: 'square',
		},
		{
			key: 'metronome',
			label: t('settings.editor.components.metronome'),
			icon: 'lucide-music-2',
		},
		{
			key: 'countIn',
			label: t('settings.editor.components.countIn'),
			icon: 'lucide-timer',
		},
		{
			key: 'tracks',
			label: t('settings.editor.components.tracks'),
			icon: 'lucide-layers',
		},
		{
			key: 'refresh',
			label: t('settings.editor.components.refresh'),
			icon: 'lucide-refresh-ccw',
		},
		{
			key: 'locateCursor',
			label: t('settings.editor.components.locateCursor'),
			icon: 'lucide-crosshair',
		},
		{
			key: 'layoutToggle',
			label: t('settings.editor.components.layoutToggle'),
			icon: 'lucide-layout',
		},
		{
			key: 'exportMenu',
			label: t('settings.editor.components.exportMenu'),
			icon: 'lucide-download',
		},
		{
			key: 'toTop',
			label: t('settings.editor.components.toTop'),
			icon: 'lucide-chevrons-up',
		},
		{
			key: 'toBottom',
			label: t('settings.editor.components.toBottom'),
			icon: 'lucide-chevrons-down',
		},
		{
			key: 'openSettings',
			label: t('settings.editor.components.openSettings'),
			icon: 'settings',
		},
		{
			key: 'progressBar',
			label: t('settings.editor.components.progressBar'),
			icon: 'lucide-line-chart',
		},
		{
			key: 'speed',
			label: t('settings.editor.components.speed'),
			icon: 'lucide-gauge',
		},
		{
			key: 'staveProfile',
			label: t('settings.editor.components.staveProfile'),
			icon: 'lucide-list-music',
		},
		{
			key: 'zoom',
			label: t('settings.editor.components.zoom'),
			icon: 'lucide-zoom-in',
		},
		{
			key: 'scrollMode',
			label: t('settings.editor.components.scrollMode'),
			icon: 'lucide-scroll',
		},
		{
			key: 'audioPlayer',
			label: t('settings.editor.components.audioPlayer'),
			icon: 'audio-file',
			disabled: true,
			desc: t('settings.editor.components.audioPlayerDesc'),
		},
	];

	const getOrder = (): string[] => {
		const def = [
			'progressBar',
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
			'speed',
			'staveProfile',
			'zoom',
			'scrollMode',
			'audioPlayer',
		];
		const saved = plugin.settings.editorBar?.order;

		if (Array.isArray(saved) && saved.length > 0) {
			const savedSet = new Set(saved);
			const missing = def.filter((item) => !savedSet.has(item));
			if (missing.length > 0) {
				const newOrder = [...saved, ...missing];
				if (plugin.settings.editorBar) {
					plugin.settings.editorBar.order = newOrder;
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
		const order = getOrder().filter((k): k is keyof EditorBarComponentVisibility =>
			meta.some((m) => m.key === k)
		);
		const comp = plugin.settings.editorBar?.components;
		order.forEach((key) => {
			const m = meta.find((x) => x.key === key);
			if (!m) return;
			const card = cardsWrap.createDiv({
				cls: ['tabflow-card', 'tabflow-card--draggable', 'tabflow-card--compact'],
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
				attr: {
					'aria-label': t('settings.editor.moveUp'),
					role: 'button',
					tabindex: '0',
				},
			});
			setIcon(upIcon, 'lucide-arrow-up');
			const downIcon = right.createSpan({
				cls: 'icon-clickable',
				attr: {
					'aria-label': t('settings.editor.moveDown'),
					role: 'button',
					tabindex: '0',
				},
			});
			setIcon(downIcon, 'lucide-arrow-down');

			new Setting(right)
				.addToggle((toggle) => {
					const current = !!comp?.[key];
					toggle.setValue(m.disabled ? false : current).onChange((value) => {
						void (async () => {
							const editorBarSettings =
								plugin.settings.editorBar ??
								(plugin.settings.editorBar = {
									components: JSON.parse(
										JSON.stringify(DEFAULT_SETTINGS.editorBar?.components || {})
									) as EditorBarComponentVisibility,
									order: (DEFAULT_SETTINGS.editorBar?.order || []).slice(),
								});
							const components =
								editorBarSettings.components ??
								(editorBarSettings.components = JSON.parse(
									JSON.stringify(DEFAULT_SETTINGS.editorBar?.components || {})
								) as EditorBarComponentVisibility);

							components[key] = m.disabled ? false : value;
							await plugin.saveSettings();
							try {
								triggerWorkspaceEvent(app, 'tabflow:editorbar-components-changed');
							} catch {
								// Ignore workspace trigger errors
							}
						})();
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
						plugin.settings.editorBar = plugin.settings.editorBar || {
							components: {} as EditorBarComponentVisibility,
						};
						plugin.settings.editorBar.order = cur;
						await plugin.saveSettings();
						renderCards();
					});
					try {
						triggerWorkspaceEvent(app, 'tabflow:editorbar-components-changed');
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
						plugin.settings.editorBar = plugin.settings.editorBar || {
							components: {} as EditorBarComponentVisibility,
						};
						plugin.settings.editorBar.order = cur;
						await plugin.saveSettings();
						renderCards();
					});
					try {
						triggerWorkspaceEvent(app, 'tabflow:editorbar-components-changed');
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
					plugin.settings.editorBar = plugin.settings.editorBar || {
						components: {} as EditorBarComponentVisibility,
					};
					plugin.settings.editorBar.order = cur;
					await plugin.saveSettings();
					renderCards();
					try {
						triggerWorkspaceEvent(app, 'tabflow:editorbar-components-changed');
					} catch {
						// Ignore workspace trigger errors
					}
					draggingKey = null;
				})();
			});
		});
	};
	renderCards();

	return Promise.resolve();
}
