import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { PlayerController } from '../PlayerController';
import { PlayControls } from './PlayControls';
import { TimeDisplay } from './TimeDisplay';
import { MetronomeToggle } from './MetronomeToggle';
import { CountInToggle } from './CountInToggle';
import { LoopToggle } from './LoopToggle';
import { LayoutToggle } from './LayoutToggle';
import { ZoomControl } from './ZoomControl';
import { ScrollModeControl } from './ScrollModeControl';
import { TracksToggle } from './TracksToggle';
import { SettingsToggle } from './SettingsToggle';
import { MediaSyncToggle } from './MediaSyncToggle';
import { TracksModal } from './TracksModal';
import { ExportModal } from './ExportModal';
import { SpeedControl } from './SpeedControl';
import { StaveProfileControl } from './StaveProfileControl';
import { RefreshButton } from './RefreshButton';
import { LocateCursorButton } from './LocateCursorButton';
import { ScrollButtons } from './ScrollButtons';
import { ProgressBar } from './ProgressBar';

interface DebugBarProps {
	controller: PlayerController;
	viewportRef?: React.RefObject<HTMLDivElement | null>;
	onSettingsClick?: () => void;
	onTracksClick?: () => void;
	onMediaSyncClick?: () => void;
}

/**
 * DebugBar - 播放控制栏 (模块化版本)
 *
 * 设计参考 DebugBar: 圆角边框、flex-wrap 布局
 *
 * 功能模块：
 * - PlayControls: 播放/暂停/停止
 * - TimeDisplay: 时间显示
 * - MetronomeToggle: 节拍器开关
 */
export const DebugBar: React.FC<DebugBarProps> = ({
	controller,
	viewportRef,
	onSettingsClick,
	onTracksClick,
	onMediaSyncClick,
}) => {
	// 使用 controller 的实例 store
	const runtimeStore = controller.getRuntimeStore();

	// 订阅播放状态
	const playbackState = runtimeStore((s) => s.playbackState);
	const positionMs = runtimeStore((s) => s.positionMs);
	const durationMs = runtimeStore((s) => s.durationMs);
	const scoreLoaded = runtimeStore((s) => s.scoreLoaded);
	const api = runtimeStore((s) => s.alphaTabApi); // 从 store 获取 API

	// 本地状态
	const [tracksModalOpen, setTracksModalOpen] = useState(false);
	const [exportModalOpen, setExportModalOpen] = useState(false);

	// 判断按钮状态
	const isPlaying = playbackState === 'playing';
	const canPlay = scoreLoaded;

	return (
		<>
			<div className="tab-flow-play-bar">
				{/* 设置面板按钮 */}
				{onSettingsClick && (
					<SettingsToggle controller={controller} onClick={onSettingsClick} />
				)}
				{/* 音轨管理按钮 */}
				{onTracksClick && <TracksToggle controller={controller} onClick={onTracksClick} />}
				{/* MediaSync 按钮 */}
				{onMediaSyncClick && (
					<MediaSyncToggle controller={controller} onClick={onMediaSyncClick} />
				)}
				{/* 导出按钮 */}
				<button
					className="play-bar-button"
					title="导出乐谱"
					onClick={() => setExportModalOpen(true)}
					disabled={!scoreLoaded}
				>
					<Download size={16} />
					<span className="play-bar-button-text">Export</span>
				</button>{' '}
				{/* 播放控制 */}
				<PlayControls controller={controller} isPlaying={isPlaying} canPlay={canPlay} />
				{/* 时间显示 */}
				<TimeDisplay currentMs={positionMs} totalMs={durationMs} />
				{/* 进度条（可交互） */}
				<ProgressBar
					controller={controller}
					currentMs={positionMs}
					totalMs={durationMs}
					enableInteraction={true} // ✅ DebugBar 中启用交互
				/>
				{/* 节拍器开关 */}
				<MetronomeToggle controller={controller} />
				{/* 预备拍开关 */}
				<CountInToggle controller={controller} />
				{/* 循环播放 */}
				<LoopToggle controller={controller} />
				{/* 播放速度 */}
				<SpeedControl controller={controller} />
				{/* 谱表显示模式 */}
				<StaveProfileControl controller={controller} />
				{/* 布局切换 */}
				<LayoutToggle controller={controller} />
				{/* 缩放控制 */}
				<ZoomControl controller={controller} />
				{/* 滚动模式 */}
				<ScrollModeControl controller={controller} />
				{/* 刷新按钮 */}
				<RefreshButton controller={controller} />
				{/* 定位光标 */}
				<LocateCursorButton controller={controller} />
				{/* 滚动按钮 */}
				{viewportRef && <ScrollButtons viewportRef={viewportRef} />}
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
					controller={controller}
					isOpen={tracksModalOpen}
					onClose={() => setTracksModalOpen(false)}
				/>
			)}{' '}
			{/* 导出模态框 */}
			<ExportModal
				controller={controller}
				isOpen={exportModalOpen}
				onClose={() => setExportModalOpen(false)}
			/>
		</>
	);
};
