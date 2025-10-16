/**
 * TracksToggle - 音轨管理按钮
 *
 * 用于打开/关闭音轨选择器模态框
 */

import React from 'react';
import { Music } from 'lucide-react';
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
				className={`play-bar-button tracks-toggle-button ${!scoreLoaded ? 'disabled' : ''}`}
				onClick={onClick}
				disabled={!scoreLoaded}
				title={scoreLoaded ? `音轨管理 (${trackCount}/${totalTracks})` : '等待加载曲谱'}
				aria-label="音轨管理"
			>
				{/* 音轨图标 */}
				<Music size={16} />

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
