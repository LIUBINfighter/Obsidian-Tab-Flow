// StaveProfileButton.ts
import * as alphaTab from "@coderline/alphatab";

interface StaveProfileButtonOptions {
    onClick?: (profile: alphaTab.StaveProfile) => void;
    initialProfile?: alphaTab.StaveProfile;
    className?: string;
}

export class StaveProfileButton {
    private element: HTMLElement;
    private currentProfile: alphaTab.StaveProfile = alphaTab.StaveProfile.Default;
    private onClick?: (profile: alphaTab.StaveProfile) => void;

    // 定义五种模式的配置
    private readonly profiles = [
        {
            value: alphaTab.StaveProfile.Default,
            label: "默认模式",
            icon: "settings"
        },
        {
            value: alphaTab.StaveProfile.ScoreTab,
            label: "五线谱+六线谱",
            icon: "music"
        },
        {
            value: alphaTab.StaveProfile.Score,
            label: "仅五线谱",
            icon: "file-music"
        },
        {
            value: alphaTab.StaveProfile.Tab,
            label: "仅六线谱",
            icon: "hash"
        },
        {
            value: alphaTab.StaveProfile.TabMixed,
            label: "混合六线谱",
            icon: "layers"
        }
    ];

    constructor(parent: HTMLElement, options: StaveProfileButtonOptions = {}) {
        this.onClick = options.onClick;
        this.currentProfile = options.initialProfile ?? alphaTab.StaveProfile.Default;
        
        this.element = parent.createEl("button", {
            cls: `stave-profile-button ${options.className || ""}`,
            attr: {
                type: "button",
                title: this.getCurrentProfileLabel()
            }
        });

        this.updateButtonDisplay();
        this.element.addEventListener("click", this.handleClick.bind(this));
    }

    private getCurrentProfileLabel(): string {
        const profile = this.profiles.find(p => p.value === this.currentProfile);
        return profile ? profile.label : "谱表模式";
    }

    private getCurrentProfileIcon(): string {
        const profile = this.profiles.find(p => p.value === this.currentProfile);
        return profile ? profile.icon : "music";
    }

    private updateButtonDisplay(): void {
        this.element.empty();
        
        // 添加图标
        this.element.createEl("span", {
            cls: `lucide lucide-${this.getCurrentProfileIcon()}`
        });
        
        // 添加文本标签
        this.element.createEl("span", {
            text: this.getCurrentProfileLabel(),
            cls: "button-text"
        });

        // 更新 title 属性
        this.element.setAttribute("title", this.getCurrentProfileLabel());
    }

    private handleClick(): void {
        // 循环切换到下一个模式
        const currentIndex = this.profiles.findIndex(p => p.value === this.currentProfile);
        const nextIndex = (currentIndex + 1) % this.profiles.length;
        this.currentProfile = this.profiles[nextIndex].value;
        
        this.updateButtonDisplay();
        
        if (this.onClick) {
            this.onClick(this.currentProfile);
        }
    }

    public setProfile(profile: alphaTab.StaveProfile): void {
        this.currentProfile = profile;
        this.updateButtonDisplay();
    }

    public getProfile(): alphaTab.StaveProfile {
        return this.currentProfile;
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public setEnabled(enabled: boolean): void {
        const buttonEl = this.element as HTMLButtonElement;
        buttonEl.disabled = !enabled;
        if (enabled) {
            this.element.removeClass("disabled");
        } else {
            this.element.addClass("disabled");
        }
    }
}
