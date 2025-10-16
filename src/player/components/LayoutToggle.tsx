import React, { useState } from 'react';
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
	const [layoutMode, setLayoutMode] = useState<alphaTab.LayoutMode>(alphaTab.LayoutMode.Page);

	const handleToggle = () => {
		const newMode =
			layoutMode === alphaTab.LayoutMode.Page
				? alphaTab.LayoutMode.Horizontal
				: alphaTab.LayoutMode.Page;

		setLayoutMode(newMode);
		controller.setLayoutMode(newMode);
	};

	return (
		<div className="play-bar-layout">
			<label className="layout-label">布局:</label>
			<button
				className={`layout-btn ${layoutMode === alphaTab.LayoutMode.Horizontal ? 'horizontal' : 'page'}`}
				onClick={handleToggle}
				aria-label="Toggle Layout Mode"
				title={
					layoutMode === alphaTab.LayoutMode.Page ? '切换到横向滚动' : '切换到页面布局'
				}
			>
				{layoutMode === alphaTab.LayoutMode.Page ? '页面' : '横向'}
			</button>
		</div>
	);
};
