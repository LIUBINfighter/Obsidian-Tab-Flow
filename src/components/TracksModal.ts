import { Modal, Setting, App } from 'obsidian';
import * as alphaTab from '@coderline/alphatab';
// import type { TrackEventPayload } from '../events/trackEvents'; // Not used
import { EventBus } from '../utils';
import { ScorePersistenceService } from '../services/ScorePersistenceService'; // 导入新的服务
import { t } from '../i18n';

export class TracksModal extends Modal {
	private selectedTracks: Set<alphaTab.model.Track>;

	constructor(
		app: App,
		private tracks: alphaTab.model.Track[],
		private onChange?: (tracks: alphaTab.model.Track[]) => void,
		private api?: alphaTab.AlphaTabApi,
		private eventBus?: EventBus,
		private scorePersistenceService?: ScorePersistenceService // 注入新的服务
	) {
		super(app);
		this.selectedTracks = new Set(tracks.length > 0 ? [tracks[0]] : []);
		this.modalEl.addClass('tracks-modal');
	}

	onOpen() {
		// 每次打开时尝试从 localStorage 恢复
		let savedTrackSettings: Record<string, any> | undefined;
		try {
			const filePath = (this.api as any)?.score?.filePath;
			if (filePath) {
				const raw = localStorage.getItem('tabflow-viewstate:' + filePath);
				if (raw) {
					const state = JSON.parse(raw);
					// 恢复选中的音轨
					if (state && Array.isArray(state.tracks) && this.tracks) {
						const idxSet = new Set(state.tracks);
						const matched = this.tracks.filter((t) => idxSet.has(t.index));
						if (matched.length > 0) this.selectedTracks = new Set(matched);
					}
					// 恢复轨道参数
					if (state && state.trackSettings && typeof state.trackSettings === 'object') {
						savedTrackSettings = state.trackSettings as Record<string, any>;
					}
				}
			}
		} catch {
			// Ignore track settings loading errors
		}
		this.contentEl.empty();
		this.titleEl.setText('');
		// 创建标题栏容器
		const titleBar = document.createElement('div');
		titleBar.className = 'modal-title-bar';
		// 标题
		const titleText = document.createElement('span');
		titleText.className = 'modal-title-text';
		titleText.textContent = t('tracks.chooseTracksToDisplay');
		// 按钮容器
		const btnGroup = document.createElement('div');
		btnGroup.className = 'modal-button-group';
		// 应用按钮
		const applyBtn = document.createElement('button');
		applyBtn.textContent = t('common.apply');
		applyBtn.className = 'mod-cta';
		applyBtn.onclick = () => {
			this.onSelectTrack();
			this.close();
		};
		// 取消按钮
		const cancelBtn = document.createElement('button');
		cancelBtn.textContent = t('common.cancel');
		cancelBtn.onclick = () => {
			this.close();
		};
		btnGroup.appendChild(applyBtn);
		btnGroup.appendChild(cancelBtn);
		titleBar.appendChild(titleText);
		titleBar.appendChild(btnGroup);
		this.titleEl.appendChild(titleBar);

		// 创建滚动容器
		const scrollContainer = document.createElement('div');
		scrollContainer.className = 'tracks-scroll-container';

		this.contentEl.appendChild(scrollContainer);

		this.tracks.forEach((track) => {
			const trackSetting = new Setting(scrollContainer)
				.setName(track.name)
				.setDesc(track.shortName || t('tracks.trackNumber', { number: track.index + 1 }));

			// 为每个轨道的setting添加CSS类
			trackSetting.settingEl.addClass('track-item');

			// 选择音轨
			trackSetting.addToggle((toggle) => {
				toggle.setValue(this.selectedTracks.has(track)).onChange((value) => {
					if (value) {
						this.selectedTracks.add(track);
					} else {
						this.selectedTracks.delete(track);
					}
				});
			});

			// 静音/独奏按钮
			// 独奏按钮
			trackSetting.addExtraButton((btn) => {
				// 若有保存的状态，先同步到本地对象以便初始 UI 正确
				try {
					const idxKey = String(track.index);
					const s = savedTrackSettings?.[idxKey];
					if (s && typeof s.solo === 'boolean') {
						// @ts-ignore
						track.playbackInfo.isSolo = s.solo;
					}
				} catch {
					// Ignore solo settings loading errors
				}
				const updateSoloUI = () => {
					const isSolo = track.playbackInfo.isSolo;
					btn.setIcon(isSolo ? 'star' : 'star-off').setTooltip(
						isSolo ? t('tracks.unsolo') : t('tracks.solo')
					);
					btn.extraSettingsEl.toggleClass('active', isSolo);
				};

				updateSoloUI();

				btn.onClick(() => {
					const newSolo = !track.playbackInfo.isSolo;
					// 更新轨道状态
					track.playbackInfo.isSolo = newSolo;

					if (this.api) {
						this.api.changeTrackSolo([track], newSolo);
						// 发送事件用于状态同步
						this.eventBus?.publish('track:solo', {
							track,
							value: newSolo,
						});
						const filePath = (this.api as any)?.score?.filePath;
						if (filePath && this.scorePersistenceService) {
							this.scorePersistenceService.saveTrackSettings(filePath, track.index, {
								solo: newSolo,
							});
						}
					}

					// 更新UI
					updateSoloUI();
				});

				return btn;
			});

			// 静音按钮
			trackSetting.addExtraButton((btn) => {
				// 若有保存的状态，先同步到本地对象以便初始 UI 正确
				try {
					const idxKey = String(track.index);
					const s = savedTrackSettings?.[idxKey];
					if (s && typeof s.mute === 'boolean') {
						// @ts-ignore
						track.playbackInfo.isMute = s.mute;
					}
				} catch {
					// Ignore mute settings loading errors
				}
				const updateMuteUI = () => {
					const isMute = track.playbackInfo.isMute;
					btn.setIcon(isMute ? 'volume-x' : 'volume-2').setTooltip(
						isMute ? t('tracks.unmute') : t('tracks.mute')
					);
					btn.extraSettingsEl.toggleClass('active', isMute);
				};

				updateMuteUI();

				btn.onClick(() => {
					const newMute = !track.playbackInfo.isMute;
					// 更新轨道状态
					track.playbackInfo.isMute = newMute;

					if (this.api) {
						this.api.changeTrackMute([track], newMute);
						// 发送事件用于状态同步
						this.eventBus?.publish('track:mute', {
							track,
							value: newMute,
						});
						const filePath = (this.api as any)?.score?.filePath;
						if (filePath && this.scorePersistenceService) {
							this.scorePersistenceService.saveTrackSettings(filePath, track.index, {
								mute: newMute,
							});
						}
					}

					// 更新UI
					updateMuteUI();
				});

				return btn;
			});

			// 音量滑块+数值+输入框（通过事件总线）
			const volumeDiv = document.createElement('div');
			volumeDiv.className = 'track-param-row';
			const volumeLabel = document.createElement('span');
			volumeLabel.textContent = t('tracks.volume');
			const volumeSlider = document.createElement('input');
			volumeSlider.type = 'range';
			volumeSlider.min = '0';
			volumeSlider.max = '16';
			try {
				const s = savedTrackSettings?.[String(track.index)];
				const initVol =
					typeof s?.volume === 'number' ? s.volume : track.playbackInfo.volume;
				volumeSlider.value = String(initVol);
			} catch {
				volumeSlider.value = String(track.playbackInfo.volume);
			}
			const volumeValue = document.createElement('span');
			try {
				const s = savedTrackSettings?.[String(track.index)];
				volumeValue.textContent = String(
					typeof s?.volume === 'number' ? s.volume : track.playbackInfo.volume
				);
			} catch {
				volumeValue.textContent = String(track.playbackInfo.volume);
			}
			const volumeInput = document.createElement('input');
			volumeInput.type = 'number';
			volumeInput.min = '0';
			volumeInput.max = '16';
			try {
				const s = savedTrackSettings?.[String(track.index)];
				volumeInput.value = String(
					typeof s?.volume === 'number' ? s.volume : track.playbackInfo.volume
				);
			} catch {
				volumeInput.value = String(track.playbackInfo.volume);
			}
			// 事件同步
			const updateVolume = (newVolume: number) => {
				newVolume = Math.max(0, Math.min(16, newVolume));
				if (this.api) {
					// alphaTab 期望 0-1 的音量值
					this.api.changeTrackVolume([track], newVolume / 16);
					// 发送事件用于状态同步
					this.eventBus?.publish('track:volume', {
						track,
						value: newVolume,
					});
					const filePath = (this.api as any)?.score?.filePath;
					if (filePath && this.scorePersistenceService) {
						this.scorePersistenceService.saveTrackSettings(filePath, track.index, {
							volume: newVolume,
						});
					}
				}
				volumeSlider.value = String(newVolume);
				volumeValue.textContent = String(newVolume);
				volumeInput.value = String(newVolume);
			};
			volumeSlider.oninput = (e) => {
				updateVolume(Number((e.target as HTMLInputElement).value));
			};
			volumeInput.onchange = (e) => {
				updateVolume(Number((e.target as HTMLInputElement).value));
			};
			volumeDiv.appendChild(volumeLabel);
			volumeDiv.appendChild(volumeSlider);
			volumeDiv.appendChild(volumeValue);
			volumeDiv.appendChild(volumeInput);
			trackSetting.settingEl.appendChild(volumeDiv);

			// 全局移调 滑块+数值+输入框（通过事件总线）
			const transposeDiv = document.createElement('div');
			transposeDiv.className = 'track-param-row';
			const transposeLabel = document.createElement('span');
			transposeLabel.textContent = t('tracks.globalTranspose');
			const transposeSlider = document.createElement('input');
			transposeSlider.type = 'range';
			transposeSlider.min = '-12';
			transposeSlider.max = '12';
			transposeSlider.step = '1';
			try {
				const s = savedTrackSettings?.[String(track.index)];
				const initTr = typeof s?.transpose === 'number' ? s.transpose : 0;
				transposeSlider.value = String(initTr);
			} catch {
				transposeSlider.value = '0';
			}
			const transposeValue = document.createElement('span');
			try {
				const s = savedTrackSettings?.[String(track.index)];
				transposeValue.textContent = String(
					typeof s?.transpose === 'number' ? s.transpose : 0
				);
			} catch {
				transposeValue.textContent = '0';
			}
			const transposeInput = document.createElement('input');
			transposeInput.type = 'number';
			transposeInput.min = '-12';
			transposeInput.max = '12';
			try {
				const s = savedTrackSettings?.[String(track.index)];
				transposeInput.value = String(typeof s?.transpose === 'number' ? s.transpose : 0);
			} catch {
				transposeInput.value = '0';
			}
			const updateTranspose = (newVal: number) => {
				const v = Math.max(-12, Math.min(12, newVal));
				if (this.api) {
					this.api.changeTrackTranspositionPitch([track], v);
					// 发送事件用于状态同步
					this.eventBus?.publish('track:transpose', {
						track,
						value: v,
					});
					const filePath = (this.api as any)?.score?.filePath;
					if (filePath && this.scorePersistenceService) {
						this.scorePersistenceService.saveTrackSettings(filePath, track.index, {
							transpose: v,
						});
					}
				}
				transposeSlider.value = String(v);
				transposeValue.textContent = String(v);
				transposeInput.value = String(v);
			};
			transposeSlider.oninput = (e) => {
				updateTranspose(Number((e.target as HTMLInputElement).value));
			};
			transposeInput.onchange = (e) => {
				updateTranspose(Number((e.target as HTMLInputElement).value));
			};
			transposeDiv.appendChild(transposeLabel);
			transposeDiv.appendChild(transposeSlider);
			transposeDiv.appendChild(transposeValue);
			transposeDiv.appendChild(transposeInput);
			trackSetting.settingEl.appendChild(transposeDiv);

			// 音频移调 滑块+数值+输入框（通过事件总线）
			const transposeAudioDiv = document.createElement('div');
			transposeAudioDiv.className = 'track-param-row';
			const transposeAudioLabel = document.createElement('span');
			transposeAudioLabel.textContent = t('tracks.audioTranspose');
			const transposeAudioSlider = document.createElement('input');
			transposeAudioSlider.type = 'range';
			transposeAudioSlider.min = '-12';
			transposeAudioSlider.max = '12';
			transposeAudioSlider.step = '1';
			try {
				const s = savedTrackSettings?.[String(track.index)];
				const initTa = typeof s?.transposeAudio === 'number' ? s.transposeAudio : 0;
				transposeAudioSlider.value = String(initTa);
			} catch {
				transposeAudioSlider.value = '0';
			}
			const transposeAudioValue = document.createElement('span');
			try {
				const s = savedTrackSettings?.[String(track.index)];
				transposeAudioValue.textContent = String(
					typeof s?.transposeAudio === 'number' ? s.transposeAudio : 0
				);
			} catch {
				transposeAudioValue.textContent = '0';
			}
			const transposeAudioInput = document.createElement('input');
			transposeAudioInput.type = 'number';
			transposeAudioInput.min = '-12';
			transposeAudioInput.max = '12';
			try {
				const s = savedTrackSettings?.[String(track.index)];
				transposeAudioInput.value = String(
					typeof s?.transposeAudio === 'number' ? s.transposeAudio : 0
				);
			} catch {
				transposeAudioInput.value = '0';
			}
			const updateTransposeAudio = (newVal: number) => {
				const v = Math.max(-12, Math.min(12, newVal));
				if (this.api) {
					// TODO: 等待 alphaTab API 支持音频移调
					// this.api.changeTrackAudioTransposition([track], v);
					// 发送事件用于状态同步
					this.eventBus?.publish('track:transposeAudio', {
						track,
						value: v,
					});
					const filePath = (this.api as any)?.score?.filePath;
					if (filePath && this.scorePersistenceService) {
						this.scorePersistenceService.saveTrackSettings(filePath, track.index, {
							transposeAudio: v,
						});
					}
				}
				transposeAudioSlider.value = String(v);
				transposeAudioValue.textContent = String(v);
				transposeAudioInput.value = String(v);
			};
			transposeAudioSlider.oninput = (e) => {
				updateTransposeAudio(Number((e.target as HTMLInputElement).value));
			};
			transposeAudioInput.onchange = (e) => {
				updateTransposeAudio(Number((e.target as HTMLInputElement).value));
			};
			transposeAudioDiv.appendChild(transposeAudioLabel);
			transposeAudioDiv.appendChild(transposeAudioSlider);
			transposeAudioDiv.appendChild(transposeAudioValue);
			transposeAudioDiv.appendChild(transposeAudioInput);
			trackSetting.settingEl.appendChild(transposeAudioDiv);
		});

		// 底部不再添加按钮
	}

	private onSelectTrack() {
		const selectTracks = Array.from(this.selectedTracks).sort((a, b) => a.index - b.index);
		// 持久化到 localStorage
		if (this.api && this.scorePersistenceService) {
			const filePath = (this.api as any)?.score?.filePath;
			if (filePath) {
				this.scorePersistenceService.saveSelectedTracks(filePath, selectTracks);
			}
		}
		// 这里不再批量处理，交由外部业务逻辑处理
		this.onChange?.(selectTracks);
	}

	onClose() {
		this.contentEl.empty();
	}

	setTracks(tracks: alphaTab.model.Track[]) {
		this.tracks = tracks;
		this.selectedTracks = new Set(tracks.length > 0 ? [tracks[0]] : []);
	}

	setRenderTracks(tracks: alphaTab.model.Track[]) {
		this.selectedTracks = new Set(tracks);
	}
}
