import { Modal, Setting, App } from "obsidian";
import * as alphaTab from "@coderline/alphatab";
import type { TrackEventPayload } from "../events/trackEvents";
import { EventBus } from "../utils/EventBus";

export class TracksModal extends Modal {
    private selectedTracks: Set<alphaTab.model.Track>;

    constructor(
        app: App,
        private tracks: alphaTab.model.Track[],
        private onChange?: (tracks: alphaTab.model.Track[]) => void,
        private api?: alphaTab.AlphaTabApi,
        private eventBus?: EventBus
    ) {
        super(app);
        this.selectedTracks = new Set(tracks.length > 0 ? [tracks[0]] : []);
        this.modalEl.addClass("tracks-modal");
    }

    onOpen() {
        this.contentEl.empty();
        this.titleEl.setText("");
        // 创建标题栏容器
        const titleBar = document.createElement("div");
        titleBar.style.display = "flex";
        titleBar.style.alignItems = "center";
        titleBar.style.justifyContent = "space-between";
        titleBar.style.marginBottom = "1em";
        titleBar.style.position = "sticky";
        titleBar.style.top = "0";
        titleBar.style.background = "var(--background-primary, #fff)";
        titleBar.style.zIndex = "10";
        // 标题
        const titleText = document.createElement("span");
        titleText.textContent = "选择要显示的音轨";
        titleText.style.fontWeight = "bold";
        // 按钮容器
        const btnGroup = document.createElement("div");
        btnGroup.style.display = "flex";
        btnGroup.style.gap = "0.5em";
        // 应用按钮
        const applyBtn = document.createElement("button");
        applyBtn.textContent = "应用";
        applyBtn.className = "mod-cta";
        applyBtn.onclick = () => {
            this.onSelectTrack();
            this.close();
        };
        // 取消按钮
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "取消";
        cancelBtn.onclick = () => {
            this.close();
        };
        btnGroup.appendChild(applyBtn);
        btnGroup.appendChild(cancelBtn);
        titleBar.appendChild(titleText);
        titleBar.appendChild(btnGroup);
        this.titleEl.appendChild(titleBar);

        // 创建滚动容器
        const scrollContainer = document.createElement("div");
        scrollContainer.style.overflowY = "auto";
        scrollContainer.style.maxHeight = "50vh";
        scrollContainer.style.paddingRight = "4px";
        // 可根据需要调整 maxHeight

        this.contentEl.appendChild(scrollContainer);

        this.tracks.forEach((track) => {
            const trackSetting = new Setting(scrollContainer)
                .setName(track.name)
                .setDesc(track.shortName || `Track ${track.index + 1}`);
            
            // 为每个轨道的setting添加CSS类
            trackSetting.settingEl.addClass("track-item");

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
            // 独奏按钮
            const soloBtn = trackSetting.addExtraButton(btn => {
                const updateSoloUI = () => {
                    const isSolo = track.playbackInfo.isSolo;
                    btn.setIcon(isSolo ? "star" : "star-off")
                        .setTooltip(isSolo ? "取消独奏" : "独奏");
                    btn.extraSettingsEl.toggleClass("active", isSolo);
                };
                
                updateSoloUI();
                
                btn.onClick(() => {
                    const newSolo = !track.playbackInfo.isSolo;
                    // 更新轨道状态
                    track.playbackInfo.isSolo = newSolo;
                    
                    if (this.api) {
                        this.api.changeTrackSolo([track], newSolo);
                        // 发送事件用于状态同步
                        this.eventBus?.publish("track:solo", { track, value: newSolo });
                    }
                    
                    // 更新UI
                    updateSoloUI();
                });
                
                return btn;
            });
            
            // 静音按钮
            const muteBtn = trackSetting.addExtraButton(btn => {
                const updateMuteUI = () => {
                    const isMute = track.playbackInfo.isMute;
                    btn.setIcon(isMute ? "volume-x" : "volume-2")
                        .setTooltip(isMute ? "取消静音" : "静音");
                    btn.extraSettingsEl.toggleClass("active", isMute);
                };
                
                updateMuteUI();
                
                btn.onClick(() => {
                    const newMute = !track.playbackInfo.isMute;
                    // 更新轨道状态
                    track.playbackInfo.isMute = newMute;
                    
                    if (this.api) {
                        this.api.changeTrackMute([track], newMute);
                        // 发送事件用于状态同步
                        this.eventBus?.publish("track:mute", { track, value: newMute });
                    }
                    
                    // 更新UI
                    updateMuteUI();
                });
                
                return btn;
            });

            // 音量滑块+数值+输入框（通过事件总线）
            const volumeDiv = document.createElement("div");
            volumeDiv.className = "track-param-row";
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
            // 事件同步
            const updateVolume = (newVolume: number) => {
                newVolume = Math.max(0, Math.min(16, newVolume));
                if (this.api) {
                    // alphaTab 期望 0-1 的音量值
                    this.api.changeTrackVolume([track], newVolume / 16);
                    // 发送事件用于状态同步
                    this.eventBus?.publish("track:volume", { track, value: newVolume });
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
            const transposeDiv = document.createElement("div");
            transposeDiv.className = "track-param-row";
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
            const updateTranspose = (newVal: number) => {
                const v = Math.max(-12, Math.min(12, newVal));
                if (this.api) {
                    this.api.changeTrackTranspositionPitch([track], v);
                    // 发送事件用于状态同步
                    this.eventBus?.publish("track:transpose", { track, value: v });
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
            const transposeAudioDiv = document.createElement("div");
            transposeAudioDiv.className = "track-param-row";
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
            const updateTransposeAudio = (newVal: number) => {
                const v = Math.max(-12, Math.min(12, newVal));
                if (this.api) {
                    // TODO: 等待 alphaTab API 支持音频移调
                    // this.api.changeTrackAudioTransposition([track], v);
                    // 发送事件用于状态同步
                    this.eventBus?.publish("track:transposeAudio", { track, value: v });
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
        const selectTracks = Array.from(this.selectedTracks).sort(
            (a, b) => a.index - b.index
        );
        // 处理音轨移调、音量等批量应用
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
