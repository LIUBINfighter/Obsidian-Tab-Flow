import { Modal, Setting, App, type ExtraButtonComponent, type ToggleComponent } from 'obsidian';
import * as alphaTab from '@coderline/alphatab';
import { EventBus } from '../utils';
import { TrackStateStore } from '../state/TrackStateStore';
import { t } from '../i18n';

export class TracksModal extends Modal {
	private selectedTracks: Set<alphaTab.model.Track>;
	private uiRefs = new Map<
		number,
		{
			toggle?: ToggleComponent;
			soloBtn?: ExtraButtonComponent;
			muteBtn?: ExtraButtonComponent;
			vol?: { slider: HTMLInputElement; input: HTMLInputElement; value: HTMLElement };
			tr?: { slider: HTMLInputElement; input: HTMLInputElement; value: HTMLElement };
			ta?: { slider: HTMLInputElement; input: HTMLInputElement; value: HTMLElement };
		}
	>();
	private unsubscribeStore?: () => void;
	private suppressToggleEvent = false;
	constructor(
		app: App,
		private tracks: alphaTab.model.Track[],
		private filePath: string,
		private api: alphaTab.AlphaTabApi,
		private eventBus: EventBus | undefined,
		private trackStateStore: TrackStateStore
	) {
		super(app);
		this.modalEl.addClass('tracks-modal');
		this.selectedTracks = new Set(tracks.length ? [tracks[0]] : []);
	}

