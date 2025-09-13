import { Modal, Notice, Platform, MarkdownView } from 'obsidian';
import type TabFlowPlugin from '../main';
import { createAlphaTexPlayground, AlphaTexPlaygroundHandle } from './AlphaTexPlayground';
import * as domtoimage from 'dom-to-image-more';

export class ShareCardModal extends Modal {
	private plugin: TabFlowPlugin;
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

	private applyPanTransform() {
		if (this.panWrapper) {
			this.panWrapper.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoomScale})`;
		}
	}

	private buildExportStyle(scale: number) {
		// Combine current translation (pan) with zoom * resolution scale
		return {
			transformOrigin: 'top left',
			transform: `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoomScale * scale})`,
		};
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
		const titleInput = left.createEl('input') as HTMLInputElement;
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
		this.applyPanTransform();

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
		try {
			this.playgroundHandle = createAlphaTexPlayground(this.plugin, this.cardRoot, source, {
				readOnly: true,
				showEditor: false,
				layout: 'vertical',
				className: 'share-card-playground',
			});
		} catch (e) {
			console.error('[ShareCardModal] 创建 playground 失败', e);
			this.cardRoot.createEl('div', { text: '预览创建失败' });
		}

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
		});

		// Export handler
		exportBtn.addEventListener('click', async () => {
			if (!this.cardRoot) return;
			exportBtn.setAttribute('disabled', 'true');
			copyBtn.setAttribute('disabled', 'true');
			const title = titleInput.value || 'alphatex-card';
			const resolution = Number(resSelect.value.replace('x', '')) || 1;
			const fmt = formatSelect.value as string;
			const mime = fmt === 'png' ? 'image/png' : fmt === 'jpg' ? 'image/jpeg' : 'image/webp';
			try {
				let blob: Blob | null = null;
				const rect = this.cardRoot.getBoundingClientRect();
				const width = Math.ceil(rect.width * resolution);
				const height = Math.ceil(rect.height * resolution);
				const options: any = {
					width,
					height,
					style: this.buildExportStyle(resolution),
					bgcolor: mime === 'image/jpeg' ? '#fff' : undefined,
					quality: fmt === 'jpg' ? 0.92 : undefined,
					cacheBust: true,
				};
				blob = await domtoimage.toBlob(this.cardRoot, options);
				if (!blob) throw new Error('生成图片失败');

				if (Platform.isMobile) {
					// save to vault
					const filename = `${title.replace(/\s+/g, '_')}.${fmt}`;
					const filePath =
						await this.app.fileManager.getAvailablePathForAttachment(filename);
					await this.app.vault.createBinary(filePath, await blob.arrayBuffer());
					new Notice(`已保存到 ${filePath}`);
				} else {
					// desktop: download
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

		// Copy handler
		copyBtn.addEventListener('click', async () => {
			if (!this.cardRoot) return;
			exportBtn.setAttribute('disabled', 'true');
			copyBtn.setAttribute('disabled', 'true');
			const resolution = Number(resSelect.value.replace('x', '')) || 1;
			const fmt = formatSelect.value as string;
			const mime = fmt === 'png' ? 'image/png' : fmt === 'jpg' ? 'image/jpeg' : 'image/webp';
			try {
				let blob: Blob | null = null;
				const rect = this.cardRoot.getBoundingClientRect();
				const width = Math.ceil(rect.width * resolution);
				const height = Math.ceil(rect.height * resolution);
				const options: any = {
					width,
					height,
					style: this.buildExportStyle(resolution),
					bgcolor: mime === 'image/jpeg' ? '#fff' : undefined,
					quality: fmt === 'jpg' ? 0.92 : undefined,
					cacheBust: true,
				};
				blob = await domtoimage.toBlob(this.cardRoot, options);
				if (!blob) throw new Error('生成图片失败');
				// copy to clipboard if supported
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

		closeBtn.addEventListener('click', () => this.close());
	}

	onClose() {
		try {
			this.playgroundHandle?.destroy();
		} catch (e) {
			// ignore
		}
		this.playgroundHandle = null;
		this.cardRoot = null;
		this.contentEl.empty();
	}
}

export default ShareCardModal;
