// components/playPauseButton.ts

export interface PlayPauseButtonOptions {
    onClick: () => void;
    initialText?: string;
    className?: string;
}

export class PlayPauseButton {
    public el: HTMLButtonElement;

    constructor(parent: HTMLElement, options: PlayPauseButtonOptions) {
        this.el = parent.createEl("button", {
            text: options.initialText ?? "播放",
            cls: options.className ?? "play-pause",
        });
        this.el.addEventListener("click", options.onClick);
    }

    setText(text: string) {
        this.el.setText(text);
    }

    setEnabled(enabled: boolean) {
        this.el.disabled = !enabled;
    }

    // 为测试添加兼容方法
    getElement(): HTMLButtonElement {
        return this.el;
    }

    getText(): string {
        return this.el.textContent || '';
    }
}
