
// PlayBar.ts - 底部固定播放栏组件
import { App, setIcon } from "obsidian";

export interface PlayBarOptions {
    app: App;
    onPlayPause: () => void;
    initialPlaying?: boolean;
}

/**
 * 创建底部固定的播放栏，使用 Obsidian 原生风格
 */

export function createPlayBar(options: PlayBarOptions): HTMLDivElement {
    const { onPlayPause, initialPlaying = false } = options;
    let playing = initialPlaying;

    // 创建主容器
    const bar = document.createElement("div");
    bar.className = "play-bar nav-buttons-container";

    // 左侧控制区
    const leftSection = document.createElement("div");
    leftSection.className = "play-bar-section play-controls";
    bar.appendChild(leftSection);

    // 播放/暂停按钮 (自定义样式)
    const playPauseBtn = document.createElement("button");
    playPauseBtn.className = "clickable-icon";
    playPauseBtn.setAttribute("type", "button");
    playPauseBtn.setAttribute("aria-label", "播放/暂停");

    // 初始图标和文本
    updatePlayPauseButton();

    playPauseBtn.addEventListener("click", () => {
        playing = !playing;
        onPlayPause();
        updatePlayPauseButton();
    });
    leftSection.appendChild(playPauseBtn);

    // 更新播放/暂停按钮图标和文本
    function updatePlayPauseButton() {
        playPauseBtn.innerHTML = '';
        const iconSpan = document.createElement('span');
        setIcon(iconSpan, playing ? 'pause' : 'play');
        playPauseBtn.appendChild(iconSpan);
        playPauseBtn.setAttribute('aria-label', playing ? '暂停' : '播放');
    }

    // 右侧状态区 (预留，可添加时间显示、音量等)
    const rightSection = document.createElement("div");
    rightSection.className = "play-bar-section play-status";
    bar.appendChild(rightSection);

    return bar;
}