	onOpen() {
		this.contentEl.empty();
		this.titleEl.setText('');
		this.uiRefs.clear();

		// 确保 Store 中存在基于当前 API 的默认值（不直接改动 API）
		try {
			if (this.filePath) {
				this.trackStateStore.ensureDefaultsFromApi(this.filePath, this.api);
			}
		} catch {
			// ignore
		}

		// 读全局状态
		const globalState = this.filePath ? this.trackStateStore.getFileState(this.filePath) : {};
		const savedTrackSettings = globalState.trackSettings || {};
		if (globalState.selectedTracks?.length) {
			const set = new Set(globalState.selectedTracks);
			const match = this.tracks.filter((t) => set.has(t.index));
			if (match.length) this.selectedTracks = new Set(match);
			else this.selectedTracks = new Set(this.tracks.length ? [this.tracks[0]] : []);
		} else {
			// 当未有持久化选中时，使用 API 当前渲染的轨道作为初始选中；若不可用则退回为全部轨道
			const apiRendered = (this.api?.tracks as alphaTab.model.Track[] | undefined) || [];
			if (apiRendered.length) {
				const indices = new Set(apiRendered.map((t) => t.index));
				const match = this.tracks.filter((t) => indices.has(t.index));
				this.selectedTracks = new Set(match.length ? match : this.tracks);
			} else {
				this.selectedTracks = new Set(this.tracks);
			}
		}

		// 标题栏（精简，无 Apply/Cancel）
		const titleBar = document.createElement('div');
		titleBar.className = 'modal-title-bar';
		const titleText = document.createElement('span');
		titleText.className = 'modal-title-text';
		titleText.textContent = t('tracks.chooseTracksToDisplay');
		titleBar.appendChild(titleText);
		this.titleEl.appendChild(titleBar);

		const scrollContainer = document.createElement('div');
		scrollContainer.className = 'tracks-scroll-container';
		this.contentEl.appendChild(scrollContainer);

		const applySelectedToStore = () => {
			const list = Array.from(this.selectedTracks).sort((a, b) => a.index - b.index);
			this.trackStateStore.setSelectedTracks(
				this.filePath,
				list.map((t) => t.index)
			);
		};

		this.tracks.forEach((track) => {
			const trackSetting = new Setting(scrollContainer)
				.setName(track.name)
				.setDesc(track.shortName || t('tracks.trackNumber', { number: track.index + 1 }));
			trackSetting.settingEl.classList.add('track-item');

			// 选择音轨 toggle -> 即时更新
			trackSetting.addToggle((toggle) => {
				toggle.setValue(this.selectedTracks.has(track)).onChange((val) => {
					if (this.suppressToggleEvent) return; // 避免从 Store 回推时触发循环
					if (val) this.selectedTracks.add(track);
					else {
						if (this.selectedTracks.size === 1) {
							// 保证至少一条
							toggle.setValue(true);
							return;
						}
						this.selectedTracks.delete(track);
					}
					applySelectedToStore();
				});
				// 保存引用以便 Store 变化时刷新
				const ref = this.uiRefs.get(track.index) || {};
				ref.toggle = toggle;
				this.uiRefs.set(track.index, ref);
			});

			// === 独奏按钮 ===
			trackSetting.addExtraButton((btn) => {
				const updateUI = () => {
					const current =
						this.trackStateStore.getFileState(this.filePath).trackSettings?.[
							String(track.index)
						] || {};
					const isSolo = current.solo ?? (track.playbackInfo as any).isSolo;
					btn.setIcon(isSolo ? 'star' : 'star-off').setTooltip(
						isSolo ? t('tracks.unsolo') : t('tracks.solo')
					);
					btn.extraSettingsEl.toggleClass('active', !!isSolo);
				};
				updateUI();
				btn.onClick(() => {
					const prev =
						this.trackStateStore.getFileState(this.filePath).trackSettings?.[
							String(track.index)
						]?.solo ??
						(track.playbackInfo as any).isSolo ??
						false;
					const newSolo = !prev;
					this.trackStateStore.updateTrackSetting(this.filePath, track.index, {
						solo: newSolo,
					});
					updateUI();
				});
				// 保存引用
				const ref = this.uiRefs.get(track.index) || {};
				ref.soloBtn = btn;
				this.uiRefs.set(track.index, ref);
				return btn;
			});

			// === 静音按钮 ===
			trackSetting.addExtraButton((btn) => {
				const updateUI = () => {
					const current =
						this.trackStateStore.getFileState(this.filePath).trackSettings?.[
							String(track.index)
						] || {};
					const isMute = current.mute ?? (track.playbackInfo as any).isMute;
					btn.setIcon(isMute ? 'volume-x' : 'volume-2').setTooltip(
						isMute ? t('tracks.unmute') : t('tracks.mute')
					);
					btn.extraSettingsEl.toggleClass('active', !!isMute);
				};
				updateUI();
				btn.onClick(() => {
					const prev =
						this.trackStateStore.getFileState(this.filePath).trackSettings?.[
							String(track.index)
						]?.mute ??
						(track.playbackInfo as any).isMute ??
						false;
					const newMute = !prev;
					this.trackStateStore.updateTrackSetting(this.filePath, track.index, {
						mute: newMute,
					});
					updateUI();
				});
				// 保存引用
				const ref = this.uiRefs.get(track.index) || {};
				ref.muteBtn = btn;
				this.uiRefs.set(track.index, ref);
				return btn;
			});

			// === 音量 ===
			const volWrapper = document.createElement('div');
			volWrapper.className = 'track-param-row';
			const volLabel = document.createElement('span');
			volLabel.textContent = t('tracks.volume');
			const volSlider = document.createElement('input');
			volSlider.type = 'range';
			volSlider.min = '0';
			volSlider.max = '16';
			const curVol =
				typeof savedTrackSettings[String(track.index)]?.volume === 'number'
					? savedTrackSettings[String(track.index)].volume
					: (track.playbackInfo as any).volume;
			volSlider.value = String(curVol ?? 8);
			const volValue = document.createElement('span');
			volValue.textContent = volSlider.value;
			const volInput = document.createElement('input');
			volInput.type = 'number';
			volInput.min = '0';
			volInput.max = '16';
			volInput.value = volSlider.value;
			// 简易防抖，避免高频更新导致过多 Store 事件与 API 调用，同时确保最后一次值被应用
			let volDebounce: number | null = null;
			const applyVolume = (v: number) => {
				v = Math.max(0, Math.min(16, v));
				if (volDebounce) window.clearTimeout(volDebounce);
				volDebounce = window.setTimeout(() => {
					this.trackStateStore.updateTrackSetting(this.filePath, track.index, {
						volume: v,
					});
					volSlider.value = String(v);
					volValue.textContent = String(v);
					volInput.value = String(v);
					volDebounce = null;
				}, 60);
			};
			volSlider.oninput = (e) => applyVolume(Number((e.target as HTMLInputElement).value));
			volInput.onchange = (e) => applyVolume(Number((e.target as HTMLInputElement).value));
			volWrapper.appendChild(volLabel);
			volWrapper.appendChild(volSlider);
			volWrapper.appendChild(volValue);
			volWrapper.appendChild(volInput);
			trackSetting.settingEl.appendChild(volWrapper);
			// 保存引用
			{
				const ref = this.uiRefs.get(track.index) || {};
				ref.vol = { slider: volSlider, input: volInput, value: volValue };
				this.uiRefs.set(track.index, ref);
			}

			// === 全局移调 ===
			const trWrapper = document.createElement('div');
			trWrapper.className = 'track-param-row';
			const trLabel = document.createElement('span');
			trLabel.textContent = t('tracks.globalTranspose');
			const trSlider = document.createElement('input');
			trSlider.type = 'range';
			trSlider.min = '-12';
			trSlider.max = '12';
			trSlider.step = '1';
			const curTr =
				typeof savedTrackSettings[String(track.index)]?.transpose === 'number'
					? savedTrackSettings[String(track.index)].transpose
					: 0;
			trSlider.value = String(curTr);
			const trValue = document.createElement('span');
			trValue.textContent = trSlider.value;
			const trInput = document.createElement('input');
			trInput.type = 'number';
			trInput.min = '-12';
			trInput.max = '12';
			trInput.value = trSlider.value;
			let trDebounce: number | null = null;
			const applyTranspose = (v: number) => {
				v = Math.max(-12, Math.min(12, v));
				if (trDebounce) window.clearTimeout(trDebounce);
				trDebounce = window.setTimeout(() => {
					this.trackStateStore.updateTrackSetting(this.filePath, track.index, {
						transpose: v,
					});
					trSlider.value = String(v);
					trValue.textContent = String(v);
					trInput.value = String(v);
					trDebounce = null;
				}, 60);
			};
			trSlider.oninput = (e) => applyTranspose(Number((e.target as HTMLInputElement).value));
			trInput.onchange = (e) => applyTranspose(Number((e.target as HTMLInputElement).value));
			trWrapper.appendChild(trLabel);
			trWrapper.appendChild(trSlider);
			trWrapper.appendChild(trValue);
			trWrapper.appendChild(trInput);
			trackSetting.settingEl.appendChild(trWrapper);
			// 保存引用
			{
				const ref = this.uiRefs.get(track.index) || {};
				ref.tr = { slider: trSlider, input: trInput, value: trValue };
				this.uiRefs.set(track.index, ref);
			}

			// === 音频移调（逻辑） ===
			const taWrapper = document.createElement('div');
			taWrapper.className = 'track-param-row';
			const taLabel = document.createElement('span');
			taLabel.textContent = t('tracks.audioTranspose');
			const taSlider = document.createElement('input');
			taSlider.type = 'range';
			taSlider.min = '-12';
			taSlider.max = '12';
			taSlider.step = '1';
			const curTa =
				typeof savedTrackSettings[String(track.index)]?.transposeAudio === 'number'
					? savedTrackSettings[String(track.index)].transposeAudio
					: 0;
			taSlider.value = String(curTa);
			const taValue = document.createElement('span');
			taValue.textContent = taSlider.value;
			const taInput = document.createElement('input');
			taInput.type = 'number';
			taInput.min = '-12';
			taInput.max = '12';
			taInput.value = taSlider.value;
			let taDebounce: number | null = null;
			const applyTa = (v: number) => {
				v = Math.max(-12, Math.min(12, v));
				// 暂无 API；仅存储逻辑值
				if (taDebounce) window.clearTimeout(taDebounce);
				taDebounce = window.setTimeout(() => {
					this.trackStateStore.updateTrackSetting(this.filePath, track.index, {
						transposeAudio: v,
					});
					taSlider.value = String(v);
					taValue.textContent = String(v);
					taInput.value = String(v);
					taDebounce = null;
				}, 60);
			};
			taSlider.oninput = (e) => applyTa(Number((e.target as HTMLInputElement).value));
			taInput.onchange = (e) => applyTa(Number((e.target as HTMLInputElement).value));
			taWrapper.appendChild(taLabel);
			taWrapper.appendChild(taSlider);
			taWrapper.appendChild(taValue);
			taWrapper.appendChild(taInput);
			trackSetting.settingEl.appendChild(taWrapper);
			// 保存引用
			{
				const ref = this.uiRefs.get(track.index) || {};
				ref.ta = { slider: taSlider, input: taInput, value: taValue };
				this.uiRefs.set(track.index, ref);
			}
		});

		// === 底部操作区：恢复默认按钮（仅清除存储，不主动改动当前播放状态） ===
		const footer = document.createElement('div');
		footer.className = 'tracks-footer-actions';
		const resetBtn = document.createElement('button');
		resetBtn.className = 'mod-warning';
		resetBtn.textContent = t('tracks.resetToDefaults', undefined, '恢复默认');
		resetBtn.onclick = () => {
			try {
				// 清除持久化，不改动 API；根据“无持久化”状态重新渲染 Modal 内容
				this.trackStateStore.clearFile(this.filePath);
				this.contentEl.empty();
				this.onOpen();
				// 将选中轨道设置为第一条（index 0 或列表第一项），驱动 TabView 只渲染第一轨
				if (this.tracks.length) {
					const first = this.tracks.find((tr) => tr.index === 0) || this.tracks[0];
					// 更新 Store（触发 TabView 渲染第一轨）
					this.trackStateStore.setSelectedTracks(this.filePath, [first.index]);
					// 同步 Modal UI toggle 显示
					this.suppressToggleEvent = true;
					this.selectedTracks = new Set([first]);
					this.tracks.forEach((tr) => {
						const ref = this.uiRefs.get(tr.index);
						if (ref?.toggle) ref.toggle.setValue(tr.index === first.index);
					});
					this.suppressToggleEvent = false;
				}
			} catch (e) {
				console.warn('[TracksModal] 重置轨道状态失败', e);
			}
		};
		footer.appendChild(resetBtn);
		this.contentEl.appendChild(footer);

		// 订阅 Store 变化，实时刷新 UI（仅在本文件变化时）
		this.unsubscribeStore = this.trackStateStore.on((ev) => {
			if (ev.filePath !== this.filePath) return;
			const entry = this.trackStateStore.getFileState(this.filePath);
			const changed = ev.changed;
			// 选中轨道更新
			if (changed?.selectedTracks) {
				const sel = new Set(changed.selectedTracks);
				// 更新本地 selectedTracks 集合
				this.selectedTracks = new Set(
					this.tracks.filter((t) => (sel.size ? sel.has(t.index) : true))
				);
				// 刷新 toggle
				this.tracks.forEach((t) => {
					const ref = this.uiRefs.get(t.index);
					if (ref?.toggle) {
						this.suppressToggleEvent = true;
						ref.toggle.setValue(sel.size ? sel.has(t.index) : true);
						this.suppressToggleEvent = false;
					}
				});
			}
			// 每轨设置更新
			const applyTrackPatch = (idx: number, patch: any) => {
				const ref = this.uiRefs.get(idx);
				const s = entry.trackSettings?.[String(idx)] || {};
				// 独奏
				if (ref?.soloBtn && (patch.solo !== undefined || s.solo !== undefined)) {
					const isSolo = patch.solo ?? s.solo ?? false;
					ref.soloBtn
						.setIcon(isSolo ? 'star' : 'star-off')
						.setTooltip(isSolo ? t('tracks.unsolo') : t('tracks.solo'));
					ref.soloBtn.extraSettingsEl.toggleClass('active', !!isSolo);
				}
				// 静音
				if (ref?.muteBtn && (patch.mute !== undefined || s.mute !== undefined)) {
					const isMute = patch.mute ?? s.mute ?? false;
					ref.muteBtn
						.setIcon(isMute ? 'volume-x' : 'volume-2')
						.setTooltip(isMute ? t('tracks.unmute') : t('tracks.mute'));
					ref.muteBtn.extraSettingsEl.toggleClass('active', !!isMute);
				}
				// 音量
				if (ref?.vol && (patch.volume !== undefined || s.volume !== undefined)) {
					const v = Number(patch.volume ?? s.volume ?? 8);
					ref.vol.slider.value = String(v);
					ref.vol.input.value = String(v);
					ref.vol.value.textContent = String(v);
				}
				// 全局移调
				if (ref?.tr && (patch.transpose !== undefined || s.transpose !== undefined)) {
					const v = Number(patch.transpose ?? s.transpose ?? 0);
					ref.tr.slider.value = String(v);
					ref.tr.input.value = String(v);
					ref.tr.value.textContent = String(v);
				}
				// 音频移调（逻辑）
				if (
					ref?.ta &&
					(patch.transposeAudio !== undefined || s.transposeAudio !== undefined)
				) {
					const v = Number(patch.transposeAudio ?? s.transposeAudio ?? 0);
					ref.ta.slider.value = String(v);
					ref.ta.input.value = String(v);
					ref.ta.value.textContent = String(v);
				}
			};

			if (changed?.trackSettings) {
				Object.keys(changed.trackSettings).forEach((key) => {
					const idx = Number(key);
					const patch = changed.trackSettings![key] || {};
					applyTrackPatch(idx, patch);
				});
			} else if (!changed) {
				// 全量刷新（例如 ensureDefaultsFromApi 触发）
				this.tracks.forEach((t) => applyTrackPatch(t.index, {}));
			}
		});
	}

	onClose() {
		this.contentEl.empty();
		// 解绑 Store 订阅，清理引用
		try {
			if (this.unsubscribeStore) this.unsubscribeStore();
			this.unsubscribeStore = undefined;
		} catch {
			/* ignore */
		}
		this.uiRefs.clear();
	}
}
