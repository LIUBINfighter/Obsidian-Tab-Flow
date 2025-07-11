import { Modal, App, Setting } from "obsidian";

export class AudioExportModal extends Modal {
    constructor(app: App, public audioUrl: string, public fileName: string) {
        super(app);
    }

    onOpen() {
        this.titleEl.setText("音频导出预览");
        this.contentEl.empty();

        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = this.audioUrl;
        audio.style.width = "100%";
        this.contentEl.appendChild(audio);

        new Setting(this.contentEl)
            .setName("保存到本地")
            .addButton(btn => {
                btn.setButtonText("保存")
                    .setCta()
                    .onClick(() => {
                        const a = document.createElement("a");
                        a.href = this.audioUrl;
                        a.download = this.fileName;
                        a.click();
                    });
            });
    }

    onClose() {
        this.contentEl.empty();
    }
}
