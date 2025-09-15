import { Modal, Notice, Platform, MarkdownView } from 'obsidian';
import type TabFlowPlugin from '../main';
import { createAlphaTexPlayground, AlphaTexPlaygroundHandle } from './AlphaTexPlayground';
import * as domtoimage from 'dom-to-image-more';
import { waitAlphaTabFullRender, withExportLock } from '../utils/alphaTabRenderWait';

export class ShareCardModal extends Modal {
	private plugin: TabFlowPlugin;
	// 导出背景配置（仅在当前 modal 生命周期中有效）
	// three modes:
	//  - 'default' : backwards compatible behavior (only set bgcolor for jpeg)
	//  - 'auto'    : compute from preview root's computed background, fallback to white if transparent
	//  - 'custom'  : user provided color string like '#ffffff'
	private exportBgMode: 'default' | 'auto' | 'custom' = 'default';
	private exportBgCustomColor = '#ffffff';
	// Modal-local author/card customization (non-persistent)
	private showAuthor = false;
	private authorName = '';
	private authorRemark = '';
	private showAvatar = true;
	private avatarDataUrl: string | null = null;
	private authorPosition: 'top' | 'bottom' = 'bottom';
	private authorBg = '';
	private authorTextColor = '';
	private authorFontSize = 13;
	private authorContainer: HTMLElement | null = null;
	private playgroundContent: HTMLElement | null = null; // dedicated container for playground so author block isn't wiped
	private playgroundHandle: AlphaTexPlaygroundHandle | null = null;
	private cardRoot: HTMLElement | null = null;
	private panWrapper: HTMLElement | null = null;
	private offsetX = 0;
	private offsetY = 0;
	private isPanning = false;
	private panStartX = 0;
	private panStartY = 0;
	private originOffsetX = 0;
	private originOffsetY = 0;
	private zoomScale = 1;
	private minZoom = 0.5;
	private maxZoom = 3;
	private zoomStep = 0.1;

	// handler reference so we can remove listener on close
	private outsidePointerDownHandler: ((e: PointerEvent) => void) | null = null;

