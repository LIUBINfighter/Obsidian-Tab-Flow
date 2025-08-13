import { App, Modal, Notice } from "obsidian";

export interface ExportChooserOptions {
    app: App;
    eventBus: { publish: (event: string, payload?: unknown) => void; subscribe: (event: string, handler: (p?: any) => void) => void };
    getFileName: () => string;
}

export class ExportChooserModal extends Modal {
    private eventBus: ExportChooserOptions["eventBus"];
    private getFileName: () => string;

    constructor(opts: ExportChooserOptions) {
        super(opts.app);
        this.eventBus = opts.eventBus;
        this.getFileName = opts.getFileName;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("tabflow-export-chooser");

        contentEl.createEl("h3", { text: "导出" });
        const row = contentEl.createDiv({ attr: { style: "display:flex; gap: 8px; flex-wrap: wrap;" } });

        // 音频导出（触发事件，由服务层导出并在状态回调时呼出音频播放器）
        const audioBtn = row.createEl("button", { text: "导出音频(WAV)", cls: "mod-cta" });
        audioBtn.onclick = () => {
            try {
                const onOk = (url?: string) => {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        const { AudioExportModal } = require("./AudioExportModal");
                        const fileName = (this.getFileName?.() || "audio") + ".wav";
                        new AudioExportModal(this.app, url || "", fileName).open();
                        new Notice("音频导出完成，已弹出播放器");
                    } catch (e) {
                        console.error("[ExportChooserModal] 打开音频播放器失败", e);
                    }
                };
                const okHandler = (url?: string) => onOk(url);
                const failHandler = (err?: any) => new Notice("音频导出失败" + (err ? ": " + String(err) : ""));
                this.eventBus.subscribe("状态:音频导出完成", okHandler);
                this.eventBus.subscribe("状态:音频导出失败", failHandler);
                this.eventBus.publish("命令:导出音频");
                this.close();
            } catch (e) {
                new Notice("导出启动失败: " + e);
            }
        };

        // MIDI
        const midiBtn = row.createEl("button", { text: "导出 MIDI" });
        midiBtn.onclick = () => {
            try {
                this.eventBus.publish("命令:导出MIDI");
                this.close();
            } catch (e) {
                new Notice("导出 MIDI 失败: " + e);
            }
        };

        // PDF
        const pdfBtn = row.createEl("button", { text: "导出 PDF" });
        pdfBtn.onclick = () => {
            try {
                this.eventBus.publish("命令:导出PDF");
                this.close();
            } catch (e) {
                new Notice("导出 PDF 失败: " + e);
            }
        };

        // GP
        const gpBtn = row.createEl("button", { text: "导出 GP" });
        gpBtn.onclick = () => {
            try {
                this.eventBus.publish("命令:导出GP");
                this.close();
            } catch (e) {
                new Notice("导出 GP 失败: " + e);
            }
        };
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}


