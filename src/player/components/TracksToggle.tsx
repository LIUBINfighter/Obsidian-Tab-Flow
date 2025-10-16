/**
 * TracksToggle - 音轨管理按钮
 *
 * 用于打开/关闭音轨选择器模态框
 */

import React from 'react';
import type { PlayerController } from '../PlayerController';

interface TracksToggleProps {
	controller: PlayerController;
	onClick: () => void;
}

/**
 * 音轨管理按钮组件
 */
export const TracksToggle: React.FC<TracksToggleProps> = ({ controller, onClick }) => {
	// 从 runtime store 获取曲谱状态和 API
	const runtimeStore = controller.getRuntimeStore();
	const scoreLoaded = runtimeStore((s) => s.scoreLoaded);
	const api = runtimeStore((s) => s.alphaTabApi);

	// 获取当前音轨数量
	const trackCount = api?.tracks?.length ?? 0;
	const totalTracks = api?.score?.tracks?.length ?? 0;

	return (
		<div className="play-bar-group">
			<button
				className="play-bar-btn"
				onClick={onClick}
				disabled={!scoreLoaded}
				title={scoreLoaded ? `音轨管理 (${trackCount}/${totalTracks})` : '等待加载曲谱'}
				aria-label="音轨管理"
			>
				{/* 音轨图标 */}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M9 18V5l12-2v13"></path>
					<circle cx="6" cy="18" r="3"></circle>
					<circle cx="18" cy="16" r="3"></circle>
				</svg>

				{/* 显示当前音轨数 */}
				{scoreLoaded && totalTracks > 0 && (
					<span className="track-count">
						{trackCount}/{totalTracks}
					</span>
				)}
			</button>
		</div>
	);
};
