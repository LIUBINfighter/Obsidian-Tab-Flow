import { ShareCardPresetV1 } from '../settings/defaults';
import type TabFlowPlugin from '../main';

/**
 * ShareCard 预设服务：封装增删改查、迁移、应用与收集逻辑。
 * 仅管理 settings 内部的 shareCardPresets，不包含文件名（导出时用户仍可输入）。
 */
export class ShareCardPresetService {
	private plugin: TabFlowPlugin;

	constructor(plugin: TabFlowPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Normalize a CSS color string to 6-digit hex if possible, else return fallback.
	 */
	private normalizeColorToHex(color: string | undefined | null, fallback = '#ffffff') {
		if (!color) return fallback;
		const s = String(color).trim();
		if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
			if (s.length === 4) {
				return (
					'#' +
					s
						.slice(1)
						.split('')
						.map((c) => c + c)
						.join('')
				).toLowerCase();
			}
			return s.toLowerCase();
		}
		const m = s.match(/rgba?\s*\(([^)]+)\)/i);
		if (m) {
			const parts = m[1].split(',').map((p) => p.trim());
			if (parts.length >= 3) {
				const r = Math.max(0, Math.min(255, parseInt(parts[0], 10) || 0));
				const g = Math.max(0, Math.min(255, parseInt(parts[1], 10) || 0));
				const b = Math.max(0, Math.min(255, parseInt(parts[2], 10) || 0));
				return (
					'#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
				).toLowerCase();
			}
		}
		try {
			const el = document.createElement('div');
			el.style.color = s;
			document.body.appendChild(el);
			const cs = getComputedStyle(el).color;
			document.body.removeChild(el);
			const mm = String(cs).match(/rgba?\s*\(([^)]+)\)/i);
			if (mm) {
				const parts = mm[1].split(',').map((p) => p.trim());
				const r = Math.max(0, Math.min(255, parseInt(parts[0], 10) || 0));
				const g = Math.max(0, Math.min(255, parseInt(parts[1], 10) || 0));
				const b = Math.max(0, Math.min(255, parseInt(parts[2], 10) || 0));
				return (
					'#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
				).toLowerCase();
			}
		} catch (e) {
			// ignore
		}
		return fallback;
	}

	/** 在插件加载后调用：若无预设则创建一个默认预设 */
	ensureMigration(): void {
		const s = this.plugin.settings;
		if (!Array.isArray(s.shareCardPresets)) s.shareCardPresets = [];
		if (s.shareCardPresets.length === 0) {
			const now = Date.now();
			const preset: ShareCardPresetV1 = {
				id: this.genId(),
				name: '默认',
				version: 1,
				cardWidth: 800,
				resolution: '2x',
				format: 'png',
				disableLazy: false,
				exportBgMode: 'default',
				exportBgCustomColor: '#ffffff',
				showAuthor: false,
				authorName: '',
				authorRemark: '',
				showAvatar: true,
				avatarSource: null,
				authorPosition: 'bottom',
				authorBg: '#ffffff',
				authorTextColor: '#000000',
				authorFontSize: 13,
				authorAlign: 'left',
				createdAt: now,
				updatedAt: now,
				isDefault: true,
			};
			s.shareCardPresets.push(preset);
			s.shareCardDefaultPresetId = preset.id;
			s.shareCardLastUsedPresetId = preset.id;
		} else {
			// 若没有 defaultPresetId，回填第一个
			if (!s.shareCardDefaultPresetId) {
				s.shareCardDefaultPresetId = s.shareCardPresets[0].id;
				s.shareCardPresets[0].isDefault = true;
			}
			// 清理 isDefault 冗余标记，只保留 defaultPresetId 代表的那个
			const defId = s.shareCardDefaultPresetId;
			s.shareCardPresets.forEach((p) => (p.isDefault = p.id === defId ? true : undefined));
			// 若没有 lastUsed，则回填 default
			if (!s.shareCardLastUsedPresetId) {
				s.shareCardLastUsedPresetId = s.shareCardDefaultPresetId;
			}
			// backfill new field
			s.shareCardPresets.forEach((p) => {
				if (!p.authorAlign) p.authorAlign = 'left';
			});
		}
	}

	list(): ShareCardPresetV1[] {
		return [...(this.plugin.settings.shareCardPresets || [])];
	}
	get(id: string): ShareCardPresetV1 | undefined {
		return (this.plugin.settings.shareCardPresets || []).find((p) => p.id === id);
	}

	create(
		partial: Omit<ShareCardPresetV1, 'id' | 'version' | 'createdAt' | 'updatedAt'> &
			Partial<Pick<ShareCardPresetV1, 'createdAt' | 'updatedAt'>>
	): ShareCardPresetV1 {
		const now = Date.now();
		const preset: ShareCardPresetV1 = {
			...partial,
			id: this.genId(),
			version: 1,
			createdAt: partial.createdAt || now,
			updatedAt: partial.updatedAt || now,
		} as ShareCardPresetV1;
		this.plugin.settings.shareCardPresets!.push(preset);
		return preset;
	}

	update(id: string, patch: Partial<ShareCardPresetV1>): ShareCardPresetV1 | undefined {
		const arr = this.plugin.settings.shareCardPresets || [];
		const idx = arr.findIndex((p) => p.id === id);
		if (idx === -1) return undefined;
		const updated: ShareCardPresetV1 = { ...arr[idx], ...patch, updatedAt: Date.now() };
		arr[idx] = updated;
		return updated;
	}

	duplicate(id: string, overrides?: Partial<ShareCardPresetV1>): ShareCardPresetV1 | undefined {
		const base = this.get(id);
		if (!base) return undefined;
		const now = Date.now();
		const copy: ShareCardPresetV1 = {
			...base,
			...overrides,
			id: this.genId(),
			name: overrides?.name || base.name + ' 副本',
			createdAt: now,
			updatedAt: now,
			isDefault: undefined,
		};
		this.plugin.settings.shareCardPresets!.push(copy);
		return copy;
	}

	delete(id: string): boolean {
		const s = this.plugin.settings;
		const arr = s.shareCardPresets || [];
		const idx = arr.findIndex((p) => p.id === id);
		if (idx === -1) return false;
		const removed = arr.splice(idx, 1)[0];
		if (removed?.id === s.shareCardDefaultPresetId) {
			// 重新指定默认：取第一个或清空
			if (arr.length > 0) {
				s.shareCardDefaultPresetId = arr[0].id;
				arr[0].isDefault = true;
			} else {
				s.shareCardDefaultPresetId = undefined;
			}
		}
		if (removed?.id === s.shareCardLastUsedPresetId) {
			s.shareCardLastUsedPresetId = s.shareCardDefaultPresetId;
		}
		return true;
	}

	setDefault(id: string): void {
		const s = this.plugin.settings;
		s.shareCardDefaultPresetId = id;
		(s.shareCardPresets || []).forEach((p) => (p.isDefault = p.id === id ? true : undefined));
	}

	setLastUsed(id: string): void {
		this.plugin.settings.shareCardLastUsedPresetId = id;
	}

	/** 将预设应用到 modal 实例字段（不含文件名） */
	applyToModal(
		modal: {
			exportBgMode?: string;
			exportBgCustomColor?: string;
			showAuthor?: boolean;
			authorName?: string;
			authorRemark?: string;
			showAvatar?: boolean;
			avatarDataUrl?: string | null;
			authorPosition?: string;
			authorBg?: string;
			authorTextColor?: string;
			authorFontSize?: number;
			authorAlign?: string;
			__applyShareCardDimension?: (width: number) => void;
			__applyShareCardFormat?: (format: string, resolution: string, disableLazy: boolean) => void;
			renderAuthorBlock?: () => void;
		},
		preset: ShareCardPresetV1
	): void {
		// 直接映射：确保字段名保持一致
		modal.exportBgMode = preset.exportBgMode;
		modal.exportBgCustomColor = this.normalizeColorToHex(
			preset.exportBgCustomColor || '#ffffff'
		);
		modal.showAuthor = preset.showAuthor;
		modal.authorName = preset.authorName;
		modal.authorRemark = preset.authorRemark;
		modal.showAvatar = preset.showAvatar;
		modal.avatarDataUrl =
			preset.avatarSource?.type === 'data-url' ? preset.avatarSource.data : null;
		modal.authorPosition = preset.authorPosition;
		modal.authorBg = preset.authorBg;
		modal.authorTextColor = preset.authorTextColor;
		modal.authorFontSize = preset.authorFontSize;
		modal.authorAlign = preset.authorAlign || 'left';
		// width / resolution / format / disableLazy 由 UI 控件在 onOpen 初始值时应用，这里需要再同步
		modal.__applyShareCardDimension?.(preset.cardWidth);
		modal.__applyShareCardFormat?.(preset.format, preset.resolution, preset.disableLazy);
		if (typeof modal.renderAuthorBlock === 'function') {
			try {
				modal.renderAuthorBlock();
			} catch {
				/* ignore */
			}
		}
	}

	/** 从 modal 收集当前值生成一个预设对象（不含 id 等） */
	collectFromModal(
		modal: any
	): Omit<ShareCardPresetV1, 'id' | 'version' | 'createdAt' | 'updatedAt'> {
		return {
			name: '未命名',
			cardWidth: Number(modal?.cardRoot?.style?.width?.replace('px', '')) || 800,
			resolution: modal.__shareCardCurrentResolution || '2x',
			format: modal.__shareCardCurrentFormat || 'png',
			disableLazy: !!modal.__shareCardDisableLazy,
			exportBgMode: modal.exportBgMode,
			exportBgCustomColor: this.normalizeColorToHex(modal.exportBgCustomColor),
			showAuthor: modal.showAuthor,
			authorName: modal.authorName,
			authorRemark: modal.authorRemark,
			showAvatar: modal.showAvatar,
			avatarSource: modal.avatarDataUrl
				? { type: 'data-url', data: modal.avatarDataUrl }
				: null,
			authorPosition: modal.authorPosition,
			authorBg: modal.authorBg || '#ffffff',
			authorTextColor: modal.authorTextColor || '#000000',
			authorFontSize: modal.authorFontSize || 13,
			authorAlign: modal.authorAlign || 'left',
			isDefault: undefined,
		};
	}

	private genId(): string {
		return 'scp_' + Math.random().toString(36).slice(2, 10);
	}
}

export default ShareCardPresetService;
