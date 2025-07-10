import { Notice } from "obsidian";
import * as alphaTab from "@coderline/alphatab";
import type { PlayerEventPayload, PlayerEventType } from "../events/playerEvents";
import type { UIEventType } from "../events/types";
import { dispatchUIEvent } from "../events/dispatch";

export interface DebugBarOptions {
    api: alphaTab.AlphaTabApi;
    isAudioLoaded: () => boolean;
    onTrackModal: () => void;
}

export function createDebugBar(options: DebugBarOptions): HTMLDivElement {
    const { api, isAudioLoaded, onTrackModal } = options;
    const debugBar = document.createElement("div");
    debugBar.className = "debug-bar";

    // TrackModal 按钮
    const tracksBtn = document.createElement("button");
    tracksBtn.innerText = "选择音轨";
    tracksBtn.onclick = onTrackModal;
    debugBar.appendChild(tracksBtn);

    // 播放/暂停按钮
    const playPause = document.createElement("button");
    playPause.innerText = "播放/暂停";
    playPause.onclick = () => {
        if (!api) {
            new Notice("AlphaTab API 未初始化");
            return;
        }
        if (!isAudioLoaded()) {
            new Notice("音频资源未加载，无法播放。请等待音频加载完成。");
            return;
        }
        dispatchUIEvent(api, { domain: "player", type: "playPause", payload: { type: "playPause" } });
    };
    debugBar.appendChild(playPause);

    // 停止按钮
    const stopBtn = document.createElement("button");
    stopBtn.innerText = "停止";
    stopBtn.onclick = () => {
        if (!api) {
            new Notice("AlphaTab API 未初始化");
            return;
        }
        if (!isAudioLoaded()) {
            new Notice("音频资源未加载，无法停止");
            return;
        }
        dispatchUIEvent(api, { domain: "player", type: "stop", payload: { type: "stop" } });
    };
    debugBar.appendChild(stopBtn);

    // 速度选择
    const speedLabel = document.createElement("label");
    speedLabel.innerText = "速度:";
    speedLabel.style.marginLeft = "1em";
    debugBar.appendChild(speedLabel);
    const speedSelect = document.createElement("select");
    ["0.5", "0.75", "1.0", "1.25", "1.5", "2.0"].forEach(val => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.innerText = val + "x";
        if (val === "1.0") opt.selected = true;
        speedSelect.appendChild(opt);
    });
    speedSelect.onchange = () => {
        if (!api) return;
        const speed = parseFloat(speedSelect.value);
        if (!isNaN(speed)) {
            dispatchUIEvent(api, { domain: "player", type: "setSpeed", payload: { type: "setSpeed", value: speed } });
        }
    };
    debugBar.appendChild(speedSelect);

    // 谱表模式切换
    const staveLabel = document.createElement("label");
    staveLabel.innerText = "谱表:";
    staveLabel.style.marginLeft = "1em";
    debugBar.appendChild(staveLabel);
    const staveSelect = document.createElement("select");
    const staveProfiles = [
        { name: "五线+六线", value: alphaTab.StaveProfile.ScoreTab },
        { name: "仅五线谱", value: alphaTab.StaveProfile.Score },
        { name: "仅六线谱", value: alphaTab.StaveProfile.Tab },
        { name: "混合六线谱", value: alphaTab.StaveProfile.TabMixed },
    ];
    staveProfiles.forEach((item, idx) => {
        const opt = document.createElement("option");
        opt.value = String(item.value);
        opt.innerText = item.name;
        if (idx === 0) opt.selected = true;
        staveSelect.appendChild(opt);
    });
    staveSelect.onchange = () => {
        if (!api) return;
        const val = parseInt(staveSelect.value);
        dispatchUIEvent(api, { domain: "player", type: "setStaveProfile", payload: { type: "setStaveProfile", value: val } });
    };
    debugBar.appendChild(staveSelect);

    // Metronome 节拍器开关
    const metronomeLabel = document.createElement("label");
    metronomeLabel.innerText = "节拍器:";
    metronomeLabel.style.marginLeft = "1em";
    debugBar.appendChild(metronomeLabel);
    const metronomeToggle = document.createElement("input");
    metronomeToggle.type = "checkbox";
    metronomeToggle.checked = false;
    // 初始同步 API
    if (api) api.metronomeVolume = 0;
    metronomeToggle.onchange = () => {
        if (!api) return;
        dispatchUIEvent(api, { domain: "player", type: "setMetronome", payload: { type: "setMetronome", value: metronomeToggle.checked } });
    };
    debugBar.appendChild(metronomeToggle);

    // Count-in 预备拍开关
    const countInLabel = document.createElement("label");
    countInLabel.innerText = "预备拍:";
    countInLabel.style.marginLeft = "1em";
    debugBar.appendChild(countInLabel);
    const countInToggle = document.createElement("input");
    countInToggle.type = "checkbox";
    countInToggle.checked = false;
    // 初始同步 API
    if (api) api.countInVolume = 0;
    countInToggle.onchange = () => {
        if (!api) return;
        dispatchUIEvent(api, { domain: "player", type: "setCountIn", payload: { type: "setCountIn", value: countInToggle.checked } });
    };
    debugBar.appendChild(countInToggle);

    // Zoom 缩放滑块
    const zoomLabel = document.createElement("label");
    zoomLabel.innerText = "缩放:";
    zoomLabel.style.marginLeft = "1em";
    debugBar.appendChild(zoomLabel);
    const zoomSlider = document.createElement("input");
    zoomSlider.type = "range";
    zoomSlider.min = "0.5";
    zoomSlider.max = "2.0";
    zoomSlider.step = "0.05";
    zoomSlider.value = "1.0";
    zoomSlider.style.width = "80px";
    zoomSlider.oninput = () => {
        if (!api) return;
        dispatchUIEvent(api, { domain: "player", type: "setZoom", payload: { type: "setZoom", value: parseFloat(zoomSlider.value) } });
    };
    debugBar.appendChild(zoomSlider);

    // 导出相关按钮
    const exportLabel = document.createElement("label");
    exportLabel.innerText = "导出:";
    exportLabel.style.marginLeft = "1em";
    debugBar.appendChild(exportLabel);

    // 动态加载导出事件注册器
    let exportHandlers: any = null;
    function ensureExportHandlers() {
        if (!exportHandlers) {
            // 动态 require，避免循环依赖
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { registerExportEventHandlers } = require("../events/exportEvents");
            exportHandlers = registerExportEventHandlers({
                api,
                getFileName: () => {
                    if (api.score && api.score.title) return api.score.title;
                    return "Untitled";
                },
                onExportStart: (type: string) => {
                    console.debug(`[Export] 开始导出: ${type}`);
                },
                onExportFinish: (type: string, success: boolean, msg?: string) => {
                    if (success) {
                        console.debug(`[Export] 导出${type}成功`);
                    } else {
                        console.debug(`[Export] 导出${type}失败: ${msg || "未知错误"}`);
                    }
                }
            });
        }
        return exportHandlers;
    }

    // 音频导出按钮
    const audioBtn = document.createElement("button");
    audioBtn.innerText = "导出音频";
    audioBtn.onclick = () => {
        ensureExportHandlers().exportAudio();
    };
    debugBar.appendChild(audioBtn);

    // MIDI 导出按钮
    const midiBtn = document.createElement("button");
    midiBtn.innerText = "导出MIDI";
    midiBtn.onclick = () => {
        ensureExportHandlers().exportMidi();
    };
    debugBar.appendChild(midiBtn);

    // GP 导出按钮
    const gpBtn = document.createElement("button");
    gpBtn.innerText = "导出GP";
    gpBtn.onclick = () => {
        ensureExportHandlers().exportGp();
    };
    debugBar.appendChild(gpBtn);

    // PDF 打印按钮
    const pdfBtn = document.createElement("button");
    pdfBtn.innerText = "打印PDF";
    pdfBtn.onclick = () => {
        ensureExportHandlers().exportPdf();
    };
    debugBar.appendChild(pdfBtn);

    // 音频状态（由外部负责更新）
    const audioStatus = document.createElement("span");
    audioStatus.style.marginLeft = "1em";
    audioStatus.style.fontSize = "0.9em";
    audioStatus.innerText = "音频：未加载";
    debugBar.appendChild(audioStatus);

    // 提供音频状态元素给外部更新
    (debugBar as any).audioStatus = audioStatus;

    return debugBar;
}