	private applyPanTransform() {
		if (this.panWrapper) {
			this.panWrapper.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoomScale})`;
		}
	}

	// Render or update the author info block inside cardRoot according to modal-local fields
	private renderAuthorBlock() {
		if (!this.cardRoot) return;
		// remove existing container if position changed
		if (this.authorContainer && this.authorContainer.parentElement) {
			this.authorContainer.remove();
			this.authorContainer = null;
		}
		if (!this.showAuthor) {
			return;
		}
		// create container
		this.authorContainer = document.createElement('div');
		this.authorContainer.className = 'share-card-author-container';
		this.authorContainer.style.display = 'flex';
		this.authorContainer.style.alignItems = 'center';
		this.authorContainer.style.gap = '8px';
		this.authorContainer.style.padding = '8px';
		// ensure author block is on top of playground content and stretches horizontally
		this.authorContainer.style.position = 'relative';
		this.authorContainer.style.zIndex = '10';
		this.authorContainer.style.width = '100%';
		if (this.authorBg) this.authorContainer.style.background = this.authorBg;
		if (this.authorTextColor) this.authorContainer.style.color = this.authorTextColor;
		this.authorContainer.style.fontSize = `${this.authorFontSize}px`;

		if (this.showAvatar && this.avatarDataUrl) {
			const avatarEl = document.createElement('div');
			avatarEl.className = 'share-card-author-avatar';
			avatarEl.style.width = '40px';
			avatarEl.style.height = '40px';
			avatarEl.style.backgroundImage = `url(${this.avatarDataUrl})`;
			avatarEl.style.backgroundSize = 'cover';
			avatarEl.style.backgroundPosition = 'center';
			avatarEl.style.borderRadius = '6px';
			this.authorContainer.appendChild(avatarEl);
		}

		const textWrap = document.createElement('div');
		textWrap.style.display = 'flex';
		textWrap.style.flexDirection = 'column';
		textWrap.style.lineHeight = '1.1';

		if (this.authorName) {
			const nameEl = document.createElement('div');
			nameEl.className = 'share-card-author-name';
			nameEl.textContent = this.authorName;
			nameEl.style.fontWeight = '600';
			textWrap.appendChild(nameEl);
		}
		if (this.authorRemark) {
			const remarkEl = document.createElement('div');
			remarkEl.className = 'share-card-author-remark';
			remarkEl.textContent = this.authorRemark;
			remarkEl.style.opacity = '0.8';
			remarkEl.style.fontSize = `${Math.max(10, this.authorFontSize - 2)}px`;
			textWrap.appendChild(remarkEl);
		}

		this.authorContainer.appendChild(textWrap);

		// Insert relative to playground content container if present
		if (this.playgroundContent) {
			if (this.authorPosition === 'top') {
				this.cardRoot.insertBefore(this.authorContainer, this.playgroundContent);
			} else {
				this.cardRoot.appendChild(this.authorContainer);
			}
		} else {
			// fallback previous behavior
			if (this.authorPosition === 'top') {
				this.cardRoot.insertBefore(this.authorContainer, this.cardRoot.firstChild);
			} else {
				this.cardRoot.appendChild(this.authorContainer);
			}
		}
	}

	private buildExportStyle(scale: number) {
		// Combine current translation (pan) with zoom * resolution scale
		return {
			transformOrigin: 'top left',
			transform: `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoomScale * scale})`,
		};
	}

	// 获取需要被完整导出的乐谱根节点（包含全部 SVG / 多页内容）
	private getCaptureElement(): HTMLElement | null {
		// 为了包含作者信息块，导出时始终以 cardRoot 作为捕获根节点（而不是仅内容区）
		// 等待渲染时仍然会在其内部查找具体的乐谱节点。
		if (!this.cardRoot) return null;
		return this.cardRoot;
	}

	private async generateImageBlob(resolution: number, fmt: string, mime: string): Promise<Blob> {
		const captureEl = this.getCaptureElement();
		if (!captureEl) throw new Error('未找到可导出的节点');
		// 新的等待逻辑：若 playground 有 AlphaTabApi 则等待其完整渲染
		try {
			const api = this.playgroundHandle?.getApi?.();
			if (api) {
				// 找到乐谱根节点（.alphatex-score 或 captureEl 内部）
				const scoreRoot = captureEl.querySelector('.alphatex-score') as HTMLElement | null;
				if (scoreRoot) {
					const result = await waitAlphaTabFullRender(api as any, scoreRoot, {
						debug: false,
						timeoutMs: 8000,
						stableFrames: 3,
					});
					if (!result.success) {
						console.warn('[ShareCardModal] 渲染等待未完全成功，使用回退: ', result);
					}
				}
			}
		} catch (e) {
			console.warn('[ShareCardModal] 完整渲染等待异常，继续回退导出', e);
		}
		// ---- 尺寸测量策略 ----
		// 问题根因：我们之前使用 getBoundingClientRect() 在 panWrapper 存在 transform(scale/translate) 时，
		// 返回的是“视觉缩放后”的尺寸（被 zoom 缩小则高度变小），导致传入 dom-to-image 的 width/height 过小 -> 底部被裁剪。
		// 解决：临时移除 panWrapper 的 transform，使用 scrollWidth/scrollHeight 获得未缩放原始尺寸。
		let width: number;
		let height: number;
		let restoreTransform: string | null = null;
		try {
			if (this.panWrapper && this.panWrapper.style.transform) {
				restoreTransform = this.panWrapper.style.transform;
				this.panWrapper.style.transform = 'none';
			}
			// 强制 reflow
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			captureEl.offsetHeight;
			const rawW = captureEl.scrollWidth || captureEl.clientWidth;
			const rawH = captureEl.scrollHeight || captureEl.clientHeight;
			width = Math.ceil(rawW * resolution);
			height = Math.ceil(rawH * resolution);
			if (!rawH) {
				// 退回到 rect 方案
				const rectFallback = captureEl.getBoundingClientRect();
				width = Math.ceil(rectFallback.width * resolution);
				height = Math.ceil(rectFallback.height * resolution);
			}
		} finally {
			if (restoreTransform !== null && this.panWrapper) {
				this.panWrapper.style.transform = restoreTransform;
			}
		}
		// 对非常大的尺寸做一个软上限提示（例如高度>30000 px）避免内存 OOM
		const SOFT_LIMIT = 30000;
		if (height > SOFT_LIMIT) {
			console.warn('[ShareCardModal] 导出高度过大，可能内存占用显著: ', height);
		}
		// 仅按分辨率缩放，忽略 pan/zoom（用户平移只是预览视图，不影响最终全图）
		// 背景颜色选择优先级：
		// - exportBgMode === 'default' : 兼容旧行为（仅为 jpeg 设置白底，png/webp 保持透明）
		// - exportBgMode === 'auto'    : 尝试读取 preview root 的计算背景色，若透明则回退到白色
		// - exportBgMode === 'custom'  : 使用用户输入的自定义颜色
		let bgcolorToUse: string | undefined = undefined;
		try {
			if (this.exportBgMode === 'custom') {
				bgcolorToUse = this.exportBgCustomColor || undefined;
			} else if (this.exportBgMode === 'auto') {
				const bgSource = (this.cardRoot || captureEl) as HTMLElement;
				if (bgSource) {
					const cs = getComputedStyle(bgSource);
					const computedBg = cs && cs.backgroundColor ? cs.backgroundColor : undefined;
					const isTransparent =
						!computedBg ||
						computedBg === 'transparent' ||
						/^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/i.test(computedBg || '');
					bgcolorToUse = isTransparent ? '#fff' : computedBg;
				}
			} else {
				// default: 保持向后兼容，仍然只为 jpeg 设置白底
				if (mime === 'image/jpeg') bgcolorToUse = '#fff';
			}
		} catch (e) {
			// 读取样式或正则出错则回退：若 jpeg 则白色，否则 undefined
			bgcolorToUse = mime === 'image/jpeg' ? '#fff' : undefined;
		}

		const options: any = {
			width,
			height,
			style: {
				transformOrigin: 'top left',
				transform: `scale(${resolution})`,
			},
			bgcolor: bgcolorToUse,
			quality: fmt === 'jpg' ? 0.92 : undefined,
			cacheBust: true,
		};
		const blob = await domtoimage.toBlob(captureEl, options);
		if (!blob) throw new Error('生成图片失败');
		return blob;
	}

	private setZoom(next: number, anchorX?: number, anchorY?: number) {
		const clamped = Math.min(this.maxZoom, Math.max(this.minZoom, next));
		if (!this.panWrapper || !this.cardRoot) {
			this.zoomScale = clamped;
			return;
		}
		if (clamped === this.zoomScale) return;
		// 缩放中心锚点：以指针位置为中心，调整 offset 以产生“围绕指针缩放”视觉效果
		const prevZoom = this.zoomScale;
		this.zoomScale = clamped;
		if (anchorX !== undefined && anchorY !== undefined) {
			// 转换坐标：我们希望 (anchorX, anchorY) 在缩放后位置不发生大的跳动
			// 原理： (anchor - offset) / prevZoom = 内容坐标 -> 新 offset = anchor - 内容坐标 * newZoom
			const contentX = anchorX - this.offsetX;
			const contentY = anchorY - this.offsetY;
			this.offsetX = anchorX - (contentX / prevZoom) * this.zoomScale;
			this.offsetY = anchorY - (contentY / prevZoom) * this.zoomScale;
		}
		this.applyPanTransform();
	}

	constructor(plugin: TabFlowPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.titleEl.setText('分享卡片');
		try {
			this.modalEl.addClass('share-card-wide');
			// Obsidian 可能将实际容器包一层 .modal-container
			const parent = this.modalEl.parentElement;
			if (parent && parent.classList.contains('modal-container'))
				parent.classList.add('share-card-wide');
		} catch {
			/* ignore */
		}

		const container = contentEl.createDiv({ cls: 'share-card-modal' });
		// 左侧配置，右侧预览
		const left = container.createDiv({ cls: 'share-card-left' });
		const right = container.createDiv({ cls: 'share-card-right' });

		// Form fields
		left.createEl('label', { text: '导出文件名' });
		const titleInput = left.createEl('input', { attr: { type: 'text' } }) as HTMLInputElement;
		titleInput.style.width = '100%';
		// 默认使用当前文件名（如有）
		const activeFile = this.app.workspace.getActiveFile();
		titleInput.value = activeFile ? activeFile.basename : 'alphatex-card';

		left.createEl('label', { text: '卡片宽度(px)' });
		const widthInput = left.createEl('input') as HTMLInputElement;
		widthInput.type = 'number';
		widthInput.value = '800';
		widthInput.style.width = '100%';

		left.createEl('label', { text: '分辨率' });
		const resSelect = left.createEl('select') as HTMLSelectElement;
		['1x', '2x', '3x'].forEach((r) => {
			const opt = resSelect.createEl('option', { text: r });
			opt.value = r;
		});
		resSelect.value = '2x';

		left.createEl('label', { text: '格式' });
		const formatSelect = left.createEl('select') as HTMLSelectElement;
		[
			['png', 'png'],
			['jpg', 'jpg'],
			['webp', 'webp'],
		].forEach(([t, v]) => {
			const opt = formatSelect.createEl('option', { text: String(t) });
			opt.value = String(v);
		});
		formatSelect.value = 'png';

		// 导出背景配置：与 modal 生命周期绑定（不会持久化到插件设置）
		left.createEl('label', { text: '导出背景' });
		const bgModeSelect = left.createEl('select') as HTMLSelectElement;
		[
			['默认（与之前一致）', 'default'],
			['自动（使用预览背景）', 'auto'],
			['自定义颜色', 'custom'],
		].forEach(([t, v]) => {
			const opt = bgModeSelect.createEl('option', { text: String(t) });
			opt.value = String(v);
		});
		bgModeSelect.value = 'default';

		// 当用户选择自定义颜色时显示输入框
		const customColorInput = left.createEl('input') as HTMLInputElement;
		customColorInput.type = 'text';
		customColorInput.value = this.exportBgCustomColor;
		customColorInput.placeholder = '#ffffff 或 rgb(...)';
		customColorInput.style.display = 'none';

		bgModeSelect.addEventListener('change', () => {
			this.exportBgMode = bgModeSelect.value as any;
			if (this.exportBgMode === 'custom') {
				customColorInput.style.display = '';
			} else {
				customColorInput.style.display = 'none';
			}
		});
		customColorInput.addEventListener('change', () => {
			if (customColorInput.value) this.exportBgCustomColor = customColorInput.value;
		});

		// 是否禁用懒加载（一次性完整渲染）
		const lazyWrap = left.createDiv({ cls: 'share-card-field-checkbox' });
		const disableLazyId = 'share-disable-lazy-' + Date.now();
		const lazyCb = lazyWrap.createEl('input', {
			attr: { type: 'checkbox', id: disableLazyId },
		}) as HTMLInputElement;
		const lazyLabel = lazyWrap.createEl('label', {
			text: '禁用懒加载(完整渲染)',
			attr: { for: disableLazyId },
		});
		lazyLabel.style.marginLeft = '4px';
		lazyCb.checked = false; // 默认不禁用，用户显式勾选

		// --- 作者信息相关（modal-local，不持久化） ---
		left.createEl('label', { text: '显示作者信息' });
		const authorShowCb = left.createEl('input', {
			attr: { type: 'checkbox' },
		}) as HTMLInputElement;
		authorShowCb.checked = this.showAuthor;
		authorShowCb.addEventListener('change', () => {
			this.showAuthor = authorShowCb.checked;
			this.renderAuthorBlock();
		});

		left.createEl('label', { text: '作者姓名' });
		const authorNameInput = left.createEl('input') as HTMLInputElement;
		authorNameInput.type = 'text';
		authorNameInput.value = this.authorName;
		authorNameInput.addEventListener('input', () => {
			this.authorName = authorNameInput.value;
			this.renderAuthorBlock();
		});

		left.createEl('label', { text: '作者备注' });
		const authorRemarkInput = left.createEl('input') as HTMLInputElement;
		authorRemarkInput.type = 'text';
		authorRemarkInput.value = this.authorRemark;
		authorRemarkInput.addEventListener('input', () => {
			this.authorRemark = authorRemarkInput.value;
			this.renderAuthorBlock();
		});

		left.createEl('label', { text: '显示头像' });
		const authorAvatarCb = left.createEl('input', {
			attr: { type: 'checkbox' },
		}) as HTMLInputElement;
		authorAvatarCb.checked = this.showAvatar;
		authorAvatarCb.addEventListener('change', () => {
			this.showAvatar = authorAvatarCb.checked;
			this.renderAuthorBlock();
		});

		left.createEl('label', { text: '头像（上传 / 选择 URL）' });
		const avatarInput = left.createEl('input') as HTMLInputElement;
		avatarInput.type = 'file';
		avatarInput.accept = 'image/*';
		avatarInput.addEventListener('change', async () => {
			const f = avatarInput.files?.[0];
			if (!f) return;
			const arr = await f.arrayBuffer();
			const blob = new Blob([arr], { type: f.type });
			const reader = new FileReader();
			reader.onload = () => {
				this.avatarDataUrl = String(reader.result);
				this.renderAuthorBlock();
			};
			reader.readAsDataURL(blob);
		});

		left.createEl('label', { text: '作者位置' });
		const authorPosSelect = left.createEl('select') as HTMLSelectElement;
		[
			['顶部', 'top'],
			['底部', 'bottom'],
		].forEach(([t, v]) => {
			const opt = authorPosSelect.createEl('option', { text: String(t) });
			opt.value = String(v);
		});
		authorPosSelect.value = this.authorPosition;
		authorPosSelect.addEventListener('change', () => {
			this.authorPosition = authorPosSelect.value as any;
			this.renderAuthorBlock();
		});

		left.createEl('label', { text: '作者背景色' });
		const authorBgInput = left.createEl('input') as HTMLInputElement;
		authorBgInput.type = 'color';
		authorBgInput.value = this.authorBg || '#ffffff';
		authorBgInput.addEventListener('change', () => {
			this.authorBg = authorBgInput.value;
			this.renderAuthorBlock();
		});

		left.createEl('label', { text: '作者文字色' });
		const authorColorInput = left.createEl('input') as HTMLInputElement;
		authorColorInput.type = 'color';
		authorColorInput.value = this.authorTextColor || '#000000';
		authorColorInput.addEventListener('change', () => {
			this.authorTextColor = authorColorInput.value;
			this.renderAuthorBlock();
		});

		left.createEl('label', { text: '作者字号 (px)' });
		const authorFontInput = left.createEl('input') as HTMLInputElement;
		authorFontInput.type = 'number';
		authorFontInput.value = String(this.authorFontSize);
		authorFontInput.addEventListener('change', () => {
			this.authorFontSize = Number(authorFontInput.value) || 13;
			this.renderAuthorBlock();
		});

		// Buttons
		const btnRow = left.createDiv({ cls: 'share-card-actions' });
		const copyBtn = btnRow.createEl('button', { text: '复制' });
		const exportBtn = btnRow.createEl('button', { text: '导出' });
		const closeBtn = btnRow.createEl('button', { text: '关闭' });

		// Preview area (add a pan wrapper so we can translate content)
		const previewWrap = right.createDiv({ cls: 'share-card-preview' });
		this.panWrapper = previewWrap.createDiv({ cls: 'share-card-pan-wrapper' });
		this.cardRoot = this.panWrapper.createDiv({ cls: 'share-card-root' });
		this.cardRoot.style.width = widthInput.value + 'px';
		// inner content container for playground rendering (so we can keep author block separate)
		this.playgroundContent = this.cardRoot.createDiv({ cls: 'share-card-content' });
		this.applyPanTransform();

		// 点击模态框外部关闭（增加一致的心智模型）
		this.outsidePointerDownHandler = (e: PointerEvent) => {
			try {
				// 如果点击目标不在 modalElement 内容内，则关闭 modal
				const target = e.target as Node | null;
				if (!target) return;
				if (!this.modalEl.contains(target)) {
					this.close();
				}
			} catch (err) {
				// 忽略任何异常
			}
		};
		// 绑定到 document 以捕获 modal 外的点击
		document.addEventListener('pointerdown', this.outsidePointerDownHandler);

		// Pan interaction
		previewWrap.addEventListener('pointerdown', (e) => {
			if (!this.panWrapper) return;
			this.isPanning = true;
			this.panStartX = e.clientX;
			this.panStartY = e.clientY;
			this.originOffsetX = this.offsetX;
			this.originOffsetY = this.offsetY;
			previewWrap.classList.add('panning');
			previewWrap.setPointerCapture(e.pointerId);
		});
		previewWrap.addEventListener('pointermove', (e) => {
			if (!this.isPanning) return;
			const dx = e.clientX - this.panStartX;
			const dy = e.clientY - this.panStartY;
			this.offsetX = this.originOffsetX + dx;
			this.offsetY = this.originOffsetY + dy;
			this.applyPanTransform();
		});
		const endPan = (e: PointerEvent) => {
			if (!this.isPanning) return;
			this.isPanning = false;
			previewWrap.classList.remove('panning');
			try {
				previewWrap.releasePointerCapture(e.pointerId);
			} catch (_) {
				/* ignore */
			}
		};
		previewWrap.addEventListener('pointerup', endPan);
		previewWrap.addEventListener('pointerleave', endPan);

		// Wheel zoom: Ctrl+wheel 或 Alt+wheel 触发缩放
		previewWrap.addEventListener(
			'wheel',
			(e) => {
				if (!(e.ctrlKey || e.altKey)) return; // 需要组合键避免与滚动冲突
				e.preventDefault();
				const delta = e.deltaY;
				const factor = delta > 0 ? -this.zoomStep : this.zoomStep;
				const rect = previewWrap.getBoundingClientRect();
				const ax = e.clientX - rect.left;
				const ay = e.clientY - rect.top;
				this.setZoom(this.zoomScale + factor, ax, ay);
			},
			{ passive: false }
		);

		// 双击重置 (位置 + 缩放)
		previewWrap.addEventListener('dblclick', () => {
			this.offsetX = 0;
			this.offsetY = 0;
			this.zoomScale = 1;
			this.applyPanTransform();
		});

		// 提示文本（可选）
		right.createDiv({ cls: 'share-card-hint', text: '拖动移动，Ctrl/Alt+滚轮缩放，双击重置' });

		// load source content (prefer active MD editor view content)
		let source = '';
		try {
			const mv = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (mv && mv.editor) {
				source = mv.editor.getValue();
			} else if (activeFile) {
				source = await this.app.vault.cachedRead(activeFile);
			}
		} catch (e) {
			console.warn('[ShareCardModal] 读取内容失败', e);
		}

		// create playground inside cardRoot
		const buildPlayground = () => {
			try {
				this.playgroundHandle?.destroy();
			} catch {
				/* ignore */
			}
			try {
				this.playgroundHandle = createAlphaTexPlayground(
					this.plugin,
					this.playgroundContent!,
					source,
					{
						readOnly: true,
						showEditor: false,
						layout: 'vertical',
						className: 'share-card-playground',
						// @ts-ignore 透传给 mountAlphaTexBlock 的 init：关闭播放器
						player: 'disable',
						// 自定义附加 alphaTabOptions：根据勾选决定是否禁用懒加载
						alphaTabOptions: {
							// alphaTab Settings.core 不一定暴露 enableLazyLoading，这里作为扩展字段传给我们的实现
							// 约定：在 mountAlphaTexBlock 内读取并应用
							// @ts-ignore
							__disableLazyLoading: lazyCb.checked,
						},
					}
				);
			} catch (e) {
				console.error('[ShareCardModal] 创建 playground 失败', e);
				this.cardRoot!.createEl('div', { text: '预览创建失败' });
			}
			// ensure author block is rendered after playground rebuild
			this.renderAuthorBlock();
		};

		try {
			buildPlayground();
		} catch (e) {
			console.error('[ShareCardModal] 创建 playground 失败', e);
			this.cardRoot.createEl('div', { text: '预览创建失败' });
		}

		// 切换懒加载选项 -> 重新构建 playground
		lazyCb.addEventListener('change', () => buildPlayground());

		// Update preview width when width input changes
		widthInput.addEventListener('change', () => {
			const w = Number(widthInput.value) || 800;
			if (this.cardRoot) this.cardRoot.style.width = w + 'px';
			// try to refresh playground rendering
			try {
				this.playgroundHandle?.refresh();
			} catch (err) {
				console.warn('[ShareCardModal] 刷新 preview 失败', err);
			}
			// re-render author block to adapt to new width
			this.renderAuthorBlock();
		});

		// Export handler (捕获完整 .inmarkdown-preview 内容)
		exportBtn.addEventListener('click', async () => {
			await withExportLock(async () => {
				exportBtn.setAttribute('disabled', 'true');
				copyBtn.setAttribute('disabled', 'true');
				const title = titleInput.value || 'alphatex-card';
				const resolution = Number(resSelect.value.replace('x', '')) || 1;
				const fmt = formatSelect.value as string;
				const mime =
					fmt === 'png' ? 'image/png' : fmt === 'jpg' ? 'image/jpeg' : 'image/webp';
				try {
					const blob = await this.generateImageBlob(resolution, fmt, mime);
					if (Platform.isMobile) {
						const filename = `${title.replace(/\s+/g, '_')}.${fmt}`;
						const filePath =
							await this.app.fileManager.getAvailablePathForAttachment(filename);
						await this.app.vault.createBinary(filePath, await blob.arrayBuffer());
						new Notice(`已保存到 ${filePath}`);
					} else {
						const url = URL.createObjectURL(blob);
						const a = document.createElement('a');
						a.href = url;
						a.download = `${title.replace(/\s+/g, '_')}.${fmt}`;
						document.body.appendChild(a);
						a.click();
						a.remove();
						URL.revokeObjectURL(url);
					}
				} catch (e) {
					console.error('[ShareCardModal] 导出失败', e);
					new Notice('导出失败');
				} finally {
					exportBtn.removeAttribute('disabled');
					copyBtn.removeAttribute('disabled');
				}
			});
		});

		// Copy handler
		copyBtn.addEventListener('click', async () => {
			await withExportLock(async () => {
				exportBtn.setAttribute('disabled', 'true');
				copyBtn.setAttribute('disabled', 'true');
				const resolution = Number(resSelect.value.replace('x', '')) || 1;
				const fmt = formatSelect.value as string;
				const mime =
					fmt === 'png' ? 'image/png' : fmt === 'jpg' ? 'image/jpeg' : 'image/webp';
				try {
					const blob = await this.generateImageBlob(resolution, fmt, mime);
					// @ts-ignore
					if (navigator.clipboard && (navigator.clipboard as any).write) {
						const item = new ClipboardItem({ [blob.type]: blob });
						// @ts-ignore
						await navigator.clipboard.write([item]);
						new Notice('已复制到剪贴板');
					} else {
						new Notice('复制到剪贴板不被支持');
					}
				} catch (e) {
					console.error('[ShareCardModal] 复制失败', e);
					new Notice('复制失败');
				} finally {
					exportBtn.removeAttribute('disabled');
					copyBtn.removeAttribute('disabled');
				}
			});
		});

		closeBtn.addEventListener('click', () => this.close());
	}

	onClose() {
		try {
			this.playgroundHandle?.destroy();
		} catch (e) {
			// ignore
		}

		// 移除外部点击关闭的监听
		try {
			if (this.outsidePointerDownHandler) {
				document.removeEventListener('pointerdown', this.outsidePointerDownHandler);
				this.outsidePointerDownHandler = null;
			}
		} catch (e) {
			// ignore
		}
		this.playgroundHandle = null;
		this.cardRoot = null;
		this.contentEl.empty();
	}
}

export default ShareCardModal;
