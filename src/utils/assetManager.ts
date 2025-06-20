import { Notice, requestUrl } from "obsidian";
import * as path from "path";
import * as fs from "fs";
import * as JSZip from "jszip";
import AlphaTabPlugin from "../main";

// 关键资产列表，这些是插件正常运行所必需的
export const REQUIRED_ASSETS = [
    "assets/alphatab/alphaTab.worker.mjs",
    "assets/alphatab/alphatab.js",
    "assets/alphatab/soundfont/sonivox.sf2",
    "assets/alphatab/font/Bravura.woff2",
    "assets/alphatab/font/Bravura.woff",
    "assets/alphatab/font/bravura_metadata.json"
];

// 资产包的下载URL
const ASSETS_PACKAGE_URL = (version: string) => `https://github.com/LIUBINfightere/interactive-tabs/releases/download/${version}/assets.zip`;

/**
 * 检查插件目录中是否存在所有必需的资产文件
 * @param pluginDir 插件目录路径
 * @returns 是否存在所有必需资产
 */
export function checkRequiredAssets(pluginDir: string): boolean {
    try {
        for (const assetPath of REQUIRED_ASSETS) {
            const fullPath = path.join(pluginDir, assetPath);
            if (!fs.existsSync(fullPath)) {
                console.log(`[AlphaTab] Missing required asset: ${assetPath}`);
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error("[AlphaTab] Error checking assets:", error);
        return false;
    }
}

/**
 * 检查并下载必要的资产文件
 * @param plugin 插件实例
 * @returns 是否成功下载和解压资产
 */
export async function checkAndDownloadAssets(plugin: AlphaTabPlugin): Promise<boolean> {
    if (!plugin.actualPluginDir) {
        console.error("[AlphaTab] Plugin directory not found");
        return false;
    }

    // 检查资产是否已存在
    if (checkRequiredAssets(plugin.actualPluginDir)) {
        console.log("[AlphaTab] All required assets are present");
        return true;
    }

    // 显示通知，告知用户正在下载资产
    const notice = new Notice("正在下载 AlphaTab 资源文件...", 0);

    try {
        // 创建assets目录（如果不存在）
        const assetsDir = path.join(plugin.actualPluginDir, "assets");
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }

        // 构建资产包URL - 使用当前插件版本号
        const version = plugin.manifest.version;
        const assetsUrl = ASSETS_PACKAGE_URL(version);

        // 下载资产包
        const response = await requestUrl({
            url: assetsUrl,
            method: "GET",
            headers: {
                "Content-Type": "application/zip"
            }
        });

        // 将响应转换为ArrayBuffer
        const arrayBuffer = response.arrayBuffer;

        // 使用JSZip解压资产
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // 解压所有文件到插件目录
        const extractionPromises: Promise<void>[] = [];
        
        zip.forEach((relativePath: string, zipEntry: JSZip.JSZipObject) => {
            if (!zipEntry.dir && plugin.actualPluginDir) {
                const extractPromise = zipEntry.async("arraybuffer").then((content: ArrayBuffer) => {
                    const targetPath = path.join(plugin.actualPluginDir as string, relativePath);
                    const targetDir = path.dirname(targetPath);
                    
                    // 确保目标目录存在
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }
                    
                    // 写入文件
                    fs.writeFileSync(targetPath, Buffer.from(content));
                    console.log(`[AlphaTab] Extracted: ${relativePath}`);
                });
                
                extractionPromises.push(extractPromise);
            }
        });
        
        // 等待所有文件解压完成
        await Promise.all(extractionPromises);
        
        // 更新设置，标记资产已下载
        plugin.settings.assetsDownloaded = true;
        plugin.settings.lastAssetsCheck = Date.now();
        await plugin.saveSettings();
        
        // 关闭通知并显示成功消息
        notice.hide();
        new Notice("AlphaTab 资源文件下载完成", 3000);
        
        return true;
    } catch (error) {
        // 下载或解压失败，显示错误消息
        notice.hide();
        new Notice(`下载 AlphaTab 资源文件失败: ${error.message}`, 5000);
        console.error("[AlphaTab] Asset download failed:", error);
        return false;
    }
}

/**
 * 手动触发资产下载
 * @param plugin 插件实例
 */
export async function forceDownloadAssets(plugin: AlphaTabPlugin): Promise<void> {
    const result = await checkAndDownloadAssets(plugin);
    if (result) {
        new Notice("AlphaTab 资源文件已更新，请重启 Obsidian 以应用更改", 5000);
    }
}
