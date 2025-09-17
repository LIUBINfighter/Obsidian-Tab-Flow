import { Modal, Setting, App } from 'obsidian';
import * as alphaTab from '@coderline/alphatab';
import { EventBus } from '../utils';
import { TrackStateStore } from '../state/TrackStateStore';
import { t } from '../i18n';

export class TracksModal extends Modal {
  private selectedTracks: Set<alphaTab.model.Track>;
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

    // 读全局状态
    const globalState = this.filePath ? this.trackStateStore.getFileState(this.filePath) : {};
    const savedTrackSettings = globalState.trackSettings || {};
    if (globalState.selectedTracks?.length) {
      const set = new Set(globalState.selectedTracks);
      const match = this.tracks.filter(t => set.has(t.index));
      if (match.length) this.selectedTracks = new Set(match);
      else this.selectedTracks = new Set(this.tracks.length ? [this.tracks[0]] : []);
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

    const applySelectedToApi = () => {
      if (!this.api) return;
      const list = Array.from(this.selectedTracks).sort((a, b) => a.index - b.index);
      if (list.length) this.api.renderTracks(list as any);
      this.trackStateStore.setSelectedTracks(this.filePath, list.map(t => t.index));
      this.eventBus?.publish('track:selectedTracks', { tracks: list });
    };

    this.tracks.forEach(track => {
      const trackSetting = new Setting(scrollContainer)
        .setName(track.name)
        .setDesc(track.shortName || t('tracks.trackNumber', { number: track.index + 1 }));
      trackSetting.settingEl.classList.add('track-item');

      // 选择音轨 toggle -> 即时更新
      trackSetting.addToggle(toggle => {
        toggle.setValue(this.selectedTracks.has(track)).onChange(val => {
          if (val) this.selectedTracks.add(track); else {
            if (this.selectedTracks.size === 1) { // 保证至少一条
              toggle.setValue(true);
              return;
            }
            this.selectedTracks.delete(track);
          }
          applySelectedToApi();
        });
      });

      // === 独奏按钮 ===
      trackSetting.addExtraButton(btn => {
        const setting = savedTrackSettings[String(track.index)] || {};
        if (typeof setting.solo === 'boolean') (track.playbackInfo as any).isSolo = setting.solo;
        const updateUI = () => {
          const isSolo = (track.playbackInfo as any).isSolo;
          btn.setIcon(isSolo ? 'star' : 'star-off').setTooltip(isSolo ? t('tracks.unsolo') : t('tracks.solo'));
          btn.extraSettingsEl.toggleClass('active', !!isSolo);
        };
        updateUI();
        btn.onClick(() => {
          const newSolo = !(track.playbackInfo as any).isSolo;
          (track.playbackInfo as any).isSolo = newSolo;
            try { this.api.changeTrackSolo([track], newSolo); } catch { /* ignore solo error */ }
          this.trackStateStore.updateTrackSetting(this.filePath, track.index, { solo: newSolo });
          this.eventBus?.publish('track:solo', { track, value: newSolo });
          updateUI();
        });
        return btn;
      });

      // === 静音按钮 ===
      trackSetting.addExtraButton(btn => {
        const setting = savedTrackSettings[String(track.index)] || {};
        if (typeof setting.mute === 'boolean') (track.playbackInfo as any).isMute = setting.mute;
        const updateUI = () => {
          const isMute = (track.playbackInfo as any).isMute;
          btn.setIcon(isMute ? 'volume-x' : 'volume-2').setTooltip(isMute ? t('tracks.unmute') : t('tracks.mute'));
          btn.extraSettingsEl.toggleClass('active', !!isMute);
        };
        updateUI();
        btn.onClick(() => {
          const newMute = !(track.playbackInfo as any).isMute;
          (track.playbackInfo as any).isMute = newMute;
            try { this.api.changeTrackMute([track], newMute); } catch { /* ignore mute error */ }
          this.trackStateStore.updateTrackSetting(this.filePath, track.index, { mute: newMute });
          this.eventBus?.publish('track:mute', { track, value: newMute });
          updateUI();
        });
        return btn;
      });

      // === 音量 ===
      const volWrapper = document.createElement('div');
      volWrapper.className = 'track-param-row';
      const volLabel = document.createElement('span'); volLabel.textContent = t('tracks.volume');
      const volSlider = document.createElement('input'); volSlider.type = 'range'; volSlider.min = '0'; volSlider.max = '16';
      const curVol = typeof savedTrackSettings[String(track.index)]?.volume === 'number' ? savedTrackSettings[String(track.index)].volume : (track.playbackInfo as any).volume;
      volSlider.value = String(curVol ?? 8);
      const volValue = document.createElement('span'); volValue.textContent = volSlider.value;
      const volInput = document.createElement('input'); volInput.type = 'number'; volInput.min = '0'; volInput.max = '16'; volInput.value = volSlider.value;
      const applyVolume = (v: number) => {
        v = Math.max(0, Math.min(16, v));
        try { this.api.changeTrackVolume([track], v / 16); } catch { /* ignore volume error */ }
        this.trackStateStore.updateTrackSetting(this.filePath, track.index, { volume: v });
        this.eventBus?.publish('track:volume', { track, value: v });
        volSlider.value = String(v); volValue.textContent = String(v); volInput.value = String(v);
      };
      volSlider.oninput = e => applyVolume(Number((e.target as HTMLInputElement).value));
      volInput.onchange = e => applyVolume(Number((e.target as HTMLInputElement).value));
      volWrapper.appendChild(volLabel); volWrapper.appendChild(volSlider); volWrapper.appendChild(volValue); volWrapper.appendChild(volInput);
      trackSetting.settingEl.appendChild(volWrapper);

      // === 全局移调 ===
      const trWrapper = document.createElement('div'); trWrapper.className = 'track-param-row';
      const trLabel = document.createElement('span'); trLabel.textContent = t('tracks.globalTranspose');
      const trSlider = document.createElement('input'); trSlider.type = 'range'; trSlider.min='-12'; trSlider.max='12'; trSlider.step='1';
      const curTr = typeof savedTrackSettings[String(track.index)]?.transpose === 'number' ? savedTrackSettings[String(track.index)].transpose : 0;
      trSlider.value = String(curTr);
      const trValue = document.createElement('span'); trValue.textContent = trSlider.value;
      const trInput = document.createElement('input'); trInput.type='number'; trInput.min='-12'; trInput.max='12'; trInput.value = trSlider.value;
      const applyTranspose = (v:number) => {
        v = Math.max(-12, Math.min(12, v));
        try { this.api.changeTrackTranspositionPitch([track], v); } catch { /* ignore transpose error */ }
        this.trackStateStore.updateTrackSetting(this.filePath, track.index, { transpose: v });
        this.eventBus?.publish('track:transpose', { track, value: v });
        trSlider.value = String(v); trValue.textContent = String(v); trInput.value = String(v);
      };
      trSlider.oninput = e => applyTranspose(Number((e.target as HTMLInputElement).value));
      trInput.onchange = e => applyTranspose(Number((e.target as HTMLInputElement).value));
      trWrapper.appendChild(trLabel); trWrapper.appendChild(trSlider); trWrapper.appendChild(trValue); trWrapper.appendChild(trInput);
      trackSetting.settingEl.appendChild(trWrapper);

      // === 音频移调（逻辑） ===
      const taWrapper = document.createElement('div'); taWrapper.className='track-param-row';
      const taLabel = document.createElement('span'); taLabel.textContent = t('tracks.audioTranspose');
      const taSlider = document.createElement('input'); taSlider.type='range'; taSlider.min='-12'; taSlider.max='12'; taSlider.step='1';
      const curTa = typeof savedTrackSettings[String(track.index)]?.transposeAudio === 'number' ? savedTrackSettings[String(track.index)].transposeAudio : 0;
      taSlider.value = String(curTa);
      const taValue = document.createElement('span'); taValue.textContent = taSlider.value;
      const taInput = document.createElement('input'); taInput.type='number'; taInput.min='-12'; taInput.max='12'; taInput.value = taSlider.value;
      const applyTa = (v:number) => {
        v = Math.max(-12, Math.min(12, v));
        // 暂无 API；仅存储逻辑值
        this.trackStateStore.updateTrackSetting(this.filePath, track.index, { transposeAudio: v });
        this.eventBus?.publish('track:transposeAudio', { track, value: v });
        taSlider.value = String(v); taValue.textContent = String(v); taInput.value = String(v);
      };
      taSlider.oninput = e => applyTa(Number((e.target as HTMLInputElement).value));
      taInput.onchange = e => applyTa(Number((e.target as HTMLInputElement).value));
      taWrapper.appendChild(taLabel); taWrapper.appendChild(taSlider); taWrapper.appendChild(taValue); taWrapper.appendChild(taInput);
      trackSetting.settingEl.appendChild(taWrapper);
    });

    // === 底部操作区：恢复默认按钮（仅清除存储，不主动改动当前播放状态） ===
    const footer = document.createElement('div');
    footer.className = 'tracks-footer-actions';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'mod-warning';
    resetBtn.textContent = t('tracks.resetToDefaults', undefined, '恢复默认');
    resetBtn.onclick = () => {
      try {
        // 仅清除持久化数据；保留当前界面和播放器即时状态
        this.trackStateStore.clearFile(this.filePath);
        // 不修改 this.api 当前状态，用户关闭后重新打开或重新加载文件时会按默认（或当前 API 实际）表现
        // 给出轻量反馈（可选）
        // new Notice('已清除持久化音轨状态'); // 如需要可放开
      } catch (e) {
        console.warn('[TracksModal] 重置轨道状态失败', e);
      }
    };
    footer.appendChild(resetBtn);
    this.contentEl.appendChild(footer);
  }

  onClose() {
    this.contentEl.empty();
  }
}
