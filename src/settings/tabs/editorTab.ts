import { App, Notice, Setting } from 'obsidian';
import { setIcon } from 'obsidian';
import TabFlowPlugin from '../../main';
import { t } from '../../i18n';
import { DEFAULT_SETTINGS, EditorBarComponentVisibility } from '../defaults';

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

		const sFont = new Setting(tabContents)
			.setName(t('settings.editor.fontSize', undefined, '编辑器字体大小'))
			.setDesc(
				t(
					'settings.editor.fontSizeDesc',
					undefined,
					'数值 + 单位，例如 0.95 rem；仅接受数字并从下拉选择单位'
				)
			);

		let fontText: any;
		let fontDropdown: any;

		sFont
			.addText((text) => {
				fontText = text;
				// restrict to numeric input
				try {
					(text as any).inputEl.setAttribute('type', 'number');
					(text as any).inputEl.setAttribute('step', '0.01');
					(text as any).inputEl.setAttribute('min', '0');
				} catch (e) {
					console.debug('set input attributes failed', e);
				}
				text.setValue(fontDefault.num).onChange(async (numStr) => {
					const unit = (sFont as any).__unitValue || fontDefault.unit;
					const composed = `${numStr}${unit}`;
					const valid = /^\d+(?:\.\d+)?(px|rem)$/.test(composed);
					if (!valid) {
						// new Notice(t('settings.editor.invalidCss', undefined, '非法 CSS 值'));
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
					// new Notice(t('settings.editor.saved', undefined, '设置已保存'));
				});
			})
			.addDropdown((dd) => {
				fontDropdown = dd;
				unitsFont.forEach((u) => dd.addOption(u, u));
				dd.setValue(fontDefault.unit).onChange(async (unit) => {
					// store unit on setting instance for access from text handler
					(sFont as any).__unitValue = unit;
					const num = (sFont as any).value || fontDefault.num;
					const composed = `${num}${unit}`;
					const valid = /^\d+(?:\.\d+)?(px|rem)$/.test(composed);
					if (!valid) {
						// new Notice(t('settings.editor.invalidCss', undefined, '非法 CSS 值'));
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
					// new Notice(t('settings.editor.saved', undefined, '设置已保存'));
				});
			})
			.addButton((btn) => {
				btn.setIcon('rotate-ccw')
					.setTooltip('重置为默认')
					.onClick(async () => {
						const defaultVal = DEFAULT_SETTINGS.editorFontSize || '0.95rem';
						const parsed = parseCssValue(defaultVal, '0.95', 'rem');
						plugin.settings.editorFontSize = defaultVal;
						await plugin.saveSettings();
						document.documentElement.style.setProperty(
							'--alphatex-editor-font-size',
							defaultVal
						);
						// Update UI values
						fontText.setValue(parsed.num);
						fontDropdown.setValue(parsed.unit);
						(sFont as any).__unitValue = parsed.unit;
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

		let gapText: any;
		let gapDropdown: any;

		sGap.addText((text) => {
			gapText = text;
			try {
				(text as any).inputEl.setAttribute('type', 'number');
				(text as any).inputEl.setAttribute('step', '1');
				(text as any).inputEl.setAttribute('min', '0');
			} catch (e) {
				console.debug('set input attributes failed', e);
			}
			text.setValue(gapDefault.num).onChange(async (numStr) => {
				const unit = (sGap as any).__unitValue || gapDefault.unit;
				const composed = `${numStr}${unit}`;
				const valid = /^\d+(?:\.\d+)?(px|vh)$/.test(composed);
				if (!valid) {
					// new Notice(t('settings.editor.invalidCss', undefined, '非法 CSS 值'));
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
				// new Notice(t('settings.editor.saved', undefined, '设置已保存'));
			});
		})
			.addDropdown((dd) => {
				gapDropdown = dd;
				unitsGap.forEach((u) => dd.addOption(u, u));
				dd.setValue(gapDefault.unit).onChange(async (unit) => {
					(sGap as any).__unitValue = unit;
					const num = (sGap as any).value || gapDefault.num;
					const composed = `${num}${unit}`;
					const valid = /^\d+(?:\.\d+)?(px|vh)$/.test(composed);
					if (!valid) {
						// new Notice(t('settings.editor.invalidCss', undefined, '非法 CSS 值'));
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
					// new Notice(t('settings.editor.saved', undefined, '设置已保存'));
				});
			})
			.addButton((btn) => {
				btn.setIcon('rotate-ccw')
					.setTooltip('重置为默认')
					.onClick(async () => {
						const defaultVal = DEFAULT_SETTINGS.editorBottomGap || '40vh';
						const parsed = parseCssValue(defaultVal, '40', 'vh');
						plugin.settings.editorBottomGap = defaultVal;
						await plugin.saveSettings();
						document.documentElement.style.setProperty(
							'--alphatex-editor-bottom-gap',
							defaultVal
						);
						// Update UI values
						gapText.setValue(parsed.num);
						gapDropdown.setValue(parsed.unit);
						(sGap as any).__unitValue = parsed.unit;
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
				.addOption('vertical', t('settings.editor.layoutVertical', undefined, '垂直布局'))
				.setValue(plugin.settings.editorViewDefaultLayout || 'horizontal')
				.onChange(async (value: 'horizontal' | 'vertical') => {
					plugin.settings.editorViewDefaultLayout = value;
					await plugin.saveSettings();
					new Notice(t('settings.editor.layoutSaved', undefined, '布局设置已保存'));
				});
		});

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
		attr: { style: 'display:flex; flex-direction:column; gap:8px;' },
	});

	const meta: Array<{
		key: keyof EditorBarComponentVisibility | 'audioPlayer';
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
					plugin.saveSettings();
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
			(el as HTMLElement).style.background = '';
		});
	};

	const renderCards = () => {
		cardsWrap.empty();
		const order = getOrder().filter((k) => meta.some((m) => m.key === (k as any)));
		const comp = plugin.settings.editorBar?.components || ({} as any);
		order.forEach((key) => {
			const m = meta.find((x) => x.key === (key as any));
			if (!m) return;
			const card = cardsWrap.createDiv({
				cls: 'tabflow-card',
				attr: {
					draggable: 'true',
					style: 'display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px; border:1px solid var(--background-modifier-border); border-radius:6px;',
				},
			});
			card.dataset.key = String(key);
			const left = card.createDiv({
				attr: { style: 'display:flex; align-items:center; gap:8px;' },
			});
			left.createSpan({ text: '⠿', attr: { style: 'cursor:grab; user-select:none;' } });
			const iconEl = left.createSpan(); // Create the span element
			setIcon(iconEl, m.icon); // Use the imported setIcon function
			left.createEl('strong', { text: m.label });
			if (m.desc)
				left.createSpan({
					text: ` - ${m.desc}`,
					attr: { style: 'color:var(--text-muted);font-size:0.9em;' },
				});

			const right = card.createDiv({
				attr: { style: 'display:flex; align-items:center; gap:6px;' },
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
				.addToggle((t) => {
					const current = !!(comp as any)[key];
					t.setValue(m.disabled ? false : current).onChange(async (v) => {
						plugin.settings.editorBar = plugin.settings.editorBar || {
							components: {} as any,
						};
						(plugin.settings.editorBar as any).components =
							plugin.settings.editorBar?.components || {};
						(plugin.settings.editorBar as any).components[key] = m.disabled ? false : v;
						await plugin.saveSettings();
						try {
							/* @ts-ignore */ app.workspace.trigger(
								'tabflow:editorbar-components-changed'
							);
						} catch {
							// Ignore workspace trigger errors
						}
					});
					if (m.disabled)
						(t as any).toggleEl
							.querySelector('input')
							?.setAttribute('disabled', 'true');
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
				const newCard = cardsWrap.querySelector(
					`.tabflow-card[data-key="${rowKey}"]`
				) as HTMLElement | null;
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
							components: {} as any,
						};
						(plugin.settings.editorBar as any).order = cur;
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
							components: {} as any,
						};
						(plugin.settings.editorBar as any).order = cur;
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

			upIcon.addEventListener('click', () => moveUp());
			upIcon.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					moveUp();
				}
			});
			downIcon.addEventListener('click', () => moveDown());
			downIcon.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					moveDown();
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
				const offsetY = (e as DragEvent).clientY - rect.top;
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
			card.addEventListener('drop', async () => {
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
				plugin.settings.editorBar = plugin.settings.editorBar || { components: {} as any };
				(plugin.settings.editorBar as any).order = cur;
				await plugin.saveSettings();
				renderCards();
				try {
					/* @ts-ignore */ app.workspace.trigger('tabflow:editorbar-components-changed');
				} catch {
					// Ignore workspace trigger errors
				}
				draggingKey = null;
			});
		});
	};
	renderCards();
}
