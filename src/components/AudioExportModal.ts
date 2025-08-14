import { Modal, App, Setting, Notice } from "obsidian";

export class AudioExportModal extends Modal {
    constructor(app: App, public audioUrl: string, public fileName: string) {
        super(app);
    }

    async copyToClipboard() {
        try {
            const response = await fetch(this.audioUrl);
            const blob = await response.blob();
            // ClipboardItem 需要 audio/wav 类型
            // @ts-ignore
            await navigator.clipboard.write([
                new window.ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            new Notice("音频已复制到剪贴板，可直接粘贴到笔记");
        } catch (e) {
            new Notice("复制到剪贴板失败: " + (e?.message || e));
        }
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

        // 暂时隐藏“复制到剪贴板”按钮，后续如需可恢复
        // new Setting(this.contentEl)
        //     .setName("复制到剪贴板")
        //     .addButton(btn => {
        //         btn.setButtonText("复制")
        //             .onClick(() => {
        //                 this.copyToClipboard();
        //             });
        //     });
    }

    onClose() {
        this.contentEl.empty();
    }
}
