import { Modal, Setting, App, Notice } from "obsidian";
import * as alphaTab from "@coderline/alphatab";

export class TracksModal extends Modal {
    private tracks: alphaTab.model.Track[];
    private selectedTracks: Set<alphaTab.model.Track>;
    private onChange?: (tracks: alphaTab.model.Track[]) => void;

    constructor(app: App, tracks: alphaTab.model.Track[], onChange?: (tracks: alphaTab.model.Track[]) => void) {
        super(app);
        this.tracks = tracks;
        this.onChange = onChange;
        this.selectedTracks = new Set(tracks.length > 0 ? [tracks[0]] : []);
        this.modalEl.addClass("tracks-modal");
    }

    onOpen() {
        this.contentEl.empty();
        this.titleEl.setText("选择要显示的音轨");
        this.tracks.forEach((track) => {
            const trackSetting = new Setting(this.contentEl)
                .setName(track.name)
                .setDesc(track.shortName || `Track ${track.index + 1}`);

            // 选择音轨
            trackSetting.addToggle((toggle) => {
                toggle
                    .setValue(this.selectedTracks.has(track))
                    .onChange((value) => {
                        if (value) {
                            this.selectedTracks.add(track);
                        } else {
                            this.selectedTracks.delete(track);
                        }
                    });
            });

            // 静音/独奏按钮
            trackSetting.addExtraButton(btn => {
                btn.setIcon(track.playbackInfo.isSolo ? "headphones" : "headphones")
                    .setTooltip("独奏")
                    .onClick(() => {
                        track.playbackInfo.isSolo = !track.playbackInfo.isSolo;
                        if (typeof (track as any).api?.changeTrackSolo === "function") {
                            (track as any).api.changeTrackSolo([track], track.playbackInfo.isSolo);
                        }
                        btn.setIcon(track.playbackInfo.isSolo ? "headphones" : "headphones");
                    });
            });
            trackSetting.addExtraButton(btn => {
                btn.setIcon(track.playbackInfo.isMute ? "volume-x" : "volume-2")
                    .setTooltip("静音")
                    .onClick(() => {
                        track.playbackInfo.isMute = !track.playbackInfo.isMute;
                        if (typeof (track as any).api?.changeTrackMute === "function") {
                            (track as any).api.changeTrackMute([track], track.playbackInfo.isMute);
                        }
                        btn.setIcon(track.playbackInfo.isMute ? "volume-x" : "volume-2");
                    });
            });

            // 音量滑块+数值+输入框
            const volumeDiv = document.createElement("div");
            volumeDiv.style.display = "flex";
            volumeDiv.style.alignItems = "center";
            volumeDiv.style.gap = "0.5em";
            const volumeLabel = document.createElement("span");
            volumeLabel.textContent = "音量";
            const volumeSlider = document.createElement("input");
            volumeSlider.type = "range";
            volumeSlider.min = "0";
            volumeSlider.max = "16";
            volumeSlider.value = String(track.playbackInfo.volume);
            const volumeValue = document.createElement("span");
            volumeValue.textContent = String(track.playbackInfo.volume);
            const volumeInput = document.createElement("input");
            volumeInput.type = "number";
            volumeInput.min = "0";
            volumeInput.max = "16";
            volumeInput.value = String(track.playbackInfo.volume);
            volumeInput.style.width = "3em";
            // 事件同步
            const updateVolume = (newVolume: number) => {
                newVolume = Math.max(0, Math.min(16, newVolume));
                if (typeof (track as any).api?.changeTrackVolume === "function") {
                    (track as any).api.changeTrackVolume([track], newVolume / track.playbackInfo.volume);
                }
                track.playbackInfo.volume = newVolume;
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

            // 全局移调 滑块+数值+输入框
            const transposeDiv = document.createElement("div");
            transposeDiv.style.display = "flex";
            transposeDiv.style.alignItems = "center";
            transposeDiv.style.gap = "0.5em";
            const transposeLabel = document.createElement("span");
            transposeLabel.textContent = "全局移调";
            const transposeSlider = document.createElement("input");
            transposeSlider.type = "range";
            transposeSlider.min = "-12";
            transposeSlider.max = "12";
            transposeSlider.step = "1";
            transposeSlider.value = "0";
            const transposeValue = document.createElement("span");
            transposeValue.textContent = "0";
            const transposeInput = document.createElement("input");
            transposeInput.type = "number";
            transposeInput.min = "-12";
            transposeInput.max = "12";
            transposeInput.value = "0";
            transposeInput.style.width = "3em";
            const updateTranspose = (newVal: number) => {
                newVal = Math.max(-12, Math.min(12, newVal));
                (track as any).transposeFull = newVal;
                transposeSlider.value = String(newVal);
                transposeValue.textContent = String(newVal);
                transposeInput.value = String(newVal);
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

            // 音频移调 滑块+数值+输入框
            const transposeAudioDiv = document.createElement("div");
            transposeAudioDiv.style.display = "flex";
            transposeAudioDiv.style.alignItems = "center";
            transposeAudioDiv.style.gap = "0.5em";
            const transposeAudioLabel = document.createElement("span");
            transposeAudioLabel.textContent = "音频移调";
            const transposeAudioSlider = document.createElement("input");
            transposeAudioSlider.type = "range";
            transposeAudioSlider.min = "-12";
            transposeAudioSlider.max = "12";
            transposeAudioSlider.step = "1";
            transposeAudioSlider.value = "0";
            const transposeAudioValue = document.createElement("span");
            transposeAudioValue.textContent = "0";
            const transposeAudioInput = document.createElement("input");
            transposeAudioInput.type = "number";
            transposeAudioInput.min = "-12";
            transposeAudioInput.max = "12";
            transposeAudioInput.value = "0";
            transposeAudioInput.style.width = "3em";
            const updateTransposeAudio = (newVal: number) => {
                newVal = Math.max(-12, Math.min(12, newVal));
                (track as any).transposeAudio = newVal;
                transposeAudioSlider.value = String(newVal);
                transposeAudioValue.textContent = String(newVal);
                transposeAudioInput.value = String(newVal);
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

        new Setting(this.contentEl)
            .addButton((button) =>
                button
                    .setButtonText("应用")
                    .setCta()
                    .onClick(() => {
                        this.onSelectTrack();
                        this.close();
                    })
            )
            .addButton((button) =>
                button.setButtonText("取消").onClick(() => {
                    this.close();
                })
            );
    }

    private onSelectTrack() {
        const selectTracks = Array.from(this.selectedTracks).sort(
            (a, b) => a.index - b.index
        );
        // 处理音轨移调、音量等批量应用
        selectTracks.forEach(track => {
            // 处理音频移调
            if (typeof (track as any).api?.changeTrackTranspositionPitch === "function" && (track as any).transposeAudio !== undefined) {
                (track as any).api.changeTrackTranspositionPitch([track], (track as any).transposeAudio);
            }
            // 处理全局移调
            if ((track as any).transposeFull !== undefined && (track as any).api?.settings?.notation?.transpositionPitches) {
                const pitches = (track as any).api.settings.notation.transpositionPitches;
                while (pitches.length < track.index + 1) pitches.push(0);
                pitches[track.index] = (track as any).transposeFull;
                (track as any).api.updateSettings();
                (track as any).api.render();
            }
        });
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
