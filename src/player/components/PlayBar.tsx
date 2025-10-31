import React from 'react';
import type { PlayerController } from '../PlayerController';
import { PlayControls } from './PlayControls';

interface PlayBarProps {
	controller: PlayerController;
}

/**
 * PlayBar - 用户界面播放控制栏（简化版）
 *
 * 设计理念：
 * - 简洁的用户界面，只保留核心播放控制
 * - 遵循 DebugBar 的视觉风格（圆角边框、flex-wrap 布局）
 * - 与 DebugBar 共享相同的 CSS 类名和样式
 *
 * 当前功能：
 * - 播放/暂停/停止控制
 *
 * 未来可扩展：
 * - 时间显示
 * - 进度条
 * - 音量控制
 * - 等等...
 */
export const PlayBar: React.FC<PlayBarProps> = ({ controller }) => {
	// 使用 controller 的实例 store
	const runtimeStore = controller.getRuntimeStore();

	// 订阅播放状态
	const playbackState = runtimeStore((s) => s.playbackState);
	const scoreLoaded = runtimeStore((s) => s.scoreLoaded);

	// 判断按钮状态
	const isPlaying = playbackState === 'playing';
	const canPlay = scoreLoaded;

	return (
		<div className="tab-flow-play-bar">
			{/* 播放控制组件 */}
			<PlayControls controller={controller} isPlaying={isPlaying} canPlay={canPlay} />

			{/* 状态指示器（当乐谱未加载时显示） */}
			{!scoreLoaded && (
				<div className="play-bar-status">
					<span className="status-text">等待加载曲谱...</span>
				</div>
			)}
		</div>
	);
};
