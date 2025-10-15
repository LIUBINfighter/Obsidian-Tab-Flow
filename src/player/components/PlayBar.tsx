import React, { useState } from 'react';
import { useRuntimeStore } from '../store/runtimeStore';
import type { PlayerController } from '../PlayerController';
import { PlayControls } from './PlayControls';
import { TimeDisplay } from './TimeDisplay';
import { SpeedControl } from './SpeedControl';
import { MetronomeToggle } from './MetronomeToggle';

interface PlayBarProps {
	controller: PlayerController;
}

/**
 * PlayBar - 播放控制栏 (模块化版本)
 * 
 * 设计参考 DebugBar: 圆角边框、flex-wrap 布局
 * 
 * 功能模块：
 * - PlayControls: 播放/暂停/停止
 * - TimeDisplay: 时间显示
 * - SpeedControl: 速度选择
 * - MetronomeToggle: 节拍器开关
 */
export const PlayBar: React.FC<PlayBarProps> = ({ controller }) => {
	// 订阅播放状态
	const playbackState = useRuntimeStore((s) => s.playbackState);
	const positionMs = useRuntimeStore((s) => s.positionMs);
	const durationMs = useRuntimeStore((s) => s.durationMs);
	const scoreLoaded = useRuntimeStore((s) => s.scoreLoaded);

	// 本地状态
	const [metronomeEnabled, setMetronomeEnabled] = useState(false);

	// 判断按钮状态
	const isPlaying = playbackState === 'playing';
	const canPlay = scoreLoaded;

	return (
		<div className="tab-flow-play-bar">
			{/* 播放控制 */}
			<PlayControls controller={controller} isPlaying={isPlaying} canPlay={canPlay} />

			{/* 时间显示 */}
			<TimeDisplay currentMs={positionMs} totalMs={durationMs} />

			{/* 速度控制 */}
			<SpeedControl controller={controller} />

			{/* 节拍器开关 */}
			<MetronomeToggle
				controller={controller}
				enabled={metronomeEnabled}
				onToggle={setMetronomeEnabled}
			/>

			{/* 状态指示器（调试用） */}
			{!scoreLoaded && (
				<div className="play-bar-status">
					<span className="status-text">等待加载曲谱...</span>
				</div>
			)}
		</div>
	);
};
