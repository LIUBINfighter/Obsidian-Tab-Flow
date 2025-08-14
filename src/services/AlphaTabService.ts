
import * as alphaTab from "@coderline/alphatab";
import { App } from "obsidian";
import { EventBus } from "../utils/EventBus";
import { ScrollConfigProxy } from "../services/ScrollConfigProxy";
import * as convert from "color-convert";

export class AlphaTabService {
    private api: alphaTab.AlphaTabApi;
    private scrollProxy: ScrollConfigProxy;
    private eventBus: EventBus;
    private app: App;
    private element: HTMLElement;
    private resources: { alphaTabWorkerUri: string; soundFontUri: string; bravuraUri: string };

    constructor(
        app: App,
        element: HTMLElement,
        resources: { alphaTabWorkerUri: string; soundFontUri: string; bravuraUri: string },
        eventBus: EventBus
    ) {
        this.app = app;
        this.eventBus = eventBus;
        this.element = element;
        this.resources = resources;

        // 获取当前元素的计算样式用于暗色适配
        const style = window.getComputedStyle(element);

        this.api = new alphaTab.AlphaTabApi(element, {
            core: { scriptFile: resources.alphaTabWorkerUri, smuflFontSources: (resources.bravuraUri ? new Map([[((alphaTab as any).rendering?.glyphs?.FontFileFormat?.Woff2 ?? 0), resources.bravuraUri]]) : new Map()) as unknown as Map<number, string>, fontDirectory: "" },
            player: {
                enablePlayer: true,
                playerMode: alphaTab.PlayerMode.EnabledAutomatic,
                enableCursor: true,
                enableAnimatedBeatCursor: true,
                soundFont: resources.soundFontUri,
                scrollMode: alphaTab.ScrollMode.Continuous,
                scrollSpeed: 500,
                scrollOffsetY: -25,
                scrollOffsetX: 25,
                nativeBrowserSmoothScroll: false,
            },
            display: {
                resources: {
                    mainGlyphColor: style.getPropertyValue("--color-base-100"),
                    secondaryGlyphColor: style.getPropertyValue("--color-base-60"),
                    staffLineColor: style.getPropertyValue("--color-base-40"),
                    barSeparatorColor: style.getPropertyValue("--color-base-40"),
                    barNumberColor:
                        "#" +
                        convert.hsl.hex([
                            parseFloat(style.getPropertyValue("--accent-h")),
                            parseFloat(style.getPropertyValue("--accent-s")),
                            parseFloat(style.getPropertyValue("--accent-l")),
                        ]),
                    scoreInfoColor: style.getPropertyValue("--color-base-100"),
                },
            },
        });
        this.scrollProxy = new ScrollConfigProxy(this.api);

        this.registerCommandHandlers();
        this.registerApiListeners();
    }

