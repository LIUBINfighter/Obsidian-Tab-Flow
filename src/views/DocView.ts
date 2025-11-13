import { ItemView, WorkspaceLeaf } from 'obsidian';
import TabFlowPlugin from '../main';
import panelsRegistry, { DocPanel, loadDocPanels } from './docs/index';
import { t, getCurrentLanguageCode, addLanguageChangeListener } from '../i18n';

export const VIEW_TYPE_TABFLOW_DOC = 'tabflow-doc-view';
// 兼容导出：保留旧名称以避免其它文件立刻出错
export const VIEW_TYPE_ALPHATEX_DOC = VIEW_TYPE_TABFLOW_DOC;

// 面板类型与注册列表已集中在 ./docs/index.ts

export class DocView extends ItemView {
	plugin: TabFlowPlugin;
	panels: DocPanel[] = [];
	activeId: string | null = null;
	private layoutObserver?: ResizeObserver;
	private settingsAction: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TabFlowPlugin) {
		super(leaf);
		this.plugin = plugin;
		// 初始化面板为当前语言对应的集合
		try {
			this.panels = loadDocPanels(getCurrentLanguageCode());
			if (this.panels.length) this.activeId = this.panels[0].id;
		} catch {
			// fallback to registry
			this.panels = panelsRegistry;
			if (this.panels.length) this.activeId = this.panels[0].id;
		}

		// 监听全局语言变化，自动刷新面板
		try {
			const off = addLanguageChangeListener((language) => {
				try {
					this.panels = loadDocPanels(language);
					this.activeId = this.panels[0]?.id ?? null;
					// 如果视图已打开，重新渲染
					try {
						void this.render();
					} catch {
						/* ignore */
					}
				} catch (e) {
					console.warn('[DocView] Failed to switch panels on language change', e);
				}
			});
			// 在视图关闭时取消监听
			this.register(() => off());
		} catch {
			// ignore
		}
	}

	/**
	 * 在窄屏模式下切换内容后自动滚动到内容区域
	 * 简化版本：使用固定延迟，快速滚动
	 */
	private scrollToContentAfterRender(layout?: Element | null): void {
		// 如果没有传入layout参数，尝试从DOM中查找
		if (!layout) {
			layout = this.contentEl.querySelector('.tabflow-doc-layout');
			if (!layout) return;
		}

		if (!layout.classList.contains('is-narrow')) return;

		// 简单的延迟滚动，立即执行
		setTimeout(() => {
			if (!layout) return;
			const contentElement = layout.querySelector('.tabflow-doc-markdown');
			if (contentElement) {
				this.performScroll(contentElement);
			}
		}, 0); // 延迟为0ms，让滚动立即发生，进一步加速
	}

	/**
	 * 执行滚动操作，包含降级处理
	 */
	private performScroll(contentElement: Element | null): void {
		if (!contentElement) return;

		try {
			// 方案1：使用 smooth 滚动 + 统一滚动参数
			contentElement.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
				inline: 'nearest',
			});
		} catch {
			// 降级处理：使用相同参数的简单滚动
			try {
				contentElement.scrollIntoView({
					block: 'start',
					inline: 'nearest',
				});
			} catch {
				// 忽略滚动错误
			}
		}
	}

	getViewType(): string {
		return VIEW_TYPE_ALPHATEX_DOC;
	}

	getDisplayText(): string {
		return t('docView.displayText');
	}

	async onOpen() {
		await this.render();
	}

	async onClose() {
		// 清理右上角设置按钮（如果存在）
		try {
			if (this.settingsAction && this.settingsAction.parentElement) {
				this.settingsAction.remove();
			}
			this.settingsAction = null;
		} catch {
			// ignore
		}
	}

	private async render() {
		const container = this.contentEl;
		container.empty();

		// Header
		const header = container.createDiv({ cls: 'tabflow-doc-header' });

		// 标题（先渲染）
		header.createEl('h2', { text: t('docView.title') });

		// 按钮组（后渲染，和标题同级）
		const btnGroup = header.createDiv({ cls: 'tabflow-doc-header-btns' });

		// GitHub 按钮（SVG图标）
		const githubBtn = btnGroup.createEl('a', {
			href: 'https://github.com/LIUBINfighter/Obsidian-Tab-Flow',
			attr: { target: '_blank', rel: 'noopener', 'aria-label': 'GitHub' },
			cls: 'mod-cta',
		});

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', '22');
		svg.setAttribute('height', '22');
		svg.setAttribute('viewBox', '0 0 16 16');
		svg.setAttribute('fill', 'currentColor');
		svg.style.verticalAlign = 'middle';

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute(
			'd',
			'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.6-.18-3.29-.8-3.29-3.56 0-.79.28-1.43.74-1.93-.07-.18-.32-.91.07-1.89 0 0 .6-.19 1.97.73.57-.16 1.18-.24 1.79-.24.61 0 1.22.08 1.79.24 1.37-.92 1.97-.73 1.97-.73.39.98.14 1.71.07 1.89.46.5.74 1.14.74 1.93 0 2.77-1.69 3.38-3.3 3.56.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z'
		);

		svg.appendChild(path);
		githubBtn.appendChild(svg);

		// Issue 按钮（文字）
		const issueBtn = btnGroup.createEl('a', {
			href: 'https://github.com/LIUBINfighter/Obsidian-Tab-Flow/issues/55',
			attr: { target: '_blank', rel: 'noopener', 'aria-label': 'Issue' },
			cls: 'mod-cta',
		});
		issueBtn.innerText = 'Feedback';

		// alphaTab.js 官方文档按钮（黑体文字）
		const alphaTabBtn = btnGroup.createEl('a', {
			href: 'https://www.alphatab.net/',
			attr: {
				target: '_blank',
				rel: 'noopener',
				'aria-label': t('docView.alphaTabOfficialDoc'),
			},
			cls: 'mod-cta',
		});
		alphaTabBtn.innerText = 'alphaTab.js';

		// 使用视图 action 注入设置按钮，统一管理生命周期
		try {
			if (this.settingsAction && this.settingsAction.parentElement) {
				this.settingsAction.remove();
				this.settingsAction = null;
			}
			const btn = this.addAction('settings', t('docView.settings', undefined, '设置'), () => {
				try {
					// @ts-ignore
					this.plugin.app.workspace.trigger('tabflow:open-plugin-settings-about');
				} catch {
					try {
						// 退化处理
						// @ts-ignore
						this.plugin.app.commands.executeCommandById('app:open-settings');
						setTimeout(() => {
							try {
								const search = document.querySelector(
									'input.setting-search-input'
								) as HTMLInputElement | null;
								if (search) {
									search.value = 'Tab Flow';
									const ev = new Event('input', { bubbles: true });
									search.dispatchEvent(ev);
								}
							} catch {
								// Ignore search input errors
							}
						}, 120);
					} catch {
						// Ignore settings fallback errors
					}
				}
			});
			this.settingsAction = btn as unknown as HTMLElement;
		} catch (e) {
			// ignore
		}
		// Layout wrapper
		const layout = container.createDiv({ cls: 'tabflow-doc-layout' });
		// Observe width changes of the view container to toggle narrow layout per-view
		try {
			const applyNarrow = () => {
				const w = layout.clientWidth;
				if (w > 0 && w < 600) layout.addClass('is-narrow');
				else layout.removeClass('is-narrow');
			};
			this.layoutObserver?.disconnect();
			this.layoutObserver = new ResizeObserver(() => applyNarrow());
			this.layoutObserver.observe(layout);
			applyNarrow();
		} catch {
			// no-op
		}

		// Left column (tabs)
		const leftCol = layout.createDiv({ cls: 'tabflow-doc-left' });
		const nav = leftCol.createDiv({ cls: 'tabflow-doc-nav' });
		this.panels.forEach((panel) => {
			const tabEl = nav.createDiv({ cls: 'tabflow-doc-tab' });
			tabEl.setText(panel.title);
			tabEl.addEventListener('click', () => {
				this.activeId = panel.id;
				this.render().then(() => {
					this.scrollToContentAfterRender();
				});
			});
			if (panel.id === this.activeId) tabEl.addClass('active');
		});

		// Main column (content)
		const mainCol = layout.createDiv({ cls: 'tabflow-doc-main' });
		const contentWrap = mainCol.createDiv({ cls: 'tabflow-doc-markdown' });

		// render active panel
		const active = this.panels.find((p) => p.id === this.activeId) || this.panels[0];
		if (active) {
			// let panel render into the container; pass plugin so panels can access resources
			try {
				active.render(contentWrap, this.plugin);
			} catch (e) {
				contentWrap.setText(t('docView.renderError'));
			}
		}

		// In-panel navigation (上一条 / 下一条) inferred from panels order
		const currentIndex = Math.max(
			0,
			this.panels.findIndex((p) => p.id === (active?.id || null))
		);
		const prevPanel = currentIndex > 0 ? this.panels[currentIndex - 1] : null;
		const nextPanel =
			currentIndex < this.panels.length - 1 ? this.panels[currentIndex + 1] : null;

		if (prevPanel || nextPanel) {
			const docNav = contentWrap.createDiv({ cls: 'doc-nav' });

			if (prevPanel) {
				const prev = docNav.createDiv({ cls: 'doc-nav-item doc-nav-item--prev' });
				const label = prev.createDiv({
					cls: 'doc-nav-label',
					text: t('navigation.previous'),
				});
				label.setAttr('aria-hidden', 'true');
				prev.createDiv({ cls: 'doc-nav-title', text: prevPanel.title });
				prev.setAttr('role', 'button');
				prev.setAttr('tabindex', '0');
				prev.setAttr('aria-label', `${t('navigation.previous')}：${prevPanel.title}`);
				prev.addEventListener('click', () => {
					this.activeId = prevPanel.id;
					this.render().then(() => {
						this.scrollToContentAfterRender();
					});
				});
				prev.addEventListener('keypress', (e) => {
					if ((e as KeyboardEvent).key === 'Enter') {
						this.activeId = prevPanel.id;
						this.render().then(() => {
							this.scrollToContentAfterRender();
						});
					}
				});
			}

			if (nextPanel) {
				const next = docNav.createDiv({ cls: 'doc-nav-item doc-nav-item--next' });
				const label = next.createDiv({ cls: 'doc-nav-label', text: t('navigation.next') });
				label.setAttr('aria-hidden', 'true');
				next.createDiv({ cls: 'doc-nav-title', text: nextPanel.title });
				next.setAttr('role', 'button');
				next.setAttr('tabindex', '0');
				next.setAttr('aria-label', `${t('navigation.next')}：${nextPanel.title}`);
				next.addEventListener('click', () => {
					this.activeId = nextPanel.id;
					this.render().then(() => {
						this.scrollToContentAfterRender();
					});
				});
				next.addEventListener('keypress', (e) => {
					if (e.key === 'Enter') {
						this.activeId = nextPanel.id;
						this.render().then(() => {
							this.scrollToContentAfterRender();
						});
					}
				});
			}

			// layout class: one vs two columns
			const count = docNav.children.length;
			if (count >= 2) docNav.addClass('two');
			else docNav.addClass('one');
		}

		// 添加键盘事件处理器：支持左右箭头键切换页签
		this.registerDomEvent(layout, 'keydown', (e: KeyboardEvent) => {
			if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
				// 检查事件目标，如果用户正在编辑器或其他输入控件中，则不处理
				const target = e.target as Element;
				if (
					target &&
					(target.classList.contains('cm-content') || // CodeMirror 编辑器内容
						target.closest('.cm-editor') || // CodeMirror 编辑器容器
						target.closest('.inmarkdown-editor') || // playground 编辑器区域
						target.closest('input') || // 输入框
						target.closest('textarea') || // 文本域
						target.tagName === 'INPUT' || // 直接是输入元素
						target.tagName === 'TEXTAREA' || // 直接是文本域
						(target as HTMLElement).isContentEditable) // 可编辑内容
				) {
					return; // 不处理键盘事件，让编辑器正常工作
				}

				const currentIndex = this.panels.findIndex((p) => p.id === this.activeId);
				if (currentIndex === -1) return;

				let newIndex = currentIndex;
				if (e.key === 'ArrowLeft' && currentIndex > 0) {
					newIndex = currentIndex - 1;
				} else if (e.key === 'ArrowRight' && currentIndex < this.panels.length - 1) {
					newIndex = currentIndex + 1;
				}

				if (newIndex !== currentIndex) {
					// 阻止默认行为，避免与其他键盘导航冲突
					e.preventDefault();
					this.activeId = this.panels[newIndex].id;
					this.render().then(() => {
						this.scrollToContentAfterRender();
					});
				}
			}
		});
	}
}
