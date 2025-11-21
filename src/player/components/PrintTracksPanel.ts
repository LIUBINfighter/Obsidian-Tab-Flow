import { ButtonComponent, setIcon } from 'obsidian';
import type * as alphaTab from '@coderline/alphatab';

interface PrintTracksPanelOptions {
	container: HTMLElement;
	api: alphaTab.AlphaTabApi | null;
	onConfigChanged?: () => void;
}

// DOM 版 Staff 显示选项（打印子集）
interface StaffDisplayOptions {
	showStandardNotation: boolean;
	showTablature: boolean;
	showSlash: boolean;
	showNumbered: boolean;
}

type TrackModel = alphaTab.model.Track & {
	staves?: alphaTab.model.Staff[];
};

/**
 * 打印用 Track+Staff 面板（DOM 版 TracksPanel）：
 * - 左侧始终渲染 score 中的所有 track/staff
 * - 右侧打印结果由本地状态映射到 AlphaTab score 后 renderTracks
 */
export class PrintTracksPanelDom {
	private container: HTMLElement;
	private api: alphaTab.AlphaTabApi | null;
	private headerEl: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private footerEl: HTMLElement | null = null;
	private onConfigChanged?: () => void;

	// 基于当前 score 的快照
	private tracks: TrackModel[] = [];
	private trackVisible: Map<number, boolean> = new Map();
	private staffOptions: Map<string, StaffDisplayOptions> = new Map();

	constructor(options: PrintTracksPanelOptions) {
		this.container = options.container;
		this.api = options.api;
		this.onConfigChanged = options.onConfigChanged;
		this.build();
	}

	setApi(api: alphaTab.AlphaTabApi | null) {
		this.api = api;
		this.initFromScore();
		this.refreshTracks();
	}

	// 从当前 score 拍一次快照，之后左侧 UI 都基于这份模型
	private initFromScore() {
		this.tracks = [];
		this.trackVisible.clear();
		this.staffOptions.clear();

		if (!this.api || !this.api.score) return;

		for (const track of this.api.score.tracks) {
			const model: TrackModel = track as TrackModel;
			// 提前缓存 staves 引用，方便 UI 遍历
			if (!model.staves) {
				// alphatab 类型定义里 staves 可能是私有字段，这里做一次宽松访问
				const anyTrack = track as unknown as { staves?: alphaTab.model.Staff[] };
				model.staves = anyTrack.staves ?? [];
			}
			this.tracks.push(model);
			this.trackVisible.set(track.index, true);

			for (const staff of model.staves ?? []) {
				const key = this.getStaffKey(track.index, staff.index);
				this.staffOptions.set(key, {
					showStandardNotation: (staff as any).showStandardNotation ?? true,
					showTablature: (staff as any).showTablature ?? true,
					showSlash: (staff as any).showSlash ?? false,
					showNumbered: (staff as any).showNumbered ?? false,
				});
			}
		}
	}

	private build() {
		this.container.empty();
		this.container.addClass('tabflow-print-tracks-panel');

		this.headerEl = this.container.createDiv('tabflow-print-tracks-header');
		this.headerEl.addClass('mod-header');

		const titleEl = this.headerEl.createDiv('tabflow-print-tracks-title');
		titleEl.textContent = 'Tracks & staves for print';

		const actionsEl = this.headerEl.createDiv('tabflow-print-tracks-actions');
		new ButtonComponent(actionsEl)
			.setButtonText('Show all')
			.setCta()
			.onClick(() => this.resetToFirstTrackPreset());

		this.listEl = this.container.createDiv('tabflow-print-tracks-list');

		this.footerEl = this.container.createDiv('tabflow-print-tracks-footer');
		this.footerEl.textContent =
			'Track list always shows all tracks. Right side reflects print selection.';

		this.refreshTracks();
	}

