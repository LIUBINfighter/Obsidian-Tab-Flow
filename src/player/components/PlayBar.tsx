import React, { useState } from 'react';
import type { PlayerController } from '../PlayerController';
import { PlayControls } from './PlayControls';
import { TimeDisplay } from './TimeDisplay';
import { SpeedControl } from './SpeedControl';
import { MetronomeToggle } from './MetronomeToggle';
import { CountInToggle } from './CountInToggle';
import { LoopToggle } from './LoopToggle';
import { LayoutToggle } from './LayoutToggle';
import { ZoomControl } from './ZoomControl';
import { StaveProfileControl } from './StaveProfileControl';
import { ScrollModeControl } from './ScrollModeControl';
import { TracksToggle } from './TracksToggle';
import { TracksModal } from './TracksModal';
import { SettingsToggle } from './SettingsToggle';
import { ExportModal } from './ExportModal';

interface PlayBarProps {
	controller: PlayerController;
	onSettingsClick?: () => void;
	onTracksClick?: () => void;
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
export const PlayBar: React.FC<PlayBarProps> = ({ controller, onSettingsClick, onTracksClick }) => {
	// 使用 controller 的实例 store
	const runtimeStore = controller.getRuntimeStore();

	// 订阅播放状态
	const playbackState = runtimeStore((s) => s.playbackState);
	const positionMs = runtimeStore((s) => s.positionMs);
	const durationMs = runtimeStore((s) => s.durationMs);
	const scoreLoaded = runtimeStore((s) => s.scoreLoaded);
	const api = runtimeStore((s) => s.alphaTabApi); // 从 store 获取 API

	// 本地状态
	const [metronomeEnabled, setMetronomeEnabled] = useState(false);
	const [countInEnabled, setCountInEnabled] = useState(false);
	const [tracksModalOpen, setTracksModalOpen] = useState(false);
	const [exportModalOpen, setExportModalOpen] = useState(false); // 判断按钮状态
	const isPlaying = playbackState === 'playing';
	const canPlay = scoreLoaded;

	return (
		<>
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

				{/* 预备拍开关 */}
				<CountInToggle
					controller={controller}
					enabled={countInEnabled}
					onToggle={setCountInEnabled}
				/>

				{/* 循环播放 */}
				<LoopToggle controller={controller} />

				{/* 布局切换 */}
				<LayoutToggle controller={controller} />

				{/* 缩放控制 */}
				<ZoomControl controller={controller} />

				{/* 谱表模式 */}
				<StaveProfileControl controller={controller} />

				{/* 滚动模式 */}
				<ScrollModeControl controller={controller} />

				{/* 音轨管理按钮 */}
				{onTracksClick && <TracksToggle controller={controller} onClick={onTracksClick} />}

				{/* 导出按钮 */}
				<button
					className="clickable-icon"
					title="导出乐谱"
					onClick={() => setExportModalOpen(true)}
					disabled={!scoreLoaded}
					style={{ padding: '6px' }}
				>
					<svg
						className="svg-icon lucide-download"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
						<polyline points="7 10 12 15 17 10"></polyline>
						<line x1="12" y1="15" x2="12" y2="3"></line>
					</svg>
				</button>

				{/* 设置面板按钮 */}
				{onSettingsClick && (
					<SettingsToggle controller={controller} onClick={onSettingsClick} />
				)}

				{/* 状态指示器（调试用） */}
				{!scoreLoaded && (
					<div className="play-bar-status">
						<span className="status-text">等待加载曲谱...</span>
					</div>
				)}
			</div>

			{/* 音轨选择器模态框（保留作为备用，但通常不使用） */}
			{tracksModalOpen && api && (
				<TracksModal
					api={api}
					isOpen={tracksModalOpen}
					onClose={() => setTracksModalOpen(false)}
				/>
			)}

			{/* 导出模态框 */}
			<ExportModal
				controller={controller}
				isOpen={exportModalOpen}
				onClose={() => setExportModalOpen(false)}
			/>
		</>
	);
};
