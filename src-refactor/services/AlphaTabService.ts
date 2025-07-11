import * as alphaTab from "@coderline/alphatab";
import { EventBus } from "../utils/EventBus";
import { ScrollConfigProxy } from "../services/ScrollConfigProxy";
import * as convert from "color-convert";

export class AlphaTabService {
    private api: alphaTab.AlphaTabApi;
    private scrollProxy: ScrollConfigProxy;
    private eventBus: EventBus;

    constructor(
        element: HTMLElement,
        resources: { alphaTabWorkerUri: string; soundFontUri: string; bravuraUri: string },
        eventBus: EventBus
    ) {
        this.eventBus = eventBus;
        
        // 获取当前元素的计算样式用于暗色适配
        const style = window.getComputedStyle(element);
        
        this.api = new alphaTab.AlphaTabApi(element, {
            core: { scriptFile: resources.alphaTabWorkerUri, smuflFontSources: new Map(), fontDirectory: "" },
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
     * 配置滚动元素
     */
    public configureScrollElement(scrollElement?: HTMLElement | string): void {
        if (this.api.settings.player) {
            this.api.settings.player.scrollElement = scrollElement || "html,body";
            this.api.updateSettings();
            console.debug("[AlphaTabService] 滚动元素已配置:", scrollElement);
        }
    }
}
