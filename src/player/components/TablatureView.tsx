import React, { useEffect, useRef, useState } from 'react';
import type { PlayerController } from '../PlayerController';
import { PlayBar } from './PlayBar';
import { SettingsPanel } from './SettingsPanel';
import { TracksPanel } from './TracksPanel';
import { MediaSync } from './MediaSync';

interface TablatureViewProps {
	controller: PlayerController;
}

export const TablatureView: React.FC<TablatureViewProps> = ({ controller }) => {
	// 两个 ref：viewport 是滚动容器，container 是 AlphaTab 渲染目标
	const viewportRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
	const [tracksPanelOpen, setTracksPanelOpen] = useState(false);
	const [mediaSyncOpen, setMediaSyncOpen] = useState(false);

	// 切换 Settings 面板：如果打开则关闭，如果关闭则打开（并关闭 Tracks 面板）
	const handleToggleSettings = () => {
		if (settingsPanelOpen) {
			setSettingsPanelOpen(false);
		} else {
			if (tracksPanelOpen) {
				setTracksPanelOpen(false);
			}
			setSettingsPanelOpen(true);
		}
	};

	// 切换 Tracks 面板：如果打开则关闭，如果关闭则打开（并关闭 Settings 面板）
	const handleToggleTracks = () => {
		if (tracksPanelOpen) {
			setTracksPanelOpen(false);
		} else {
			if (settingsPanelOpen) {
				setSettingsPanelOpen(false);
			}
			setTracksPanelOpen(true);
		}
	};

	// 使用 controller 的实例 store
	const runtimeStore = controller.getRuntimeStore();
	const uiStore = controller.getUIStore(); // 订阅 runtime state
	const error = runtimeStore((s) => s.error);

	// 订阅 UI state
	const loading = uiStore((s) => s.loading);

	useEffect(() => {
		if (!containerRef.current || !viewportRef.current) return;

		console.log('[TablatureView] Initializing controller...');

		// 直接初始化，IntersectionObserver 会处理可见性时序
		controller.init(containerRef.current, viewportRef.current);

		// 清理函数
		return () => {
			console.log('[TablatureView] Cleaning up controller...');
			controller.destroy();
		};
	}, [controller]);

	return (
		<div
			className="tablature-view"
			style={{
				width: '100%',
				height: '100%',
				position: 'relative',
				overflow: 'hidden', // 外层容器不滚动，滚动由 alphatab-container 处理
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			{/* PlayBar - 播放控制栏 */}
			<PlayBar
				controller={controller}
				onSettingsClick={handleToggleSettings}
				onTracksClick={handleToggleTracks}
				onMediaSyncClick={() => setMediaSyncOpen(!mediaSyncOpen)}
			/>
			{/* Tracks Panel - 音轨管理侧边栏 */}
			<TracksPanel
				controller={controller}
				isOpen={tracksPanelOpen}
				onClose={() => setTracksPanelOpen(false)}
			/>
			{/* Settings Panel - 设置侧边栏 */}
			<SettingsPanel
				controller={controller}
				isOpen={settingsPanelOpen}
				onClose={() => setSettingsPanelOpen(false)}
			/>{' '}
			{/* Loading Indicator */}
			{loading.isLoading && (
				<div
					className="loading-overlay"
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: 'var(--background-primary)',
						zIndex: 1000,
					}}
				>
					<div className="loading-message" style={{ marginBottom: '10px' }}>
						{loading.message}
					</div>
					{loading.progress !== undefined && (
						<div
							className="loading-progress"
							style={{
								width: '200px',
								height: '4px',
								backgroundColor: 'var(--background-modifier-border)',
								borderRadius: '2px',
								overflow: 'hidden',
							}}
						>
							<div
								className="loading-progress-bar"
								style={{
									width: `${loading.progress}%`,
									height: '100%',
									backgroundColor: 'var(--interactive-accent)',
									transition: 'width 0.3s ease',
								}}
							/>
						</div>
					)}
				</div>
			)}
			{/* Error Display */}
			{error.type && error.message && (
				<div
					className="error-overlay"
					style={{
						position: 'absolute',
						top: '20px',
						left: '50%',
						transform: 'translateX(-50%)',
						maxWidth: '80%',
						padding: '10px 20px',
						backgroundColor: 'var(--background-modifier-error)',
						border: '1px solid var(--background-modifier-error-border)',
						borderRadius: '4px',
						zIndex: 999,
					}}
				>
					<div className="error-message">
						<strong>Error ({error.type}):</strong> {error.message}
					</div>
				</div>
			)}
			{/* AlphaTab 滚动视口容器 - 参考官方文档的 .at-viewport */}
			<div
				ref={viewportRef}
				className="alphatab-viewport"
				style={{
					width: '100%',
					flex: 1,
					overflow: 'auto', // 滚动容器，必须可滚动
					position: 'relative',
					minHeight: 0, // flex 子元素需要这个才能正确收缩
				}}
			>
				{/* AlphaTab 渲染容器 - 参考官方文档的 .at-main */}
				<div
					ref={containerRef}
					className="alphatab-main"
					style={{
						width: '100%',
						minHeight: '100%', // 确保至少占满父容器
					}}
				/>
			</div>
			{/* MediaSync Panel - 底部媒体同步面板 */}
			{mediaSyncOpen && (
				<MediaSync
					controller={controller}
					app={controller.getApp()}
					isOpen={mediaSyncOpen}
				/>
			)}
		</div>
	);
};