	private refreshTracks() {
		if (!this.listEl) return;
		this.listEl.empty();

		if (!this.api || !this.api.score || this.tracks.length === 0) {
			const emptyEl = this.listEl.createDiv('tabflow-print-tracks-empty');
			emptyEl.textContent = 'No tracks available.';
			return;
		}

		for (const track of this.tracks) {
			const item = this.listEl.createDiv('tabflow-print-tracks-item');
			item.addClass('clickable-icon');

			const headerRow = item.createDiv('tabflow-print-track-row');

			// Track 可见性按钮（行为类似四个显示模式按钮）
			const iconBtn = headerRow.createEl('button', {
				cls: 'tabflow-btn tabflow-btn-notation tabflow-print-track-toggle',
			});
			iconBtn.type = 'button';
			iconBtn.title = 'Toggle track visibility in print';
			iconBtn.ariaLabel = 'Toggle track visibility in print';

			const iconEl = iconBtn.createDiv('tabflow-print-tracks-icon');
			const applyTrackIcon = () => {
				const visible = this.getTrackVisible(track.index);
				iconEl.empty();
				setIcon(iconEl, visible ? 'eye' : 'eye-off');
				iconEl.style.opacity = visible ? '1' : '0.35';
				iconEl.toggleClass('mod-muted', !visible);
				iconBtn.toggleClass('is-active', visible);
			};
			applyTrackIcon();

			iconBtn.addEventListener('click', () => {
				const current = this.getTrackVisible(track.index);
				this.trackVisible.set(track.index, !current);
				applyTrackIcon();
				this.applyStateToScore();
			});

			const labelEl = headerRow.createDiv('tabflow-print-tracks-label');
			labelEl.textContent = track.name || `Track ${track.index + 1}`;

			const partEl = headerRow.createDiv('tabflow-print-tracks-meta');
			partEl.textContent = track.shortName || '';

			const staffList = item.createDiv('tabflow-print-staff-list');
			const staves = track.staves ?? [];
			if (!staves.length) {
				const emptyStaff = staffList.createDiv('tabflow-print-staff-empty');
				emptyStaff.textContent = 'No staves.';
				continue;
			}

			for (const staff of staves) {
				const staffRow = staffList.createDiv('tabflow-print-staff-row');
				const label = staffRow.createDiv('tabflow-print-staff-label');
				label.textContent = `Staff ${staff.index + 1}`;

				const buttons = staffRow.createDiv('tabflow-print-staff-buttons');
				const key = this.getStaffKey(track.index, staff.index);
				const disabled = (staff as any).isPercussion as boolean | undefined;

				const makeToggle = (opts: {
					field: keyof StaffDisplayOptions;
					label: string;
					className?: string;
					title: string;
				}) => {
					const btn = buttons.createEl('button');
					btn.type = 'button';
					btn.addClass('tabflow-btn');
					btn.addClass('tabflow-btn-notation');
					if (opts.className) btn.addClass(opts.className);
					btn.textContent = opts.label;
					btn.title = opts.title;
					btn.ariaLabel = opts.title;
					btn.disabled = !!disabled;

					const applyActive = () => {
						const latest = this.getStaffOptions(key, staff);
						if (latest[opts.field]) {
							btn.addClass('is-active');
						} else {
							btn.removeClass('is-active');
						}
					};

					applyActive();

					btn.addEventListener('click', () => {
						this.updateStaffOptions(key, staff, (prev) => ({
							...prev,
							[opts.field]: !prev[opts.field],
						}));
						applyActive();
						this.applyStateToScore();
					});
				};

				makeToggle({
					field: 'showStandardNotation',
					label: '𝅘𝅥',
					title: 'Standard Notation',
					className: '',
				});
				makeToggle({
					field: 'showTablature',
					label: 'TAB',
					title: 'Guitar Tabs',
					className: '',
				});
				makeToggle({
					field: 'showSlash',
					label: '𝄍',
					title: 'Slash Notation',
					className: 'tabflow-btn-icon',
				});
				makeToggle({
					field: 'showNumbered',
					label: '123',
					title: 'Numbered Notation',
					className: 'tabflow-btn-icon',
				});
			}
		}
	}