    private registerCommandHandlers() {
        // 轨道相关事件订阅（从 TabView.ts 剪切过来）
        // 4. 订阅"命令:选择音轨"事件，弹出 TracksModal
        this.eventBus.subscribe("命令:选择音轨", () => {
            // 动态加载 TracksModal
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { TracksModal } = require("../components/TracksModal");
            const api = this.getApi();
            const tracks = api.score?.tracks || [];
            if (!tracks.length) {
                // 这里只做简单兼容
                // Notice 需从 obsidian 导入
                // @ts-ignore
                let Notice: any = undefined;
                try {
                    Notice = (require("obsidian") as { Notice: any }).Notice;
                } catch {}
                if (Notice) {
                    new Notice("没有可用的音轨");
                } else {
                    console.warn("没有可用的音轨");
                }
                return;
            }
            const modal = new TracksModal(
                this.app, // 传递真实 app 实例
                tracks,
                (selectedTracks: any[]) => {
                    if (selectedTracks && selectedTracks.length > 0) {
                        // 只渲染选中的音轨
                        api.renderTracks(selectedTracks as any);
                    }
                },
                api,
                this.eventBus
            );
            modal.open();
        });
        // 选择音轨事件（弹出轨道选择 Modal）
        this.eventBus.subscribe("命令:选择音轨", () => {
            // 这里建议通过事件流让 TabView 或主插件弹出 TracksModal
            // 例如 eventBus.publish("UI:显示TracksModal")，此处仅做占位
            console.debug("[AlphaTabService] 收到选择音轨命令，建议由上层 UI 处理弹窗");
        });
        this.eventBus.subscribe("命令:播放暂停", () => this.api.playPause());
        this.eventBus.subscribe("命令:停止", () => this.api.stop());
        this.eventBus.subscribe("命令:设置速度", (speed: number) => { this.api.playbackSpeed = speed; });
        this.eventBus.subscribe("命令:设置谱表", (profile: number) => {
            this.api.settings.display.staveProfile = profile;
            this.api.updateSettings();
            this.api.render();
        });
        this.eventBus.subscribe("命令:设置节拍器", (enabled: boolean) => {
            this.api.metronomeVolume = enabled ? 1 : 0;
        });
        this.eventBus.subscribe("命令:设置预备拍", (enabled: boolean) => {
            this.api.countInVolume = enabled ? 1 : 0;
        });
        this.eventBus.subscribe("命令:设置缩放", (scale: number) => {
            this.api.settings.display.scale = scale;
            this.api.updateSettings();
            this.api.render();
        });
        // 滚动相关
        this.eventBus.subscribe("命令:设置滚动模式", (mode: number) => this.scrollProxy.setScrollMode(mode));
        this.eventBus.subscribe("命令:设置滚动速度", (speed: number) => this.scrollProxy.setScrollSpeed(speed));
        this.eventBus.subscribe("命令:设置Y偏移", (offset: number) => this.scrollProxy.setScrollOffsetY(offset));
        this.eventBus.subscribe("命令:设置X偏移", (offset: number) => this.scrollProxy.setScrollOffsetX(offset));
        this.eventBus.subscribe("命令:设置原生滚动", (enabled: boolean) => this.scrollProxy.setNativeBrowserSmoothScroll(enabled));
        this.eventBus.subscribe("命令:滚动到光标", () => this.scrollProxy.triggerScrollToCursor());
        // 新增：布局切换事件
        this.eventBus.subscribe("命令:切换布局", (layoutMode: number) => {
            if (this.api.settings && this.api.settings.display) {
                this.api.settings.display.layoutMode = layoutMode;
                this.api.updateSettings();
                this.api.render();
            }
        });
        // 新增：刷新播放器（重新渲染当前乐谱）
        this.eventBus.subscribe("命令:刷新播放器", () => {
            try {
                if ((this.api as any)?.score) {
                    // 方案A：仅强制渲染
                    this.api.render();
                }
            } catch (e) {
                console.warn("[AlphaTabService] 刷新播放器失败:", e);
            }
        });
        // 音频导出事件
        this.eventBus.subscribe("命令:导出音频", async (payload?: { fileName?: string } & Partial<alphaTab.synth.AudioExportOptions>) => {
            try {
                const { fileName, ...options } = payload || {};
                const wavUrl = await this.exportAudioToWav(options);
                this.eventBus.publish("状态:音频导出完成", wavUrl);
            } catch (e) {
                this.eventBus.publish("状态:音频导出失败", e);
            }
        });
        // 新增：导出 MIDI / PDF / GP 事件
        this.eventBus.subscribe("命令:导出MIDI", (payload?: { fileName?: string }) => {
            try {
                // 动态注册并执行
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { registerExportEventHandlers } = require("../events/exportEvents");
                const handlers = registerExportEventHandlers({
                    api: this.api,
                    getFileName: () => {
                        const p = (payload?.fileName || '').trim();
                        if (p) return p;
                        const t = this.api?.score?.title;
                        return (t && String(t).trim()) || "Untitled";
                    },
                    app: this.app,
                });
                handlers.exportMidi();
            } catch (e) {
                console.warn("[AlphaTabService] 导出MIDI失败:", e);
            }
        });
        this.eventBus.subscribe("命令:导出PDF", (payload?: { fileName?: string }) => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { registerExportEventHandlers } = require("../events/exportEvents");
                const handlers = registerExportEventHandlers({
                    api: this.api,
                    getFileName: () => {
                        const p = (payload?.fileName || '').trim();
                        if (p) return p;
                        const t = this.api?.score?.title;
                        return (t && String(t).trim()) || "Untitled";
                    },
                    app: this.app,
                });
                handlers.exportPdf();
            } catch (e) {
                console.warn("[AlphaTabService] 导出PDF失败:", e);
            }
        });
        this.eventBus.subscribe("命令:导出GP", (payload?: { fileName?: string }) => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { registerExportEventHandlers } = require("../events/exportEvents");
                const handlers = registerExportEventHandlers({
                    api: this.api,
                    getFileName: () => {
                        const p = (payload?.fileName || '').trim();
                        if (p) return p;
                        const t = this.api?.score?.title;
                        return (t && String(t).trim()) || "Untitled";
                    },
                    app: this.app,
                });
                handlers.exportGp();
            } catch (e) {
                console.warn("[AlphaTabService] 导出GP失败:", e);
            }
        });
        // 命令：加载乐谱（传入 Uint8Array 或 ArrayBuffer）
        this.eventBus.subscribe("命令:加载乐谱", async (data: Uint8Array | ArrayBuffer) => {
            try {
                const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
                await this.loadScore(bytes);
                this.eventBus.publish("状态:乐谱已加载");
            } catch (e) {
                this.eventBus.publish("状态:加载失败", e);
            }
        });
        // 命令：重新构造 AlphaTabApi
        this.eventBus.subscribe("命令:重建AlphaTabApi", () => {
            this.reconstructApi();
        });
        // 轨道事件处理 - 用于状态同步和日志记录
        this.eventBus.subscribe("track:solo", (data: { track: Record<string, unknown>, value: boolean }) => {
            console.debug(`[AlphaTabService] 轨道 ${data.track.name} 独奏状态: ${data.value}`);
        });
        this.eventBus.subscribe("track:mute", (data: { track: Record<string, unknown>, value: boolean }) => {
            console.debug(`[AlphaTabService] 轨道 ${data.track.name} 静音状态: ${data.value}`);
        });
        this.eventBus.subscribe("track:volume", (data: { track: Record<string, unknown>, value: number }) => {
            console.debug(`[AlphaTabService] 轨道 ${data.track.name} 音量: ${data.value}`);
        });
        this.eventBus.subscribe("track:transpose", (data: { track: Record<string, unknown>, value: number }) => {
            console.debug(`[AlphaTabService] 轨道 ${data.track.name} 移调: ${data.value}`);
        });
        this.eventBus.subscribe("track:transposeAudio", (data: { track: Record<string, unknown>, value: number }) => {
            console.debug(`[AlphaTabService] 轨道 ${data.track.name} 音频移调: ${data.value}`);
        });
    }

    private registerApiListeners() {
        this.api.playerReady.on(() => this.eventBus.publish("状态:音频就绪"));
        this.api.error.on((err) => this.eventBus.publish("状态:错误", err));
        // 可继续补充其它 alphaTab 事件的监听和广播
    }

    public async loadScore(fileData: Uint8Array) {
        await this.api.load(fileData);
    }

    /**
     * 获取内部 API 实例 (仅用于兼容旧代码)
     */
    public getApi(): alphaTab.AlphaTabApi {
        return this.api;
    }

    public destroy() {
        this.api.destroy();
        this.scrollProxy.destroy();
    }

    /**
     * 重新构造 AlphaTabApi（不重复注册命令订阅，仅重建 API 和其事件监听）
     */
    public reconstructApi(): void {
        try {
            if (this.api) {
                try { this.api.destroy(); } catch {}
            }
            if (this.scrollProxy) {
                try { this.scrollProxy.destroy(); } catch {}
            }
            const style = window.getComputedStyle(this.element);
            this.api = new alphaTab.AlphaTabApi(this.element, {
                core: { scriptFile: this.resources.alphaTabWorkerUri, smuflFontSources: (this.resources.bravuraUri ? new Map([[((alphaTab as any).rendering?.glyphs?.FontFileFormat?.Woff2 ?? 0), this.resources.bravuraUri]]) : new Map()) as unknown as Map<number, string>, fontDirectory: "" },
                player: {
                    enablePlayer: true,
                    playerMode: alphaTab.PlayerMode.EnabledAutomatic,
                    enableCursor: true,
                    enableAnimatedBeatCursor: true,
                    soundFont: this.resources.soundFontUri,
                    scrollMode: alphaTab.ScrollMode.Continuous,
                    scrollSpeed: 500,
                    scrollOffsetY: -25,
                    scrollOffsetX: 25,
                    nativeBrowserSmoothScroll: false,
                },
                display: {
                    resources: {
                        mainGlyphColor: style.getPropertyValue("--color-base-100"),
                        secondaryGlyphColor: style.getPropertyValue("--color-base-60"),
                        staffLineColor: style.getPropertyValue("--color-base-40"),
                        barSeparatorColor: style.getPropertyValue("--color-base-40"),
                        barNumberColor:
                            "#" +
                            convert.hsl.hex([
                                parseFloat(style.getPropertyValue("--accent-h")),
                                parseFloat(style.getPropertyValue("--accent-s")),
                                parseFloat(style.getPropertyValue("--accent-l")),
                            ]),
                        scoreInfoColor: style.getPropertyValue("--color-base-100"),
                    },
                },
            });
            this.scrollProxy = new ScrollConfigProxy(this.api);
            this.registerApiListeners();
            // 将新 API 上报给外界：某些组件直接持有 _api 引用
            this.eventBus.publish("状态:API已重建", this.api);
        } catch (e) {
            console.warn("[AlphaTabService] 重建 AlphaTabApi 失败:", e);
        }
    }

    /**
     * 配置滚动元素
     */
    public configureScrollElement(scrollElement?: HTMLElement | string): void {
        if (this.api.settings.player) {
            this.api.settings.player.scrollElement = scrollElement || "html,body";
            this.api.updateSettings();
            console.debug("[AlphaTabService] 滚动元素已配置:", scrollElement);
        }
    }
    /**
     * 导出音频并返回 WAV Blob URL
     */
    public async exportAudioToWav(options?: Partial<alphaTab.synth.AudioExportOptions>): Promise<string> {
        const exportOptions = new alphaTab.synth.AudioExportOptions();
        Object.assign(exportOptions, options);
        const exporter = await this.api.exportAudio(exportOptions);
        const chunks: Float32Array[] = [];
        try {
            while (true) {
                const chunk = await exporter.render(500);
                if (!chunk) break;
                chunks.push(chunk.samples);
            }
        } finally {
            exporter.destroy();
        }
        return this.convertSamplesToWavBlobUrl(chunks, exportOptions.sampleRate);
    }

    private convertSamplesToWavBlobUrl(chunks: Float32Array[], sampleRate: number): string {
        const samples = chunks.reduce((p, c) => p + c.length, 0);
        const wavHeaderSize = 44;
        const fileSize = wavHeaderSize + samples * 4;
        // @ts-ignore
        const buffer = alphaTab.io.ByteBuffer.withCapacity(fileSize);

        // RIFF chunk
        buffer.write(new Uint8Array([0x52, 0x49, 0x46, 0x46]), 0, 4); // RIFF
        // @ts-ignore
        alphaTab.io.IOHelper.writeInt32LE(buffer, fileSize - 8); // file size
        buffer.write(new Uint8Array([0x57, 0x41, 0x56, 0x45]), 0, 4); // WAVE

        // format chunk
        buffer.write(new Uint8Array([0x66, 0x6D, 0x74, 0x20]), 0, 4); // fmt 
        // @ts-ignore
        alphaTab.io.IOHelper.writeInt32LE(buffer, 16); // block size
        // @ts-ignore
        alphaTab.io.IOHelper.writeInt16LE(buffer, 3); // audio format (3=WAVE_FORMAT_IEEE_FLOAT)
        const channels = 2;
        // @ts-ignore
        alphaTab.io.IOHelper.writeInt16LE(buffer, channels); // number of channels
        // @ts-ignore
        alphaTab.io.IOHelper.writeInt32LE(buffer, sampleRate); // sample rate
        // @ts-ignore
        alphaTab.io.IOHelper.writeInt32LE(buffer, Float32Array.BYTES_PER_ELEMENT * channels * sampleRate); // bytes/second
        const bitsPerSample = Float32Array.BYTES_PER_ELEMENT * 8;
        // @ts-ignore
        alphaTab.io.IOHelper.writeInt16LE(buffer, channels * Math.floor((bitsPerSample + 7) / 8)); // block align
        // @ts-ignore
        alphaTab.io.IOHelper.writeInt16LE(buffer, bitsPerSample); // bits per sample

        // data chunk
        buffer.write(new Uint8Array([0x64, 0x61, 0x74, 0x61]), 0, 4); // data
        // @ts-ignore
        alphaTab.io.IOHelper.writeInt32LE(buffer, samples * 4);
        for (const c of chunks) {
            const bytes = new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
            buffer.write(bytes, 0, bytes.length);
        }

        const blob: Blob = new Blob([
            buffer.toArray()
        ], {
            type: 'audio/wav'
        });
        return URL.createObjectURL(blob);
    }
}
