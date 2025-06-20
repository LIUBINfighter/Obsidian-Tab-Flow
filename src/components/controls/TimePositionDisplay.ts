// components/TimePositionDisplay.ts

export interface TimePositionDisplayOptions {
    initialText?: string;
    className?: string;
}

export class TimePositionDisplay {
    public el: HTMLSpanElement;

    constructor(parent: HTMLElement, options: TimePositionDisplayOptions = {}) {
        this.el = parent.createEl("span", {
            text: options.initialText ?? "00:00 / 00:00",
            cls: options.className ?? "time-position",
        });
    }

    setText(text: string) {
        this.el.setText(text);
    }

    // 为测试添加兼容方法
    getElement(): HTMLSpanElement {
        return this.el;
    }

    getText(): string {
        return this.el.textContent || '';
    }
}