	private getStaffKey(trackIndex: number, staffIndex: number): string {
		return `${trackIndex}:${staffIndex}`;
	}

	private getTrackVisible(trackIndex: number): boolean {
		if (!this.trackVisible.has(trackIndex)) {
			this.trackVisible.set(trackIndex, true);
		}
		return this.trackVisible.get(trackIndex) ?? true;
	}

	private getStaffOptions(key: string, staff: alphaTab.model.Staff): StaffDisplayOptions {
		let options = this.staffOptions.get(key);
		if (!options) {
			options = {
				showStandardNotation: (staff as any).showStandardNotation ?? true,
				showTablature: (staff as any).showTablature ?? true,
				showSlash: (staff as any).showSlash ?? false,
				showNumbered: (staff as any).showNumbered ?? false,
			};
			this.staffOptions.set(key, options);
		}
		return options;
	}

	// 确保至少一个选项为 true
	private updateStaffOptions(
		key: string,
		staff: alphaTab.model.Staff,
		updater: (current: StaffDisplayOptions) => StaffDisplayOptions
	) {
		const current = this.getStaffOptions(key, staff);
		const next = updater(current);
		const hasAny = Object.values(next).some((v) => v === true);
		if (!hasAny) {
			return;
		}
		this.staffOptions.set(key, next);
	}

	// Reset：只打印第一轨（五线+TAB），左侧仍展示完整结构
	private resetToFirstTrackPreset() {
		if (!this.api || !this.api.score) return;

		this.trackVisible.clear();
		this.staffOptions.clear();

		const score = this.api.score;
		const firstTrack = score.tracks[0];
		const firstTrackIndex = firstTrack?.index ?? 0;

		for (const track of score.tracks) {
			const anyTrack = track as unknown as { staves?: alphaTab.model.Staff[] };
			const staves = anyTrack.staves ?? [];
			const isFirst = track.index === firstTrackIndex;
			this.trackVisible.set(track.index, isFirst);

			for (const staff of staves) {
				const key = this.getStaffKey(track.index, staff.index);
				if (isFirst) {
					this.staffOptions.set(key, {
						showStandardNotation: true,
						showTablature: true,
						showSlash: false,
						showNumbered: false,
					});
				} else {
					this.staffOptions.set(key, {
						showStandardNotation: (staff as any).showStandardNotation ?? true,
						showTablature: (staff as any).showTablature ?? true,
						showSlash: (staff as any).showSlash ?? false,
						showNumbered: (staff as any).showNumbered ?? false,
					});
				}
			}
		}

		// 重建 tracks 快照并刷新 UI
		this.initFromScore();
		this.applyStateToScore();
		this.refreshTracks();
		if (this.onConfigChanged) {
			this.onConfigChanged();
		}
	}

	// 将 Map 状态应用到 AlphaTab score，并刷新右侧打印预览
	private applyStateToScore() {
		if (!this.api || !this.api.score) return;

		const activeTracks: alphaTab.model.Track[] = [];

		for (const track of this.api.score.tracks) {
			const isVisible = this.getTrackVisible(track.index);
			const anyTrack = track as unknown as { staves?: alphaTab.model.Staff[] };
			const staves = anyTrack.staves ?? [];

			for (const staff of staves) {
				const key = this.getStaffKey(track.index, staff.index);
				const options = this.getStaffOptions(key, staff);
				(staff as any).showStandardNotation = options.showStandardNotation;
				(staff as any).showTablature = options.showTablature;
				(staff as any).showSlash = options.showSlash;
				(staff as any).showNumbered = options.showNumbered;
			}

			if (isVisible) {
				activeTracks.push(track);
			}
		}

		this.api.renderTracks(activeTracks.length ? activeTracks : this.api.score.tracks.slice());
		if (this.onConfigChanged) {
			this.onConfigChanged();
		}
	}
}
