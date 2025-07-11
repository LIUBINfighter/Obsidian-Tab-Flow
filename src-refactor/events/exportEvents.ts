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
            const exporter = await api.exportAudio({
                sampleRate: 44100,
                useSyncPoints: false,
                masterVolume: 1,
                metronomeVolume: 0,
                trackVolume: new Map(),
                trackTranspositionPitches: new Map(),
            });
            const chunks: Uint8Array[] = [];
            let done = false;
            while (!done) {
                const chunk: unknown = await exporter.render(1000); // 渲染1秒
                if (
                    chunk &&
                    typeof chunk === 'object' &&
                    'value' in chunk &&
                    (chunk as { value?: Uint8Array }).value
                ) {
                    chunks.push((chunk as { value: Uint8Array }).value);
                }
                done = !!(
                    chunk &&
                    typeof chunk === 'object' &&
                    'done' in chunk &&
                    (chunk as { done?: boolean }).done
                );
            }
            exporter.destroy();
            // 合并所有 chunk
            const totalLength = chunks.reduce((sum, arr) => sum + arr.length, 0);
            const wavData = new Uint8Array(totalLength);
            let offset = 0;
            for (const arr of chunks) {
                wavData.set(arr, offset);
                offset += arr.length;
            }
            // 触发下载
            const a = document.createElement('a');
            a.download = (getFileName?.() || "audio") + ".wav";
            a.href = URL.createObjectURL(new Blob([wavData], { type: "audio/wav" }));
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            onExportFinish?.("audio", true);
        } catch (e: any) {
            onExportFinish?.("audio", false, e?.message || String(e));
        }
    }

    // 2. MIDI 导出
    function exportMidi() {
        try {
            onExportStart?.("midi");
            api.downloadMidi();
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
