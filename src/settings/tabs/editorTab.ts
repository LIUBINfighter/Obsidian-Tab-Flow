import { App, Notice, Setting, TextComponent, DropdownComponent } from 'obsidian';
import { setIcon } from 'obsidian';
import TabFlowPlugin from '../../main';
import { t } from '../../i18n';
import { DEFAULT_SETTINGS, EditorBarComponentVisibility } from '../defaults';
import {
	createEmbeddableMarkdownEditor,
	type EmbeddableMarkdownEditor,
} from '../../editor/EmbeddableMarkdownEditor';

export async function renderEditorTab(
	tabContents: HTMLElement,
	plugin: TabFlowPlugin,
	app: App
): Promise<void> {
	// Editor View Settings
	tabContents.createEl('h4', {
		text: t('settings.editor.viewTitle', undefined, '编辑器视图设置'),
	});

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
			.setName(t('settings.editor.fontSize', undefined, '编辑器字体大小'))
			.setDesc(
				t(
					'settings.editor.fontSizeDesc',
					undefined,
					'数值 + 单位，例如 0.95 rem；仅接受数字并从下拉选择单位'
				)
			);

		sFont
			.addText((text) => {
				fontText = text;
				const inputEl = text.inputEl;
				if (inputEl) {
					inputEl.setAttribute('type', 'number');
					inputEl.setAttribute('step', '0.01');
					inputEl.setAttribute('min', '0');
				}
				text.setValue(fontDefault.num).onChange(async (numStr) => {
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
					document.documentElement.style.setProperty(
						'--alphatex-editor-font-size',
						composed
					);
				});
			})
			.addDropdown((dd) => {
				fontDropdown = dd;
				unitsFont.forEach((u) => dd.addOption(u, u));
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
						document.documentElement.style.setProperty(
							'--alphatex-editor-font-size',
							composed
						);
					})();
				});
			})
			.addButton((btn) => {
				btn.setIcon('rotate-ccw')
					.setTooltip('重置为默认')
					.onClick(async () => {
						const defaultVal = DEFAULT_SETTINGS.editorFontSize || '0.95rem';
						const parsed = parseCssValue(defaultVal, '0.95', 'rem');
						fontUnit = parsed.unit;
						fontValue = parsed.num;
						plugin.settings.editorFontSize = defaultVal;
						await plugin.saveSettings();
						document.documentElement.style.setProperty(
							'--alphatex-editor-font-size',
							defaultVal
						);
						fontText.setValue(parsed.num);
						fontDropdown.setValue(parsed.unit);
						new Notice(
							t('settings.editor.resetToDefaultMessage', undefined, '已重置为默认')
						);
					});
			});

		// Bottom gap
		const gapDefault = parseCssValue(
			plugin.settings.editorBottomGap || DEFAULT_SETTINGS.editorBottomGap,
			'40',
			'vh'
		);

		const sGap = new Setting(tabContents)
			.setName(t('settings.editor.bottomGap', undefined, '编辑器底部留白'))
			.setDesc(
				t(
					'settings.editor.bottomGapDesc',
					undefined,
					'数值 + 单位，例如 40 vh；仅接受数字并从下拉选择单位'
				)
			);

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
					document.documentElement.style.setProperty(
						'--alphatex-editor-bottom-gap',
						composed
					);
				})();
			});
		})
			.addDropdown((dd) => {
				gapDropdown = dd;
				unitsGap.forEach((u) => dd.addOption(u, u));
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
						document.documentElement.style.setProperty(
							'--alphatex-editor-bottom-gap',
							composed
						);
					})();
				});
			})
			.addButton((btn) => {
				btn.setIcon('rotate-ccw')
					.setTooltip('重置为默认')
					.onClick(async () => {
						const defaultVal = DEFAULT_SETTINGS.editorBottomGap || '40vh';
						const parsed = parseCssValue(defaultVal, '40', 'vh');
						gapUnit = parsed.unit;
						gapValue = parsed.num;
						plugin.settings.editorBottomGap = defaultVal;
						await plugin.saveSettings();
						document.documentElement.style.setProperty(
							'--alphatex-editor-bottom-gap',
							defaultVal
						);
						gapText.setValue(parsed.num);
						gapDropdown.setValue(parsed.unit);
						new Notice(
							t('settings.editor.resetToDefaultMessage', undefined, '已重置为默认')
						);
					});
			});
	}

	new Setting(tabContents)
		.setName(t('settings.editor.defaultLayout', undefined, '默认布局'))
		.setDesc(t('settings.editor.defaultLayoutDesc', undefined, '编辑器视图的默认布局模式'))
		.addDropdown((dropdown) => {
			dropdown
				.addOption(
					'horizontal',
					t('settings.editor.layoutHorizontal', undefined, '水平布局')
				)
				.addOption(
					'single-bar',
					t('settings.editor.layoutSingleBar', undefined, '单小节模式')
				)
				.addOption('vertical', t('settings.editor.layoutVertical', undefined, '垂直布局'))
				.addOption(
					'horizontal-swapped',
					t('settings.editor.layoutHorizontalSwapped', undefined, '水平布局（交换）')
				)
				.addOption(
					'vertical-swapped',
					t('settings.editor.layoutVerticalSwapped', undefined, '垂直布局（交换）')
				)
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
						new Notice(t('settings.editor.layoutSaved', undefined, '布局设置已保存'));
					}
				);
		});

	// Custom Highlight settings (collapsible)
	{
		const details = tabContents.createEl('details', {
			cls: 'tabflow-highlight-section',
		});
		details.createEl('summary', {
			text: 'Custom Highlight',
			cls: 'tabflow-highlight-section__summary',
		});

		// Helper: render a compact preview for each highlight type using existing CSS classes
		const renderHighlightPreview = (key: string): DocumentFragment => {
			const wrap = document.createElement('div');
			wrap.classList.add('cm-content', 'tabflow-highlight-preview');

			const span = (cls: string, text?: string) => {
				const el = document.createElement('span');
				el.className = cls;
				if (text != null) el.textContent = text;
				return el;
			};

			switch (key) {
				case 'dot': {
					wrap.append(
						span('', 'Example:'),
						span('highlighted-dot', '.'),
						span('', ' • '),
						span('highlighted-dot', '.')
					);
					break;
				}
				case 'bar': {
					wrap.append(
						span('', 'Example:'),
						span('highlighted-bar', '|'),
						span('bar-number', '12')
					);
					break;
				}
				case 'bracket': {
					wrap.append(
						span('', 'Example:'),
						span('cm-bracket', '('),
						span('cm-bracket', ')')
					);
					break;
				}
				case 'meta': {
					wrap.append(
						span('', 'Example:'),
						span('cm-metadata', '\\tempo'),
						span('', '120')
					);
					break;
				}
				case 'comment': {
					wrap.append(span('', 'Example:'), span('cm-comment', '// comment 注释'));
					break;
				}
				case 'debug': {
					wrap.append(
						span('', 'Example:'),
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
					const a = document.createElement('span');
					a.textContent = 'a';
					const space = span('cm-whitespace-space', ' '); // render visible dot via ::before
					const b = document.createElement('span');
					b.textContent = 'b';
					wrap.append(span('', 'Example:'), a, space, b);
					break;
				}
				case 'surrounded': {
					wrap.append(
						span('', 'Example:'),
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
					wrap.append(span('', 'Example:'), span('cm-duration', ':4'));
					break;
				}
				case 'effect': {
					wrap.append(
						span('', 'Example:'),
						span('cm-effect-beat', 'tempo'),
						span('cm-effect-note', 'tr')
					);
					break;
				}
				case 'tuning': {
					wrap.append(span('', 'Example:'), span('cm-tuning', 'A4'));
					break;
				}
				case 'boolean': {
					wrap.append(
						span('', 'Example:'),
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
			const frag = document.createDocumentFragment();
			frag.appendChild(wrap);
			return frag;
		};
		const highlights = [
			{ key: 'dot', label: t('settings.editor.highlights.dot', undefined, '点符号 (.)') },
			{ key: 'bar', label: t('settings.editor.highlights.bar', undefined, '小节竖线 (|)') },
			{
				key: 'bracket',
				label: t('settings.editor.highlights.bracket', undefined, '括号 ()/{}'),
			},
			{
				key: 'meta',
				label: t('settings.editor.highlights.meta', undefined, '元信息 (\\title, \\tempo)'),
			},
			{
				key: 'comment',
				label: t('settings.editor.highlights.comment', undefined, '行注释 (//)'),
			},
			{
				key: 'debug',
				label: t('settings.editor.highlights.debug', undefined, 'Debug 高亮（仅调试）'),
			},
			{
				key: 'whitespace',
				label: t('settings.editor.highlights.whitespace', undefined, '可见空白'),
			},
			{
				key: 'surrounded',
				label: t('settings.editor.highlights.surrounded', undefined, '被空白包围的序列'),
			},
			{
				key: 'duration',
				label: t('settings.editor.highlights.duration', undefined, '时长标记 (:4)'),
			},
			{
				key: 'effect',
				label: t('settings.editor.highlights.effect', undefined, '效果关键字'),
			},
			{
				key: 'tuning',
				label: t('settings.editor.highlights.tuning', undefined, '调弦文字 (A4)'),
			},
			{
				key: 'boolean',
				label: t('settings.editor.highlights.boolean', undefined, '布尔字面量'),
			},
		];

		// Markdown editor preview for highlight settings (syntax highlighting only)
		const previewContainer = details.createDiv({
			cls: 'tabflow-highlight-preview-container',
		});

		const sampleCode = `\\title "Sample Song"
\\tempo 120
.
// TO DO 完善这里的示例
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
			.setName(t('settings.editor.resetHighlightToDefault', undefined, '重置高亮为默认'))
			.setDesc(
				t(
					'settings.editor.resetHighlightToDefaultDesc',
					undefined,
					'重置所有语法高亮设置到默认值'
				)
			)
			.setClass('tabflow-no-border')
			.addButton((btn) => {
				btn.setButtonText(
					t('settings.editor.resetHighlightToDefault', undefined, '重置高亮为默认')
				).onClick(async () => {
					try {
						plugin.settings.editorHighlights = JSON.parse(
							JSON.stringify(DEFAULT_SETTINGS.editorHighlights || {})
						);
						await plugin.saveSettings();
						// Refresh preview to show default highlight settings
						renderPreview();
						renderHighlightControls();
						new Notice(
							t(
								'settings.editor.resetHighlightToDefaultSuccess',
								undefined,
								'高亮设置已重置'
							)
						);
					} catch (e) {
						new Notice(
							t(
								'settings.editor.resetHighlightToDefaultFailed',
								undefined,
								'重置失败: '
							) + e
						);
					}
				});
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
						t.setValue(enabled).onChange(async (v) => {
							plugin.settings.editorHighlights =
								plugin.settings.editorHighlights || {};
							plugin.settings.editorHighlights[h.key] = v;
							await plugin.saveSettings();
							// Refresh markdown editor preview to apply new highlight settings
							renderPreview();
						});
					})
					.setClass('tabflow-no-border');
			});
		};

		// Initial render of highlight controls
		renderHighlightControls();
	}

	// Editor Bar Settings
	tabContents.createEl('h4', { text: t('settings.editor.barTitle', undefined, '编辑器栏设置') });

	new Setting(tabContents)
		.setName(t('settings.editor.resetToDefault', undefined, '重置为默认'))
		.setDesc(
			t('settings.editor.resetToDefaultDesc', undefined, '重置编辑器栏的所有设置到默认值')
		)
		.setClass('tabflow-no-border')
		.addButton((btn) => {
			btn.setButtonText(t('settings.editor.resetToDefault', undefined, '重置为默认')).onClick(
				async () => {
					try {
						plugin.settings.editorBar = {
							components: JSON.parse(
								JSON.stringify(DEFAULT_SETTINGS.editorBar?.components || {})
							),
							order: (DEFAULT_SETTINGS.editorBar?.order || []).slice(),
						};
						await plugin.saveSettings();
						try {
							/* @ts-ignore */ app.workspace.trigger(
								'tabflow:editorbar-components-changed'
							);
						} catch {
							// Ignore workspace trigger errors
						}
						renderCards(); // 重新渲染设置界面
						new Notice(
							t(
								'settings.editor.resetToDefaultSuccess',
								undefined,
								'编辑器栏设置已重置'
							)
						);
					} catch (e) {
						new Notice(
							t('settings.editor.resetToDefaultFailed', undefined, '重置失败: ') + e
						);
					}
				}
			);
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
			label: t('settings.editor.components.playPause', undefined, '播放/暂停'),
			icon: 'play',
		},
		{
			key: 'stop',
			label: t('settings.editor.components.stop', undefined, '停止'),
			icon: 'square',
		},
		{
			key: 'metronome',
			label: t('settings.editor.components.metronome', undefined, '节拍器'),
			icon: 'lucide-music-2',
		},
		{
			key: 'countIn',
			label: t('settings.editor.components.countIn', undefined, '倒计时'),
			icon: 'lucide-timer',
		},
		{
			key: 'tracks',
			label: t('settings.editor.components.tracks', undefined, '音轨选择'),
			icon: 'lucide-layers',
		},
		{
			key: 'refresh',
			label: t('settings.editor.components.refresh', undefined, '刷新'),
			icon: 'lucide-refresh-ccw',
		},
		{
			key: 'locateCursor',
			label: t('settings.editor.components.locateCursor', undefined, '定位光标'),
			icon: 'lucide-crosshair',
		},
		{
			key: 'layoutToggle',
			label: t('settings.editor.components.layoutToggle', undefined, '布局切换'),
			icon: 'lucide-layout',
		},
		{
			key: 'exportMenu',
			label: t('settings.editor.components.exportMenu', undefined, '导出菜单'),
			icon: 'lucide-download',
		},
		{
			key: 'toTop',
			label: t('settings.editor.components.toTop', undefined, '到顶部'),
			icon: 'lucide-chevrons-up',
		},
		{
			key: 'toBottom',
			label: t('settings.editor.components.toBottom', undefined, '到底部'),
			icon: 'lucide-chevrons-down',
		},
		{
			key: 'openSettings',
			label: t('settings.editor.components.openSettings', undefined, '打开设置'),
			icon: 'settings',
		},
		{
			key: 'progressBar',
			label: t('settings.editor.components.progressBar', undefined, '进度条'),
			icon: 'lucide-line-chart',
		},
		{
			key: 'speed',
			label: t('settings.editor.components.speed', undefined, '速度控制'),
			icon: 'lucide-gauge',
		},
		{
			key: 'staveProfile',
			label: t('settings.editor.components.staveProfile', undefined, '谱表配置'),
			icon: 'lucide-list-music',
		},
		{
			key: 'zoom',
			label: t('settings.editor.components.zoom', undefined, '缩放'),
			icon: 'lucide-zoom-in',
		},
		{
			key: 'scrollMode',
			label: t('settings.editor.components.scrollMode', undefined, '滚动模式'),
			icon: 'lucide-scroll',
		},
		{
			key: 'audioPlayer',
			label: t('settings.editor.components.audioPlayer', undefined, '音频播放器'),
			icon: 'audio-file',
			disabled: true,
			desc: t(
				'settings.editor.components.audioPlayerDesc',
				undefined,
				'编辑器视图中暂不支持音频播放器'
			),
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
					'aria-label': t('settings.editor.moveUp', undefined, '上移'),
					role: 'button',
					tabindex: '0',
				},
			});
			setIcon(upIcon, 'lucide-arrow-up');
			const downIcon = right.createSpan({
				cls: 'icon-clickable',
				attr: {
					'aria-label': t('settings.editor.moveDown', undefined, '下移'),
					role: 'button',
					tabindex: '0',
				},
			});
			setIcon(downIcon, 'lucide-arrow-down');

			new Setting(right)
				.addToggle((toggle) => {
					const current = !!comp?.[key];
					toggle.setValue(m.disabled ? false : current).onChange(async (value) => {
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
							/* @ts-ignore */ app.workspace.trigger(
								'tabflow:editorbar-components-changed'
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
						plugin.settings.editorBar = plugin.settings.editorBar || {
							components: {} as EditorBarComponentVisibility,
						};
						plugin.settings.editorBar.order = cur;
						await plugin.saveSettings();
						renderCards();
					});
					try {
						/* @ts-ignore */ app.workspace.trigger(
							'tabflow:editorbar-components-changed'
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
						plugin.settings.editorBar = plugin.settings.editorBar || {
							components: {} as EditorBarComponentVisibility,
						};
						plugin.settings.editorBar.order = cur;
						await plugin.saveSettings();
						renderCards();
					});
					try {
						/* @ts-ignore */ app.workspace.trigger(
							'tabflow:editorbar-components-changed'
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
					plugin.settings.editorBar = plugin.settings.editorBar || {
						components: {} as EditorBarComponentVisibility,
					};
					plugin.settings.editorBar.order = cur;
					await plugin.saveSettings();
					renderCards();
					try {
						/* @ts-ignore */ app.workspace.trigger(
							'tabflow:editorbar-components-changed'
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
}
