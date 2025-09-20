import { Modal, Notice, Platform, MarkdownView } from 'obsidian';
import type TabFlowPlugin from '../main';
import { t } from '../i18n';
import { createAlphaTexPlayground, AlphaTexPlaygroundHandle } from './AlphaTexPlayground';
import * as domtoimage from 'dom-to-image-more';
import { waitAlphaTabFullRender, withExportLock } from '../utils/alphaTabRenderWait';
import {
	normalizeColorToHex,
	computeExportBgColor,
	measureCaptureDimensions,
} from '../utils/shareCardUtils';
import ShareCardPresetService from '../services/ShareCardPresetService';
import ShareCardStateManager from '../state/ShareCardStateManager';
import { createShareCardPreview } from './ShareCardPreview';

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
	private authorAlign: 'left' | 'center' | 'right' = 'left';
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

	// 预设相关运行期字段（不持久化）
	private presetService: ShareCardPresetService | null = null;
	private currentPresetId: string | null = null; // 当前下拉选中
	private isPresetDirty = false;
	private stateManager: ShareCardStateManager | null = null;
	// 用于服务收集的当前 UI 状态缓存
	public __shareCardCurrentResolution: '1x' | '2x' | '3x' = '2x';
	public __shareCardCurrentFormat: 'png' | 'jpg' | 'webp' = 'png';
	public __shareCardDisableLazy = false;

	// 供服务调用：应用尺寸宽度
	public __applyShareCardDimension = (w: number) => {
		if (this.cardRoot) {
			this.cardRoot.style.width = w + 'px';
			try {
				this.playgroundHandle?.refresh();
			} catch {
				/* ignore */
			}
			this.renderAuthorBlock();
		}
	};
	// 供服务调用：应用格式/分辨率/懒加载
	public __applyShareCardFormat = (
		fmt: 'png' | 'jpg' | 'webp',
		res: '1x' | '2x' | '3x',
		disableLazy: boolean
	) => {
		this.__shareCardCurrentFormat = fmt;
		this.__shareCardCurrentResolution = res;
		this.__shareCardDisableLazy = disableLazy;
		// 这里只更新内部字段，实际控件会在下拉选择后手动同步
	};

	// handler reference so we can remove listener on close
	private outsidePointerDownHandler: ((e: PointerEvent) => void) | null = null;

	private applyPanTransform() {
		if (this.panWrapper) {
			this.panWrapper.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoomScale})`;
		}
	}

	/**
	 * Try to normalize any CSS color string to a 6-digit hex like #rrggbb.
	 * Falls back to provided default (#ffffff) when unable to parse.
	 */
	// normalizeColorToHex extracted to utils/shareCardUtils.ts

	// Render or update the author info block inside cardRoot according to modal-local fields
	private renderAuthorBlock() {
		if (!this.cardRoot) return;
		// 尝试容错：若应显示头像但本地缓存为空且 stateManager 中仍有 avatarSource，则回填
		if (this.showAvatar && !this.avatarDataUrl) {
			try {
				const st = this.stateManager?.getState();
				const maybe = st?.working.avatarSource?.data;
				if (maybe) this.avatarDataUrl = maybe;
			} catch {
				/* ignore */
			}
		}
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
		// alignment
		if (this.authorAlign === 'center') {
			this.authorContainer.style.justifyContent = 'center';
		} else if (this.authorAlign === 'right') {
			this.authorContainer.style.justifyContent = 'flex-end';
		} else {
			this.authorContainer.style.justifyContent = 'flex-start';
		}

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

	// buildExportStyle extracted to utils/shareCardUtils.ts

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
		const dims = measureCaptureDimensions(captureEl, this.panWrapper, resolution);
		const width = dims.width;
		const height = dims.height;
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
		const bgcolorToUse = computeExportBgColor(
			this.exportBgMode,
			this.exportBgCustomColor,
			this.cardRoot,
			captureEl,
			mime
		);

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
		this.titleEl.setText(t('shareCard.title'));
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
		// --- 预设选择区域 ---
		this.presetService = new ShareCardPresetService(this.plugin);
		this.stateManager = new ShareCardStateManager(this.plugin, this.presetService);
		const runtime = this.stateManager.init();
		this.currentPresetId = runtime.activePresetId;
		const presetBar = left.createDiv({ cls: 'share-card-preset-bar' });
		const presetLabel = presetBar.createEl('label', { text: t('shareCard.preset') });
		presetLabel.style.display = 'block';
		const presetSelect = presetBar.createEl('select') as HTMLSelectElement;
		presetSelect.style.width = '100%';
		const presetActionRow = left.createDiv({ cls: 'share-card-preset-actions' });
		const btnPresetSave = presetActionRow.createEl('button', {
			text: t('shareCard.presetSave'),
		});
		const btnPresetSaveAs = presetActionRow.createEl('button', {
			text: t('shareCard.presetSaveAs'),
		});
		const btnPresetSetDefault = presetActionRow.createEl('button', {
			text: t('shareCard.presetSetDefault'),
		});
		const btnPresetReset = presetActionRow.createEl('button', {
			text: t('shareCard.presetReset'),
		});

		const rebuildPresetOptions = () => {
			presetSelect.empty();
			const presets = this.presetService!.list();
			presets.forEach((p) => {
				const opt = presetSelect.createEl('option', {
					text:
						p.name +
						(p.id === this.plugin.settings.shareCardDefaultPresetId ? ' (默认)' : '') +
						(this.stateManager?.getState().activePresetId === p.id &&
						this.stateManager?.isDirty()
							? ' *'
							: ''),
				});
				opt.value = p.id;
			});
			// 选中：优先 lastUsed -> default -> 第一个
			let toSelect =
				this.plugin.settings.shareCardLastUsedPresetId ||
				this.plugin.settings.shareCardDefaultPresetId ||
				presets[0]?.id;
			if (this.currentPresetId) toSelect = this.currentPresetId; // 若已经有选中保持
			if (toSelect) {
				presetSelect.value = toSelect;
				this.currentPresetId = toSelect;
			}
		};

		rebuildPresetOptions();

		presetSelect.addEventListener('change', () => {
			const targetId = presetSelect.value;
			const st = this.stateManager?.getState();
			if (st?.dirty && !st.autosaveEnabled) {
				// 三选弹窗：保存/放弃/取消
				const choice = window.confirm(t('shareCard.confirmPresetDirty'));
				if (!choice) {
					// 二次确认：放弃或取消
					const discard = window.confirm(t('shareCard.confirmPresetDiscard'));
					if (!discard) {
						// 取消切换，恢复下拉值
						presetSelect.value = this.currentPresetId || targetId;
						return;
					}
					// 放弃 -> 不保存直接切换
				} else {
					// 保存并切换
					this.stateManager?.commit('switch');
				}
			}
			this.currentPresetId = targetId;
			this.stateManager?.switchPreset(this.currentPresetId);
			const st2 = this.stateManager?.getState();
			if (st2) {
				widthInput.value = String(st2.working.cardWidth);
				resSelect.value = st2.working.resolution;
				formatSelect.value = st2.working.format;
				bgModeSelect.value = st2.working.exportBgMode;
				if (st2.working.exportBgMode === 'auto') {
					customColorLabel.textContent = t('shareCard.fallbackColor') || 'Fallback Color';
					customColorLabel.style.display = '';
					customColorInput.style.display = '';
				} else if (st2.working.exportBgMode === 'custom') {
					customColorLabel.textContent = t('shareCard.customColor');
					customColorLabel.style.display = '';
					customColorInput.style.display = '';
				} else {
					customColorLabel.style.display = 'none';
					customColorInput.style.display = 'none';
				}
				const norm = normalizeColorToHex(st2.working.exportBgCustomColor);
				customColorInput.value = norm;
				authorShowCb.checked = st2.working.showAuthor;
				authorNameInput.value = st2.working.authorName;
				authorRemarkInput.value = st2.working.authorRemark;
				authorAvatarCb.checked = st2.working.showAvatar;
				authorPosSelect.value = st2.working.authorPosition;
				authorBgInput.value = st2.working.authorBg || '#ffffff';
				authorColorInput.value = st2.working.authorTextColor || '#000000';
				authorFontInput.value = String(st2.working.authorFontSize);
				authorAlignSelect.value = st2.working.authorAlign || 'left';
				lazyCb.checked = st2.working.disableLazy;
				this.exportBgMode = st2.working.exportBgMode;
				this.exportBgCustomColor = norm;
				this.showAuthor = st2.working.showAuthor;
				this.authorName = st2.working.authorName;
				this.authorRemark = st2.working.authorRemark;
				this.showAvatar = st2.working.showAvatar;
				this.avatarDataUrl = st2.working.avatarSource?.data || null;
				this.authorPosition = st2.working.authorPosition;
				this.authorBg = st2.working.authorBg;
				this.authorTextColor = st2.working.authorTextColor;
				this.authorFontSize = st2.working.authorFontSize;
				this.authorAlign = st2.working.authorAlign;
				this.__shareCardDisableLazy = st2.working.disableLazy;
				if (this.cardRoot) this.cardRoot.style.width = st2.working.cardWidth + 'px';
				this.renderAuthorBlock();
			}
			refreshDirtyIndicator();
		});

		btnPresetSave.addEventListener('click', async () => {
			this.stateManager?.commit('manual');
			rebuildPresetOptions();
			new Notice(t('shareCard.notice.presetSaved'));
		});

		btnPresetSaveAs.addEventListener('click', async () => {
			const name = window.prompt(
				t('shareCard.prompt.newPresetName'),
				t('shareCard.prompt.newPresetDefault')
			);
			if (!name) return;
			// 收集当前 working 值
			const st = this.stateManager?.getState();
			if (!st) return;
			const created = this.presetService!.create({
				name,
				cardWidth: st.working.cardWidth,
				resolution: st.working.resolution,
				format: st.working.format,
				disableLazy: st.working.disableLazy,
				exportBgMode: st.working.exportBgMode,
				exportBgCustomColor: normalizeColorToHex(st.working.exportBgCustomColor),
				showAuthor: st.working.showAuthor,
				authorName: st.working.authorName,
				authorRemark: st.working.authorRemark,
				showAvatar: st.working.showAvatar,
				avatarSource: st.working.avatarSource,
				authorPosition: st.working.authorPosition,
				authorBg: st.working.authorBg,
				authorTextColor: st.working.authorTextColor,
				authorFontSize: st.working.authorFontSize,
				authorAlign: st.working.authorAlign,
				isDefault: undefined,
			});
			await this.plugin.saveSettings();
			this.stateManager?.switchPreset(created.id);
			rebuildPresetOptions();
			presetSelect.value = created.id;
			this.currentPresetId = created.id;
			new Notice(t('shareCard.notice.presetCreated'));
		});

		btnPresetSetDefault.addEventListener('click', async () => {
			if (!this.currentPresetId) return;
			this.presetService!.setDefault(this.currentPresetId);
			await this.plugin.saveSettings();
			rebuildPresetOptions();
			new Notice(t('shareCard.notice.presetSetDefault'));
		});

		btnPresetReset.addEventListener('click', () => {
			this.stateManager?.resetWorking();
			const st = this.stateManager?.getState();
			if (st) {
				widthInput.value = String(st.working.cardWidth);
				resSelect.value = st.working.resolution;
				formatSelect.value = st.working.format;
				bgModeSelect.value = st.working.exportBgMode;
				if (st.working.exportBgMode === 'auto') {
					customColorLabel.textContent = t('shareCard.fallbackColor') || 'Fallback Color';
					customColorLabel.style.display = '';
					customColorInput.style.display = '';
				} else if (st.working.exportBgMode === 'custom') {
					customColorLabel.textContent = t('shareCard.customColor');
					customColorLabel.style.display = '';
					customColorInput.style.display = '';
				} else {
					customColorLabel.style.display = 'none';
					customColorInput.style.display = 'none';
				}
				customColorInput.value = normalizeColorToHex(st.working.exportBgCustomColor);
				authorShowCb.checked = st.working.showAuthor;
				authorNameInput.value = st.working.authorName;
				authorRemarkInput.value = st.working.authorRemark;
				authorAvatarCb.checked = st.working.showAvatar;
				authorPosSelect.value = st.working.authorPosition;
				authorBgInput.value = st.working.authorBg || '#ffffff';
				authorColorInput.value = st.working.authorTextColor || '#000000';
				authorFontInput.value = String(st.working.authorFontSize);
				authorAlignSelect.value = st.working.authorAlign || 'left';
				lazyCb.checked = st.working.disableLazy;
				if (this.cardRoot) this.cardRoot.style.width = st.working.cardWidth + 'px';
				this.showAuthor = st.working.showAuthor;
				this.authorName = st.working.authorName;
				this.authorRemark = st.working.authorRemark;
				this.showAvatar = st.working.showAvatar;
				this.avatarDataUrl = st.working.avatarSource?.data || null;
				this.authorPosition = st.working.authorPosition;
				this.authorBg = st.working.authorBg;
				this.authorTextColor = st.working.authorTextColor;
				this.authorFontSize = st.working.authorFontSize;
				this.authorAlign = st.working.authorAlign;
				this.renderAuthorBlock();
			}
			rebuildPresetOptions();
		});

		left.createEl('label', { text: t('shareCard.fileName') });
		const titleInput = left.createEl('input', { attr: { type: 'text' } }) as HTMLInputElement;
		titleInput.style.width = '100%';
		// 默认使用当前文件名（如有）
		const activeFile = this.app.workspace.getActiveFile();
		titleInput.value = activeFile ? activeFile.basename : 'alphatex-card';

		// 基础配置卡片（抽离为组件）
		// initial 和 callbacks 传入方便把 stateManager wiring 封装在此处
		// createBasicControls 返回一组控件引用
		const basic = (await import('./ShareCardBasicControls')).createBasicControls(
			left,
			{
				t,
				cardWidth: runtime.working.cardWidth,
				resolution: runtime.working.resolution,
				format: runtime.working.format,
				exportBgMode: runtime.working.exportBgMode,
				exportBgCustomColor: runtime.working.exportBgCustomColor,
				disableLazy: runtime.working.disableLazy,
			},
			{
				onWidthChange: (w: number) => {
					this.stateManager?.updateField('cardWidth', w);
					if (this.cardRoot) this.cardRoot.style.width = w + 'px';
					try {
						this.playgroundHandle?.refresh();
					} catch (e) {
						/* ignore refresh errors */
					}
					this.renderAuthorBlock();
					refreshDirtyIndicator();
				},
				onResolutionChange: (r: string) => {
					this.stateManager?.updateField('resolution', r as any);
					refreshDirtyIndicator();
				},
				onFormatChange: (f: string) => {
					this.stateManager?.updateField('format', f as any);
					refreshDirtyIndicator();
				},
				onExportBgModeChange: (m: string) => {
					this.exportBgMode = m as any;
					this.stateManager?.updateField('exportBgMode', this.exportBgMode);
					const st = this.stateManager?.getState();
					if (st) st.working.exportBgMode = this.exportBgMode;
					refreshDirtyIndicator();
				},
				onCustomColorChange: (hex: string) => {
					const h = normalizeColorToHex(hex);
					this.exportBgCustomColor = h;
					this.stateManager?.updateField('exportBgCustomColor', h);
					refreshDirtyIndicator();
				},
				onLazyChange: (v: boolean) => {
					this.stateManager?.updateField('disableLazy', v);
					this.__shareCardDisableLazy = v;
					refreshDirtyIndicator();
				},
			}
		);
		const widthInput = basic.widthInput;
		const resSelect = basic.resSelect;
		const formatSelect = basic.formatSelect;
		const bgModeSelect = basic.bgModeSelect;
		const customColorLabel = basic.customColorLabel;
		const customColorInput = basic.customColorInput;
		const lazyCb = basic.lazyCb;

		// 作者信息部分（抽离）
		const author = (await import('./ShareCardAuthorBlock')).createAuthorBlock(
			left,
			{
				t,
				showAuthor: runtime.working.showAuthor,
				authorName: runtime.working.authorName,
				authorRemark: runtime.working.authorRemark,
				showAvatar: runtime.working.showAvatar,
				authorAlign: runtime.working.authorAlign,
				authorPosition: runtime.working.authorPosition,
				authorBg: runtime.working.authorBg,
				authorTextColor: runtime.working.authorTextColor,
				authorFontSize: runtime.working.authorFontSize,
			},
			{
				onShowAuthor: (v: boolean) => {
					this.showAuthor = v;
					this.stateManager?.updateField('showAuthor', v);
					this.renderAuthorBlock();
					refreshDirtyIndicator();
				},
				onAuthorName: (v: string) => {
					this.authorName = v;
					this.stateManager?.updateField('authorName', v);
					this.renderAuthorBlock();
					refreshDirtyIndicator();
				},
				onAuthorRemark: (v: string) => {
					this.authorRemark = v;
					this.stateManager?.updateField('authorRemark', v);
					this.renderAuthorBlock();
					refreshDirtyIndicator();
				},
				onShowAvatar: (v: boolean) => {
					this.showAvatar = v;
					this.stateManager?.updateField('showAvatar', v);
					this.renderAuthorBlock();
					refreshDirtyIndicator();
				},
				onAvatarChange: (dataUrl: string) => {
					this.avatarDataUrl = dataUrl;
					this.stateManager?.updateField('avatarSource', {
						type: 'data-url',
						data: dataUrl,
					});
					this.renderAuthorBlock();
					refreshDirtyIndicator();
				},
				onAuthorAlign: (v: string) => {
					this.authorAlign = v as any;
					this.stateManager?.updateField('authorAlign', v as any);
					this.renderAuthorBlock();
					refreshDirtyIndicator();
				},
				onAuthorPosition: (v: string) => {
					this.authorPosition = v as any;
					this.stateManager?.updateField('authorPosition', v as any);
					this.renderAuthorBlock();
					refreshDirtyIndicator();
				},
				onAuthorBg: (v: string) => {
					this.authorBg = v;
					this.stateManager?.updateField('authorBg', v);
					this.renderAuthorBlock();
					refreshDirtyIndicator();
				},
				onAuthorColor: (v: string) => {
					this.authorTextColor = v;
					this.stateManager?.updateField('authorTextColor', v);
					this.renderAuthorBlock();
					refreshDirtyIndicator();
				},
				onAuthorFontSize: (v: number) => {
					this.authorFontSize = v;
					this.stateManager?.updateField('authorFontSize', v);
					this.renderAuthorBlock();
					refreshDirtyIndicator();
				},
			}
		);
		const authorShowCb = author.authorShowCb;
		const authorNameInput = author.authorNameInput;
		const authorRemarkInput = author.authorRemarkInput;
		const authorAvatarCb = author.authorAvatarCb;
		// avatarInput provided by author component but not used here
		const authorAlignSelect = author.authorAlignSelect;
		const authorPosSelect = author.authorPosSelect;
		const authorBgInput = author.authorBgInput;
		const authorColorInput = author.authorColorInput;
		const authorFontInput = author.authorFontInput;

		// Buttons
		const btnRow = left.createDiv({ cls: 'share-card-actions' });
		const copyBtn = btnRow.createEl('button', { text: t('shareCard.copy') });
		const exportBtn = btnRow.createEl('button', { text: t('shareCard.export') });
		const closeBtn = btnRow.createEl('button', { text: t('shareCard.close') });

		// Preview area (create via helper to keep modal file smaller)
		const preview = createShareCardPreview(right, widthInput.value);
		const previewWrap = preview.previewWrap;
		this.panWrapper = preview.panWrapper as HTMLElement;
		this.cardRoot = preview.cardRoot as HTMLElement;
		// inner content container for playground rendering (so we can keep author block separate)
		this.playgroundContent = preview.playgroundContent as HTMLElement;
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
		previewWrap.addEventListener('pointerdown', (e: PointerEvent) => {
			if (!this.panWrapper) return;
			this.isPanning = true;
			this.panStartX = e.clientX;
			this.panStartY = e.clientY;
			this.originOffsetX = this.offsetX;
			this.originOffsetY = this.offsetY;
			previewWrap.classList.add('panning');
			previewWrap.setPointerCapture(e.pointerId);
		});
		previewWrap.addEventListener('pointermove', (e: PointerEvent) => {
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
			(e: WheelEvent) => {
				// Always treat wheel as zoom inside the preview (prevent page scroll)
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
		right.createDiv({ cls: 'share-card-hint', text: t('shareCard.hint') });

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
				this.cardRoot!.createEl('div', { text: t('shareCard.previewCreateFailed') });
			}
			// ensure author block is rendered after playground rebuild
			this.renderAuthorBlock();
		};

		try {
			buildPlayground();
		} catch (e) {
			console.error('[ShareCardModal] 创建 playground 失败', e);
			this.cardRoot.createEl('div', { text: t('shareCard.previewCreateFailed') });
		}

		// 切换懒加载选项 -> 重新构建 playground
		lazyCb.addEventListener('change', () => {
			this.stateManager?.updateField('disableLazy', lazyCb.checked);
			this.__shareCardDisableLazy = lazyCb.checked;
			buildPlayground();
			refreshDirtyIndicator();
		});

		// Update preview width when width input changes
		widthInput.addEventListener('change', () => {
			const w = Number(widthInput.value) || 800;
			if (this.cardRoot) this.cardRoot.style.width = w + 'px';
			this.stateManager?.updateField('cardWidth', w);
			try {
				this.playgroundHandle?.refresh();
			} catch {
				/* ignore */
			}
			this.renderAuthorBlock();
			refreshDirtyIndicator();
		});

		// Export handler (捕获完整 .inmarkdown-preview 内容)
		exportBtn.addEventListener('click', async () => {
			// 导出前强制保存当前工作副本
			try {
				this.stateManager?.commit('manual');
			} catch {
				/* ignore */
			}
			await withExportLock(async () => {
				exportBtn.setAttribute('disabled', 'true');
				copyBtn.setAttribute('disabled', 'true');
				const title = titleInput.value || 'alphatex-card';
				const st = this.stateManager?.getState();
				const working = st?.working;
				const resolution = working ? Number(working.resolution.replace('x', '')) : 1;
				const fmt = working ? working.format : (formatSelect.value as string);
				const mime =
					fmt === 'png' ? 'image/png' : fmt === 'jpg' ? 'image/jpeg' : 'image/webp';
				try {
					const blob = await this.generateImageBlob(resolution, fmt, mime);
					if (Platform.isMobile) {
						const filename = `${title.replace(/\s+/g, '_')}.${fmt}`;
						const filePath =
							await this.app.fileManager.getAvailablePathForAttachment(filename);
						await this.app.vault.createBinary(filePath, await blob.arrayBuffer());
						new Notice(t('shareCard.notice.savedTo', { path: filePath }));
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
					new Notice(t('shareCard.notice.exportFailed'));
				} finally {
					exportBtn.removeAttribute('disabled');
					copyBtn.removeAttribute('disabled');
				}
			});
		});

		// Copy handler
		copyBtn.addEventListener('click', async () => {
			// 复制前强制保存当前工作副本
			try {
				this.stateManager?.commit('manual');
			} catch {
				/* ignore */
			}
			await withExportLock(async () => {
				exportBtn.setAttribute('disabled', 'true');
				copyBtn.setAttribute('disabled', 'true');
				const st = this.stateManager?.getState();
				const working = st?.working;
				const resolution = working ? Number(working.resolution.replace('x', '')) : 1;
				const fmt = working ? working.format : (formatSelect.value as string);
				const mime =
					fmt === 'png' ? 'image/png' : fmt === 'jpg' ? 'image/jpeg' : 'image/webp';
				try {
					const blob = await this.generateImageBlob(resolution, fmt, mime);
					// @ts-ignore
					if (navigator.clipboard && (navigator.clipboard as any).write) {
						const item = new ClipboardItem({ [blob.type]: blob });
						// @ts-ignore
						await navigator.clipboard.write([item]);
						new Notice(t('shareCard.notice.copiedToClipboard'));
					} else {
						new Notice(t('shareCard.notice.clipboardNotSupported'));
					}
				} catch (e) {
					console.error('[ShareCardModal] 复制失败', e);
					new Notice(t('shareCard.notice.copyFailed'));
				} finally {
					exportBtn.removeAttribute('disabled');
					copyBtn.removeAttribute('disabled');
				}
			});
		});

		// 脏标记刷新助手，仅更新当前选中项的 * 状态
		const refreshDirtyIndicator = () => {
			try {
				const st = this.stateManager?.getState();
				if (!st) return;
				const defaultId = this.plugin.settings.shareCardDefaultPresetId;
				for (const opt of Array.from(presetSelect.options)) {
					const p = this.presetService?.get(opt.value);
					if (!p) continue;
					const isActive = st.activePresetId === p.id;
					const isDirty = isActive && st.dirty;
					opt.text =
						p.name + (p.id === defaultId ? ' (默认)' : '') + (isDirty ? ' *' : '');
				}
			} catch {
				/* ignore */
			}
		};

		closeBtn.addEventListener('click', () => this.close());

		// 初始化 UI 值（用 working 而不是默认写死）
		widthInput.value = String(runtime.working.cardWidth);
		resSelect.value = runtime.working.resolution;
		formatSelect.value = runtime.working.format;
		bgModeSelect.value = runtime.working.exportBgMode;
		if (runtime.working.exportBgMode === 'custom') {
			customColorLabel.textContent = t('shareCard.customColor');
			customColorLabel.style.display = '';
			customColorInput.style.display = '';
		} else {
			customColorLabel.style.display = 'none';
			customColorInput.style.display = 'none';
		}
		const initHex = normalizeColorToHex(runtime.working.exportBgCustomColor);
		customColorInput.value = initHex;
		this.exportBgMode = runtime.working.exportBgMode;
		this.exportBgCustomColor = initHex;
		this.showAuthor = runtime.working.showAuthor;
		this.authorName = runtime.working.authorName;
		this.authorRemark = runtime.working.authorRemark;
		this.showAvatar = runtime.working.showAvatar;
		this.avatarDataUrl = runtime.working.avatarSource?.data || null;
		// 再次兜底：如果 showAvatar 且 working 有 data 但 avatarDataUrl 仍为空（理论上不会出现），回填
		if (this.showAvatar && !this.avatarDataUrl) {
			try {
				this.avatarDataUrl =
					this.stateManager?.getState()?.working.avatarSource?.data || null;
			} catch {
				/* ignore */
			}
		}
		this.authorPosition = runtime.working.authorPosition;
		this.authorBg = runtime.working.authorBg;
		this.authorTextColor = runtime.working.authorTextColor;
		this.authorFontSize = runtime.working.authorFontSize;
		this.authorAlign = runtime.working.authorAlign;
		this.__shareCardDisableLazy = runtime.working.disableLazy;
		if (this.cardRoot) this.cardRoot.style.width = runtime.working.cardWidth + 'px';
		this.renderAuthorBlock();
	}

	onClose() {
		// 关闭前无条件保存（统一行为）
		try {
			this.stateManager?.commit('close');
		} catch {
			/* ignore */
		}
		try {
			this.stateManager?.dispose();
		} catch {
			/* ignore */
		}
		// 记录最后使用的预设（即当前选中，不论是否已保存修改）
		try {
			if (this.currentPresetId) {
				this.plugin.settings.shareCardLastUsedPresetId = this.currentPresetId;
				this.plugin.saveSettings();
			}
		} catch (e) {
			// ignore
		}
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
