import * as alphaTab from "@coderline/alphatab";

/**
 * 导出相关事件注册与处理
 * 包括：音频导出、MIDI导出、GP导出、PDF打印
 */

export interface ExportEventHandlersOptions {
    api: alphaTab.AlphaTabApi;
    getFileName?: () => string; // 可选：自定义文件名
    onExportStart?: (type: string) => void;
    onExportFinish?: (type: string, success: boolean, message?: string) => void;
    app?: any; // Obsidian App 实例，用于创建模态框
}

export function registerExportEventHandlers(
    options: ExportEventHandlersOptions
): {
    exportAudio: () => Promise<void>;
    exportMidi: () => void;
    exportGp: () => void;
    exportPdf: () => void;
} {
    const { api, getFileName, onExportStart, onExportFinish } = options;

    // 1. 音频导出（WAV）
    async function exportAudio() {
        try {
            onExportStart?.("audio");
            const options = new alphaTab.synth.AudioExportOptions();
            options.masterVolume = 1;
            options.metronomeVolume = 0;
            options.sampleRate = 44100;
            const exporter = await api.exportAudio(options);
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
            const blobUrl = convertSamplesToWavBlobUrl(chunks, options.sampleRate);
            onExportFinish?.("audio", true, blobUrl);
        } catch (e: any) {
            onExportFinish?.("audio", false, e?.message || String(e));
        }
    }

    function convertSamplesToWavBlobUrl(chunks: Float32Array[], sampleRate: number): string {
        const samples = chunks.reduce((p, c) => p + c.length, 0);
        const wavHeaderSize = 44;
        const fileSize = wavHeaderSize + samples * 4;
        const buffer = alphaTab.io.ByteBuffer.withCapacity(fileSize);

        // 写 WAV 头
        buffer.write(new Uint8Array([0x52, 0x49, 0x46, 0x46]), 0, 4); // RIFF
        alphaTab.io.IOHelper.writeInt32LE(buffer, fileSize - 8); // file size
        buffer.write(new Uint8Array([0x57, 0x41, 0x56, 0x45]), 0, 4); // WAVE

        buffer.write(new Uint8Array([0x66, 0x6D, 0x74, 0x20]), 0, 4); // fmt␣
        alphaTab.io.IOHelper.writeInt32LE(buffer, 16); // block size
        alphaTab.io.IOHelper.writeInt16LE(buffer, 3); // audio format (1=WAVE_FORMAT_IEEE_FLOAT)
        const channels = 2;
        alphaTab.io.IOHelper.writeInt16LE(buffer, channels); // number of channels
        alphaTab.io.IOHelper.writeInt32LE(buffer, sampleRate); // sample rate
        alphaTab.io.IOHelper.writeInt32LE(buffer, Float32Array.BYTES_PER_ELEMENT * channels * sampleRate); // bytes/second
        const bitsPerSample = Float32Array.BYTES_PER_ELEMENT * 8;
        alphaTab.io.IOHelper.writeInt16LE(buffer, channels * Math.floor((bitsPerSample + 7) / 8)); // block align
        alphaTab.io.IOHelper.writeInt16LE(buffer, bitsPerSample); // bits per sample

        buffer.write(new Uint8Array([0x64, 0x61, 0x74, 0x61]), 0, 4); // data
        alphaTab.io.IOHelper.writeInt32LE(buffer, samples * 4);
        for (const c of chunks) {
            const bytes = new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
            buffer.write(bytes, 0, bytes.length);
        }

        const blob: Blob = new Blob([buffer.toArray()], { type: 'audio/wav' });
        return URL.createObjectURL(blob);
    }

    // 2. MIDI 导出（带自定义文件名）
    function exportMidi() {
        try {
            onExportStart?.("midi");
            const fileName = (getFileName?.() || "Untitled") + ".mid";
            // 优先使用 exportMidi 以便自定义文件名
            if (api && typeof (api as any).exportMidi === "function") {
                // @ts-ignore
                const midiData = api.exportMidi();
                const a = document.createElement('a');
                a.download = fileName;
                a.href = URL.createObjectURL(new Blob([midiData], { type: "audio/midi" }));
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else if (api && typeof api.downloadMidi === "function") {
                // 回退到内置下载（可能无法自定义文件名）
                try {
                    // @ts-ignore 尝试带文件名（部分版本支持）
                    api.downloadMidi(fileName);
                } catch {
                    api.downloadMidi();
                }
            }
            onExportFinish?.("midi", true);
        } catch (e: any) {
            onExportFinish?.("midi", false, e?.message || String(e));
        }
    }

    // 3. GP 导出（Guitar Pro 7）
    function exportGp() {
        try {
            onExportStart?.("gp");
            if (!api.score) throw new Error("乐谱未加载");
            const exporter = new (alphaTab as any).exporter.Gp7Exporter();
            const data = exporter.export(api.score, api.settings);
            const a = document.createElement('a');
            a.download = (getFileName?.() || api.score.title || "Untitled") + ".gp";
            a.href = URL.createObjectURL(new Blob([data]));
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            onExportFinish?.("gp", true);
        } catch (e: any) {
            onExportFinish?.("gp", false, e?.message || String(e));
        }
    }

    // 4. 打印为 PDF（调用浏览器打印）
    function exportPdf() {
        try {
            onExportStart?.("pdf");
            // 只打印乐谱区域
            // 假设 api.renderTarget 是渲染的 DOM 元素
            const el = (api as any).renderTarget || api.container;
            if (!el) throw new Error("找不到乐谱渲染区域");
            // 新建窗口打印
            const win = window.open('', '_blank');
            if (!win) throw new Error("无法打开打印窗口");
            win.document.write('<html><head><title>乐谱打印</title>');
            // 复制样式
            document.querySelectorAll('style,link[rel="stylesheet"]').forEach(style => {
                win.document.write(style.outerHTML);
            });
            win.document.write('</head><body>');
            win.document.write(el.outerHTML);
            win.document.write('</body></html>');
            win.document.close();
            win.focus();
            win.print();
            onExportFinish?.("pdf", true);
        } catch (e: any) {
            onExportFinish?.("pdf", false, e?.message || String(e));
        }
    }

    return { exportAudio, exportMidi, exportGp, exportPdf };
}
