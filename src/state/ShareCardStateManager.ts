import type TabFlowPlugin from '../main';
import ShareCardPresetService from '../services/ShareCardPresetService';
import type { ShareCardPresetV1 } from '../settings/defaults';

interface ShareCardOptions {
	autosaveDelayMs?: number;
	autosaveDefaultPreset?: boolean;
}

// 核心字段（去掉元数据）
export interface ShareCardCorePreset {
	name: string;
	cardWidth: number;
	resolution: '1x' | '2x' | '3x';
	format: 'png' | 'jpg' | 'webp';
	disableLazy: boolean;
	exportBgMode: 'default' | 'auto' | 'custom';
	exportBgCustomColor: string;
	showAuthor: boolean;
	authorName: string;
	authorRemark: string;
	showAvatar: boolean;
	avatarSource: { type: 'data-url'; data: string } | null;
	authorPosition: 'top' | 'bottom';
	authorBg: string;
	authorTextColor: string;
	authorFontSize: number;
	authorAlign: 'left' | 'center' | 'right';
}

export interface ShareCardRuntimeState {
	activePresetId: string;
	base: ShareCardCorePreset; // 初始快照
	working: ShareCardCorePreset; // 可编辑副本
	dirty: boolean;
	autosaveEnabled: boolean;
	pendingTimer: number | null;
	mode: 'single' | 'multi';
	suppressDirty: boolean; // 初始化/批量操作保护
}

export class ShareCardStateManager {
	private state!: ShareCardRuntimeState;
	private autosaveDelay = 800;
	constructor(
		private plugin: TabFlowPlugin,
		private presetService: ShareCardPresetService
	) {}

	init(presetId?: string) {
		// 确保有默认预设
		this.presetService.ensureMigration();
		const all = this.presetService.list();
		const defaultId = this.plugin.settings.shareCardDefaultPresetId || all[0].id;
		const lastUsed = this.plugin.settings.shareCardLastUsedPresetId;
		const activeId = presetId || lastUsed || defaultId;
		const active =
			this.presetService.get(activeId) || this.presetService.get(defaultId) || all[0];
		const core = this.strip(active);
		const options: ShareCardOptions = (this.plugin.settings as any).shareCardOptions || {};
		this.autosaveDelay = options.autosaveDelayMs || 800;
		const autosaveEnabled =
			all.length === 1 ||
			(active.id === defaultId && options.autosaveDefaultPreset !== false); // 默认开启

		this.state = {
			activePresetId: active.id,
			base: core,
			working: JSON.parse(JSON.stringify(core)),
			dirty: false,
			autosaveEnabled,
			pendingTimer: null,
			mode: all.length === 1 ? 'single' : 'multi',
			suppressDirty: false,
		};
		this.plugin.settings.shareCardLastUsedPresetId = this.state.activePresetId;
		return this.state;
	}

	getState() {
		return this.state;
	}

	private strip(p: ShareCardPresetV1): ShareCardCorePreset {
		return {
			name: p.name,
			cardWidth: p.cardWidth,
			resolution: p.resolution,
			format: p.format,
			disableLazy: p.disableLazy,
			exportBgMode: p.exportBgMode,
			exportBgCustomColor: p.exportBgCustomColor || '#ffffff',
			showAuthor: p.showAuthor,
			authorName: p.authorName,
			authorRemark: p.authorRemark,
			showAvatar: p.showAvatar,
			avatarSource: p.avatarSource || null,
			authorPosition: p.authorPosition,
			authorBg: p.authorBg,
			authorTextColor: p.authorTextColor,
			authorFontSize: p.authorFontSize,
			authorAlign: p.authorAlign || 'left',
		};
	}

	updateField<K extends keyof ShareCardCorePreset>(k: K, v: ShareCardCorePreset[K]) {
		const s = this.state;
		if (!s) return;
		if ((s.working as any)[k] === v) return;
		(s.working as any)[k] = v;
		if (!s.suppressDirty) {
			s.dirty = !this.shallowEqual(s.working, s.base);
			if (s.dirty && s.autosaveEnabled) this.scheduleAutosave();
		}
	}

	private scheduleAutosave() {
		const s = this.state;
		if (!s.autosaveEnabled) return;
		if (s.pendingTimer) window.clearTimeout(s.pendingTimer);
		s.pendingTimer = window.setTimeout(() => {
			this.commit('autosave');
		}, this.autosaveDelay);
	}

	commit(reason: 'autosave' | 'manual' | 'switch' | 'close') {
		const s = this.state;
		if (!s) return;
		if (!s.dirty && reason === 'autosave') return;
		const preset = this.presetService.get(s.activePresetId);
		if (!preset) return;
		const patch: Partial<ShareCardPresetV1> = { ...s.working, updatedAt: Date.now() } as any;
		this.presetService.update(s.activePresetId, patch);
		s.base = JSON.parse(JSON.stringify(s.working));
		s.dirty = false;
		if (s.pendingTimer) {
			window.clearTimeout(s.pendingTimer);
			s.pendingTimer = null;
		}
		// 异步保存设置（无需 await，自动保存场景下避免阻塞）
		this.plugin
			.saveSettings()
			.catch((e) => console.warn('[ShareCardStateManager] saveSettings failed', e));
	}

	resetWorking() {
		const s = this.state;
		s.working = JSON.parse(JSON.stringify(s.base));
		s.dirty = false;
		if (s.pendingTimer) {
			window.clearTimeout(s.pendingTimer);
			s.pendingTimer = null;
		}
	}

	switchPreset(id: string) {
		const s = this.state;
		if (id === s.activePresetId) return;
		const target = this.presetService.get(id);
		if (!target) return;
		s.activePresetId = id;
		const core = this.strip(target);
		s.suppressDirty = true;
		s.base = core;
		s.working = JSON.parse(JSON.stringify(core));
		s.dirty = false;
		s.suppressDirty = false;
		const all = this.presetService.list();
		const defaultId = this.plugin.settings.shareCardDefaultPresetId;
		const options: ShareCardOptions = (this.plugin.settings as any).shareCardOptions || {};
		s.autosaveEnabled =
			all.length === 1 || (id === defaultId && options.autosaveDefaultPreset !== false);
		this.plugin.settings.shareCardLastUsedPresetId = id;
		void this.plugin.saveSettings();
	}

	isDirty() {
		return !!this.state?.dirty;
	}

	dispose() {
		if (this.state?.pendingTimer) window.clearTimeout(this.state.pendingTimer);
	}

	private shallowEqual(a: ShareCardCorePreset, b: ShareCardCorePreset) {
		const ka = Object.keys(a) as (keyof ShareCardCorePreset)[];
		for (const k of ka) {
			const av = (a as any)[k];
			const bv = (b as any)[k];
			if (typeof av === 'object') {
				if (JSON.stringify(av) !== JSON.stringify(bv)) return false;
			} else if (av !== bv) return false;
		}
		return true;
	}
}

export default ShareCardStateManager;
