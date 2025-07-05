import { FileView, TFile, WorkspaceLeaf, Plugin } from "obsidian";

export const VIEW_TYPE_TAB = "tab-view";

import * as alphaTab from '@coderline/alphatab';
import convert from "color-convert";

export type AlphaTabResources = {
    bravuraUri: string;
    alphaTabWorkerUri: string;
    soundFontData: Uint8Array;
}

export class TabView extends FileView {
    private static instanceId = 0;
    private _api!: alphaTab.AlphaTabApi;
    private _styles: HTMLStyleElement;
    private currentFile: TFile | null = null;
    private fileModifyHandler: (file: TFile) => void;

    constructor(leaf: WorkspaceLeaf, private plugin: Plugin, private resources: AlphaTabResources) {
        super(leaf);
        
        // 初始化文件修改监听处理器
        this.fileModifyHandler = (file: TFile) => {
            // 检查修改的文件是否是当前打开的文件
            if (this.currentFile && file && file.path === this.currentFile.path) {
                console.log(`[TabView] 检测到文件变化: ${file.basename}，正在重新加载...`);
                this.reloadFile();
            }
        };
    }

    getViewType(): string {
        return VIEW_TYPE_TAB;
    }

    getDisplayText(): string {
        return 'alphaTab';
    }

    onload(): void {
        const cls = `alphatab-${TabView.instanceId++}`;

        const styles = this.containerEl.createEl('style');
        styles.innerHTML = `
        .${cls} .at-cursor-bar {
            background: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
            opacity: 0.2
        }

        .${cls} .at-selection div {
            background: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
            opacity: 0.4
        }

        .${cls} .at-cursor-beat {
            background: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
            width: 3px;
        }

        .${cls} .at-highlight * {
            fill: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
            stroke: hsl(var(--accent-h),var(--accent-s),var(--accent-l));
        }
        `;
        this._styles = styles;

        // 注册文件变更监听
        this.registerFileWatcher();

        const toolbar = this.contentEl.createDiv();
        const playPause = toolbar.createEl('button');
        playPause.innerText = 'Play/Pause';
        playPause.onclick = ()=>{
            this._api.playPause();
        };
        
        const element = this.contentEl.createDiv({ cls: cls });
        const style = window.getComputedStyle(element);

        const api = new alphaTab.AlphaTabApi(element, {
            core: {
                // we can use the plugin file as worker entry point as we import alphaTab into this file here
                // this will initialize whatever is needed.
                scriptFile: this.resources.alphaTabWorkerUri,
                // 使用新的 1.6.0 版本特性：smuflFontSources
                smuflFontSources: new Map<alphaTab.FontFileFormat, string>([
                    [alphaTab.FontFileFormat.Woff2, this.resources.bravuraUri]
                ])
            },
            player: {
                playerMode: alphaTab.PlayerMode.EnabledAutomatic
            },
            display: {
                resources: {
                    // set theme colors
                    mainGlyphColor: style.getPropertyValue('--color-base-100'),
                    secondaryGlyphColor: style.getPropertyValue('--color-base-60'),
                    staffLineColor: style.getPropertyValue('--color-base-40'),
                    barSeparatorColor: style.getPropertyValue('--color-base-40'),
                    barNumberColor: '#' + convert.hsl.hex([
                        parseFloat(style.getPropertyValue('--accent-h')),
                        parseFloat(style.getPropertyValue('--accent-s')),
                        parseFloat(style.getPropertyValue('--accent-l'))
                    ]),
                    scoreInfoColor: style.getPropertyValue('--color-base-100'),
                }
            }
        });
        this._api = api;
    }

    onunload(): void {
        // 注销文件监听
        this.unregisterFileWatcher();
        
        // 销毁 AlphaTab API
        if (this._api) {
            this._api.destroy();
        }
        
        // 清理样式
        if (this._styles) {
            this._styles.remove();
        }
        
        this.currentFile = null;
        console.log("[TabView] View unloaded and resources cleaned up");
    }

    async onLoadFile(file: TFile): Promise<void> {
        this.currentFile = file;
        this._api.loadSoundFont(new Uint8Array(this.resources.soundFontData));

        const inputFile = await this.app.vault.readBinary(file);
        this._api.load(new Uint8Array(inputFile));
    }

    // 注册文件变更监听
    private registerFileWatcher(): void {
        this.app.vault.on("modify", this.fileModifyHandler);
        console.log("[TabView] 已注册文件监听");
    }

    // 注销文件变更监听
    private unregisterFileWatcher(): void {
        this.app.vault.off("modify", this.fileModifyHandler);
        console.log("[TabView] 已注销文件监听");
    }

    // 重新加载当前文件内容
    private async reloadFile(): Promise<void> {
        if (!this.currentFile || !this._api) {
            return;
        }

        try {
            const inputFile = await this.app.vault.readBinary(this.currentFile);
            this._api.load(new Uint8Array(inputFile));
            console.log(`[TabView] 已重新加载文件: ${this.currentFile.basename}`);
        } catch (error) {
            console.error("[TabView] 重新加载文件失败", error);
        }
    }

    // Override onUnloadFile to ensure proper cleanup when file is closed
    override async onUnloadFile(file: TFile): Promise<void> {
        console.log(`[TabView] Unloading file: ${file.name}`);
        this.currentFile = null;
        await super.onUnloadFile(file);
    }
}
