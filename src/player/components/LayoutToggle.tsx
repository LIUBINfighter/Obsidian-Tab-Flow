import React, { useState } from 'react';
import { PanelsTopLeft, Layout } from 'lucide-react';
import * as alphaTab from '@coderline/alphatab';
import type { PlayerController } from '../PlayerController';

interface LayoutToggleProps {
	controller: PlayerController;
}

/**
 * LayoutToggle - 布局模式切换
 * 页面布局 <-> 横向滚动布局
 */
export const LayoutToggle: React.FC<LayoutToggleProps> = ({ controller }) => {
	const globalConfig = controller.getGlobalConfigStore();

	// 从 globalConfig 读取初始布局模式
	const initialLayout = globalConfig((s) => s.alphaTabSettings.display.layoutMode);
	const [layoutMode, setLayoutMode] = useState<alphaTab.LayoutMode>(initialLayout);

	const handleToggle = () => {
		const newMode =
			layoutMode === alphaTab.LayoutMode.Page
				? alphaTab.LayoutMode.Horizontal
				: alphaTab.LayoutMode.Page;

		setLayoutMode(newMode);

		// 更新全局配置（持久化）
		globalConfig.getState().updateAlphaTabSettings({
			display: { ...globalConfig.getState().alphaTabSettings.display, layoutMode: newMode },
		});

		// 同步到 API
		controller.setLayoutMode(newMode);
	};

	const isHorizontal = layoutMode === alphaTab.LayoutMode.Horizontal;

	return (
		<button
			className="play-bar-button"
			onClick={handleToggle}
			aria-label="Toggle Layout Mode"
			title={isHorizontal ? '切换到页面布局' : '切换到横向滚动'}
		>
			{isHorizontal ? <PanelsTopLeft size={16} /> : <Layout size={16} />}
			<span className="play-bar-button-text">{isHorizontal ? '横向' : '页面'}</span>
		</button>
	);
};
