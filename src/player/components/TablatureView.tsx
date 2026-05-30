import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

function getErrorTitle(type: string | null): string {
	if (type === 'score-load') return 'AlphaTex 有错误，预览已暂停';
	if (type === 'api-init') return '预览引擎出错';
	if (type === 'soundfont-load') return '音色库加载失败';
	if (type === 'media-load') return '媒体加载失败';
	return '预览出错';
}

function getErrorHint(type: string | null): string {
	if (type === 'score-load') return '先修复编辑器里的红色波浪线，预览会自动恢复。';
	if (type === 'api-init') return '如果修正谱面后仍出现，请重载插件。';
	return '查看下方详情。';
}

export const TablatureView: React.FC<TablatureViewProps> = ({ controller, options = {} }) => {
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
	const errorLines =
		error.message
			?.split('\n')
			.map((line) => line.trim())
			.filter(
				(line) =>
					line.length > 0 &&
					line !== 'AlphaTex preview was not rendered because the source has errors.'
			) ?? [];
	const floatingPanelTarget = typeof document === 'undefined' ? null : document.body;

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

		let disposed = false;
		let initialized = false;

		const tryInitController = () => {
			if (disposed || initialized || !containerRef.current || !viewportRef.current) {
				return;
			}

			const containerRect = containerRef.current.getBoundingClientRect();
			const viewportRect = viewportRef.current.getBoundingClientRect();

			const containerReady = Number.isFinite(containerRect.width) && containerRect.width > 0;
			const viewportReady = Number.isFinite(viewportRect.width) && viewportRect.width > 0;

			if (!containerReady || !viewportReady) {
				console.debug('[TablatureView] Waiting for non-zero layout before init', {
					containerWidth: containerRect.width,
					viewportWidth: viewportRect.width,
				});
				return;
			}

			console.debug('[TablatureView] Initializing controller...');
			initialized = true;
			void controller.init(containerRef.current, viewportRef.current);
		};

		const resizeObserver = new ResizeObserver(() => {
			tryInitController();
		});

		resizeObserver.observe(containerRef.current);
		resizeObserver.observe(viewportRef.current);

		const rafId = window.requestAnimationFrame(() => {
			tryInitController();
		});

		// 清理函数
		return () => {
			disposed = true;
			window.cancelAnimationFrame(rafId);
			resizeObserver.disconnect();
			console.debug('[TablatureView] Cleaning up controller...');
			if (initialized) {
				controller.destroy();
			}
		};
	}, [controller]);

	const floatingPanels = floatingPanelTarget
		? createPortal(
				<>
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
				</>,
				floatingPanelTarget
			)
		: null;

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
			{floatingPanels}
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
				<div className="error-overlay" role="alert">
					<div className="error-card-header">
						<div>
							<div className="error-title">
								<span className="error-dot" aria-hidden="true" />
								{getErrorTitle(error.type)}
							</div>
							<div className="error-hint">{getErrorHint(error.type)}</div>
						</div>
						<button
							type="button"
							className="error-dismiss"
							aria-label="Dismiss preview error"
							onClick={() => runtimeStore.getState().clearError()}
						>
							隐藏
						</button>
					</div>
					<div className="error-message">
						{errorLines.length > 0 ? (
							errorLines.map((line, index) => (
								<div className="error-detail" key={`${index}-${line}`}>
									{line}
								</div>
							))
						) : (
							<div className="error-detail">{error.message}</div>
						)}
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
