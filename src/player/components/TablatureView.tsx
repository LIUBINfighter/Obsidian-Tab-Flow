import React, { useEffect, useRef } from 'react';
import type { PlayerController } from '../PlayerController';
import { PlayBar } from './PlayBar';
import { DebugBar } from './DebugBar';
import { SettingsPanel } from './SettingsPanel';
import { TracksPanel } from './TracksPanel';
import { MediaSync } from './MediaSync';

/**
 * TablatureView 配置选项
 * 用于自定义播放器组件的显示和行为
 */
export interface TablatureViewOptions {
	/** 是否显示 DebugBar（默认：true） */
	showDebugBar?: boolean;
	/** 是否显示 PlayBar（默认：true） */
	showPlayBar?: boolean;
	/** 是否显示 SettingsPanel（默认：true） */
	showSettingsPanel?: boolean;
	/** 是否显示 TracksPanel（默认：true） */
	showTracksPanel?: boolean;
	/** 是否显示 MediaSync（默认：true） */
	showMediaSync?: boolean;
	/** 自定义组件渲染器（可选） */
	customComponents?: {
		/** 自定义顶部组件（替代或补充 DebugBar） */
		topBar?: React.ComponentType<{ controller: PlayerController }>;
		/** 自定义底部组件（替代或补充 PlayBar） */
		bottomBar?: React.ComponentType<{ controller: PlayerController }>;
		/** 自定义侧边栏组件 */
		sidebars?: React.ComponentType<{ controller: PlayerController }>[];
	};
}

interface TablatureViewProps {
	controller: PlayerController;
	/** 配置选项（可选） */
	options?: TablatureViewOptions;
}

export const TablatureView: React.FC<TablatureViewProps> = ({
	controller,
	options = {},
}) => {
	// 默认配置
	const {
		showDebugBar = true,
		showPlayBar = true,
		showSettingsPanel = true,
		showTracksPanel = true,
		showMediaSync = true,
		customComponents,
	} = options;
	// 两个 ref：viewport 是滚动容器，container 是 AlphaTab 渲染目标
	const viewportRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// 使用 controller 的实例 store
	const runtimeStore = controller.getRuntimeStore();
	const uiStore = controller.getUIStore();

	// 订阅 UI state
	const settingsPanelOpen = uiStore((s) => s.panels.settingsPanel);
	const tracksPanelOpen = uiStore((s) => s.panels.tracksPanel);
	const mediaSyncOpen = uiStore((s) => s.panels.mediaSyncPanel);
	const loading = uiStore((s) => s.loading);
	const error = runtimeStore((s) => s.error);

	// 切换 Settings 面板
	const handleToggleSettings = () => {
		if (settingsPanelOpen) {
			uiStore.getState().hidePanel('settingsPanel');
		} else {
			if (tracksPanelOpen) {
				uiStore.getState().hidePanel('tracksPanel');
			}
			uiStore.getState().showPanel('settingsPanel');
		}
	};

	// 切换 Tracks 面板
	const handleToggleTracks = () => {
		if (tracksPanelOpen) {
			uiStore.getState().hidePanel('tracksPanel');
		} else {
			if (settingsPanelOpen) {
				uiStore.getState().hidePanel('settingsPanel');
			}
			uiStore.getState().showPanel('tracksPanel');
		}
	};

	// 切换 MediaSync 面板
	const handleToggleMediaSync = () => {
		uiStore.getState().togglePanel('mediaSyncPanel');
	};

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
			{/* 自定义顶部组件或默认 DebugBar */}
			{customComponents?.topBar ? (
				<customComponents.topBar controller={controller} />
			) : showDebugBar ? (
				<DebugBar
					controller={controller}
					viewportRef={viewportRef}
					onSettingsClick={handleToggleSettings}
					onTracksClick={handleToggleTracks}
					onMediaSyncClick={handleToggleMediaSync}
				/>
			) : null}
			{/* Tracks Panel - 音轨管理侧边栏 */}
			{showTracksPanel && (
				<TracksPanel
					controller={controller}
					isOpen={tracksPanelOpen}
					onClose={() => uiStore.getState().hidePanel('tracksPanel')}
				/>
			)}
			{/* Settings Panel - 设置侧边栏 */}
			{showSettingsPanel && (
				<SettingsPanel
					controller={controller}
					isOpen={settingsPanelOpen}
					onClose={() => uiStore.getState().hidePanel('settingsPanel')}
				/>
			)}
			{/* 自定义侧边栏组件 */}
			{customComponents?.sidebars?.map((Sidebar, index) => (
				<Sidebar key={index} controller={controller} />
			))}
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
			{/* 自定义底部组件或默认 PlayBar */}
			{customComponents?.bottomBar ? (
				<customComponents.bottomBar controller={controller} />
			) : showPlayBar ? (
				<PlayBar controller={controller} onTracksClick={handleToggleTracks} />
			) : null}
			{/* MediaSync Panel - 底部媒体同步面板（浮动） */}
			{showMediaSync && (
				<MediaSync
					controller={controller}
					app={controller.getApp()}
					isOpen={mediaSyncOpen}
					onClose={() => uiStore.getState().hidePanel('mediaSyncPanel')}
				/>
			)}
		</div>
	);
};
