import type { ProgressBarOptions } from "../components/ProgressBar";

export type { ProgressBarOptions }; // 仅类型导出

// 允许外部通过类型断言安全访问 updateProgress
export interface ProgressBarElement extends HTMLDivElement {
    updateProgress: (currentTime?: number, duration?: number) => void;
}
