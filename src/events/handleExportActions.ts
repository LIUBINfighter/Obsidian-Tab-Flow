import { ITabManager } from "../ITabManager";
import { Notice } from "obsidian";
import * as alphaTab from "@coderline/alphatab";

function getExportFileName(atManager: ITabManager): string {
    // 1. 优先元数据标签 \title
    const score = atManager?.api?.score;
    if (score && score.metadata && typeof score.metadata.title === 'string' && score.metadata.title.trim()) {
        return score.metadata.title.trim();
    }
    // 2. 其次文件名（不带后缀）
    // 通过 atManager.pluginInstance?.app?.workspace?.getActiveFile() 获取当前文件
    const app = atManager?.getApp?.() || atManager?.pluginInstance?.app;
    let fileName = "";
    if (app && typeof app.workspace?.getActiveFile === 'function') {
        const file = app.workspace.getActiveFile();
        if (file && file.basename) {
            fileName = file.basename;
        }
    }
    if (fileName) return fileName;
    // 3. 都没有则 untitled
    return "untitled";
}

export function handlePrintPdf(atManager: ITabManager) {
    new Notice("当前环境暂不支持直接打印为 PDF。请在浏览器中打开后再打印。");
}

export function handleExportGpFile(atManager: ITabManager) {
    if (!atManager?.api?.score) {
        new Notice("乐谱未加载，无法导出 GP 文件。");
        return;
    }
    const exporter = new alphaTab.exporter.Gp7Exporter();
    const data = exporter.export(atManager.api.score, atManager.api.settings);
    const a = document.createElement('a');
    a.download = getExportFileName(atManager) + ".gp";
    a.href = URL.createObjectURL(new Blob([data]));
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
