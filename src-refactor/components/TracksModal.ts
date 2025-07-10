import { Modal, Setting, App, Notice } from "obsidian";
import * as alphaTab from "@coderline/alphatab";
import type { TrackEventPayload, TrackEventType } from "../events/trackEvents";
import type { UIEventType } from "../events/types";
import { dispatchUIEvent } from "../events/dispatch";


export class TracksModal extends Modal {
    private selectedTracks: Set<alphaTab.model.Track>;

    constructor(
        app: App,
        private tracks: alphaTab.model.Track[],
        private onChange?: (tracks: alphaTab.model.Track[]) => void,
        private onTrackEvent?: (payload: TrackEventPayload) => void
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
            trackSetting.addExtraButton(btn => {
                btn.setIcon(track.playbackInfo.isSolo ? "headphones" : "headphones")
                    .setTooltip("独奏")
                    .onClick(() => {
                        const newSolo = !track.playbackInfo.isSolo;
                        track.playbackInfo.isSolo = newSolo;
                        this.onTrackEvent
                          ? this.onTrackEvent({ type: "solo", track, value: newSolo })
                          : dispatchUIEvent((window as any).alphaTabApi, { domain: "track", type: "solo", payload: { type: "solo", track, value: newSolo } });
                        btn.setIcon(newSolo ? "headphones" : "headphones");
                    });
            });
            // 静音按钮
            trackSetting.addExtraButton(btn => {
                btn.setIcon(track.playbackInfo.isMute ? "volume-x" : "volume-2")
                    .setTooltip("静音")
                    .onClick(() => {
                        const newMute = !track.playbackInfo.isMute;
                        track.playbackInfo.isMute = newMute;
                        this.onTrackEvent
                          ? this.onTrackEvent({ type: "mute", track, value: newMute })
                          : dispatchUIEvent((window as any).alphaTabApi, { domain: "track", type: "mute", payload: { type: "mute", track, value: newMute } });
                        btn.setIcon(newMute ? "volume-x" : "volume-2");
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
                this.onTrackEvent
                  ? this.onTrackEvent({ type: "volume", track, value: newVolume })
                  : dispatchUIEvent((window as any).alphaTabApi, { domain: "track", type: "volume", payload: { type: "volume", track, value: newVolume } });
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
                const v = Math.max(-12, Math.min(12, newVal));
                this.onTrackEvent
                  ? this.onTrackEvent({ type: "transpose", track, value: v })
                  : dispatchUIEvent((window as any).alphaTabApi, { domain: "track", type: "transpose", payload: { type: "transpose", track, value: v } });
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
                const v = Math.max(-12, Math.min(12, newVal));
                this.onTrackEvent
                  ? this.onTrackEvent({ type: "transposeAudio", track, value: v })
                  : dispatchUIEvent((window as any).alphaTabApi, { domain: "track", type: "transposeAudio", payload: { type: "transposeAudio", track, value: v } });
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
