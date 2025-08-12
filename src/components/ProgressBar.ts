// ProgressBar.ts - 进度条组件，独立于 PlayBar
// 用于音频/乐谱播放进度显示与拖动

export interface ProgressBarOptions {
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo: (position: number) => void;
}

/**
 * 创建进度条组件
 * @param options 进度条参数
 * @returns 进度条容器元素
 */
export function createProgressBar(options: ProgressBarOptions): HTMLDivElement {
    const { getCurrentTime, getDuration, seekTo } = options;

    // 进度条容器
    const progressContainer = document.createElement("div");
    progressContainer.className = "progress-bar-container";

    // 进度条
    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";

    // 进度条填充部分
    const progressFill = document.createElement("div");
    progressFill.className = "progress-fill";

    // 进度条拖动手柄
    const progressHandle = document.createElement("div");
    progressHandle.className = "progress-handle";

    // 组装进度条
    progressBar.appendChild(progressFill);
    progressBar.appendChild(progressHandle);
    progressContainer.appendChild(progressBar);

    // 更新进度条显示
    function updateProgress(currentTimeOverride?: number, durationOverride?: number) {
        const currentTime = currentTimeOverride !== undefined ? currentTimeOverride : getCurrentTime();
        const duration = durationOverride !== undefined ? durationOverride : getDuration();
        if (duration > 0) {
            const progress = (currentTime / duration) * 100;
            progressFill.style.width = `${progress}%`;
            progressHandle.style.left = `${progress}%`;
        } else {
            progressFill.style.width = "0%";
            progressHandle.style.left = "0%";
        }
    }

    // 禁止进度条被点击和拖动（临时方案，事件回调有问题，后续如需恢复请解开下方注释）
    // progressBar.addEventListener("mousedown", (e) => {
    //     handleProgressInteraction(e);
    //     progressBar.classList.add("dragging");
    //     document.addEventListener("mousemove", handleProgressInteraction);
    //     document.addEventListener(
    //         "mouseup",
    //         () => {
    //             progressBar.classList.remove("dragging");
    //             document.removeEventListener("mousemove", handleProgressInteraction);
    //         },
    //         { once: true }
    //     );
    //     e.preventDefault();
    // });
    // progressHandle.addEventListener("mousedown", (e) => {
    //     progressBar.classList.add("dragging");
    //     progressHandle.classList.add("dragging");
    //     document.addEventListener("mousemove", handleProgressInteraction);
    //     document.addEventListener(
    //         "mouseup",
    //         () => {
    //             progressBar.classList.remove("dragging");
    //             progressHandle.classList.remove("dragging");
    //             document.removeEventListener("mousemove", handleProgressInteraction);
    //         },
    //         { once: true }
    //     );
    //     e.stopPropagation();
    //     e.preventDefault();
    // });

    // 提供外部主动更新方法
    (progressContainer as any).updateProgress = updateProgress;

    // 初始化
    updateProgress();

    return progressContainer;
}
