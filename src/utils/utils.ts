import * as path from "path";
import * as fs from "fs";

export function registerStyles(plugin: any) {
	try {
		if (!plugin.actualPluginDir) return;
		const cssPath = path.join(plugin.actualPluginDir, "styles.css");
		if (fs.existsSync(cssPath)) {
			const css = fs.readFileSync(cssPath, "utf8");
			const styleEl = document.createElement("style");
			styleEl.id = "alphatab-plugin-styles";
			styleEl.innerHTML = css;
			document.head.appendChild(styleEl);

			plugin.register(() => {
				const existingStyleEl = document.getElementById(
					"alphatab-plugin-styles"
				);
				if (existingStyleEl) {
					existingStyleEl.remove();
				}
			});
		} else {
			console.warn(
				"[AlphaTab] styles.css not found in plugin directory."
			);
		}
	} catch (e) {
		console.error("[AlphaTab] Failed to inject styles.css:", e);
	}
}

export function isGuitarProFile(extension: string | undefined): boolean {
	if (!extension) return false;
	return ["gp", "gp3", "gp4", "gp5", "gpx", "gp7"].includes(
		extension.toLowerCase()
	);
}

/**
 * 检查当前 Obsidian 是否为深色模式
 * @returns 'dark' | 'light'
 */
export function getCurrentThemeMode(): 'dark' | 'light' {
    if (document.body.classList.contains('theme-dark')) {
        return 'dark';
    } else if (document.body.classList.contains('theme-light')) {
        return 'light';
    }
    // 默认返回 dark
    return 'dark';
}
