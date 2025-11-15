/**
 * MediaSyncEditor - 媒体同步编辑器
 *
 * 集成波形编辑和同步点标记，提供完整的媒体同步编辑功能
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WaveformCanvas } from './WaveformCanvas';
import { SyncPointMarkerPanel } from './SyncPointMarkerPanel';
import type { SyncPointInfo } from '../types/sync-point';
import { createDefaultSyncPointInfo } from '../types/sync-point';

export interface MediaSyncEditorProps {
	/** 同步点信息 */
	syncPointInfo: SyncPointInfo;
	/** 同步点变化回调 */
	onSyncPointInfoChanged(info: SyncPointInfo): void;

	/** 当前播放位置（毫秒） */
	playbackTime?: number;
	/** 播放位置变化回调 */
	onPlaybackTimeChange?(time: number): void;

	/** 编辑器宽度 */
	width?: number;
	/** 编辑器高度 */
	height?: number;
}

/**
 * 波形编辑器容器高度占比
 */
const WAVEFORM_HEIGHT_RATIO = 0.7;

/**
 * MediaSyncEditor 组件
 */
export const MediaSyncEditor: React.FC<MediaSyncEditorProps> = ({
	syncPointInfo = createDefaultSyncPointInfo(),
	onSyncPointInfoChanged,
	playbackTime = 0,
	onPlaybackTimeChange,
	width = 800,
	height = 400,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);

	// 编辑状态
	const [actualWidth, setActualWidth] = useState(width);
	const [actualHeight, setActualHeight] = useState(height);
	const [zoom, setZoom] = useState(1);
	const [scrollOffset, setScrollOffset] = useState(0);

	// 编辑器配置
	const pixelPerMilliseconds = 0.1; // 100px per second
	const leftPadding = 15;
	const waveFormHeight = Math.floor(actualHeight * WAVEFORM_HEIGHT_RATIO);
	const markerPanelHeight = actualHeight - waveFormHeight;

	// 监听容器大小变化
	useEffect(() => {
		if (!containerRef.current) return;

		const handleResize = () => {
			setActualWidth(containerRef.current?.clientWidth || width);
			setActualHeight(containerRef.current?.clientHeight || height);
		};

		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(containerRef.current);

		return () => resizeObserver.disconnect();
	}, [width, height]);

	// 处理滚动
	const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
		const target = e.currentTarget;
		setScrollOffset(target.scrollLeft);
	}, []);

	// 处理缩放
	const handleZoom = useCallback((direction: 'in' | 'out') => {
		setZoom((prev) => {
			const factor = direction === 'in' ? 1.2 : 1 / 1.2;
			const newZoom = Math.max(0.5, Math.min(10, prev * factor));
			return newZoom;
		});
	}, []);

	// 重置缩放
	const handleResetZoom = useCallback(() => {
		setZoom(1);
		setScrollOffset(0);
	}, []);

	// 计算虚拟宽度（总时长乘以缩放因子）
	const virtualWidth =
		Math.ceil(syncPointInfo.endTime * pixelPerMilliseconds * zoom) + leftPadding * 2;

	return (
		<div
			ref={containerRef}
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				background: '#ffffff',
				border: '1px solid #e0e0e0',
				borderRadius: '4px',
				overflow: 'hidden',
			}}
		>
			{/* 工具栏 */}
			<div
				style={{
					padding: '8px 12px',
					background: '#f5f5f5',
					borderBottom: '1px solid #e0e0e0',
					display: 'flex',
					gap: '8px',
					alignItems: 'center',
					flexWrap: 'wrap',
				}}
			>
				<button
					onClick={() => handleZoom('out')}
					style={{
						padding: '4px 12px',
						background: '#ffffff',
						border: '1px solid #ddd',
						borderRadius: '4px',
						cursor: 'pointer',
						fontSize: '12px',
					}}
					title="缩小"
				>
					− 缩小
				</button>

				<button
					onClick={handleResetZoom}
					style={{
						padding: '4px 12px',
						background: '#ffffff',
						border: '1px solid #ddd',
						borderRadius: '4px',
						cursor: 'pointer',
						fontSize: '12px',
						minWidth: '60px',
					}}
				>
					{(zoom * 100).toFixed(0)}%
				</button>

				<button
					onClick={() => handleZoom('in')}
					style={{
						padding: '4px 12px',
						background: '#ffffff',
						border: '1px solid #ddd',
						borderRadius: '4px',
						cursor: 'pointer',
						fontSize: '12px',
					}}
					title="放大"
				>
					+ 放大
				</button>

				<div style={{ flex: 1 }} />

				<span style={{ fontSize: '12px', color: '#666' }}>
					时长: {(syncPointInfo.endTime / 1000).toFixed(2)}s | 标记数:
					{syncPointInfo.syncPointMarkers.length}
				</span>
			</div>

			{/* 编辑区域 */}
			<div
				style={{
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
				}}
			>
				{/* 波形和标记面板的滚动容器 */}
				<div
					onScroll={handleScroll}
					style={{
						flex: 1,
						overflow: 'auto',
						position: 'relative',
					}}
				>
					{/* 虚拟容器（用于水平滚动） */}
					<div
						style={{
							width: `${virtualWidth}px`,
							height: `${actualHeight}px`,
							position: 'relative',
						}}
					>
						{/* 波形面板 */}
						<div
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								width: '100%',
								height: `${waveFormHeight}px`,
								background: '#ffffff',
								borderBottom: '1px solid #e0e0e0',
								overflow: 'hidden',
							}}
						>
							<WaveformCanvas
								leftSamples={syncPointInfo.leftSamples}
								rightSamples={syncPointInfo.rightSamples}
								sampleRate={syncPointInfo.sampleRate}
								endTime={syncPointInfo.endTime}
								width={actualWidth}
								height={waveFormHeight}
								zoom={zoom}
								scrollOffset={scrollOffset}
								playbackTime={playbackTime}
								leftPadding={leftPadding}
								timeAxisHeight={20}
								waveFormColor="#436d9d99"
								timeAxisLineColor="#a5a5a5"
								cursorColor="#ff6b6b"
							/>
						</div>

						{/* 同步点标记面板 */}
						<div
							style={{
								position: 'absolute',
								top: waveFormHeight,
								left: 0,
								width: '100%',
								height: `${markerPanelHeight}px`,
								background: '#fafafa',
								borderTop: '1px solid #e0e0e0',
								overflow: 'hidden',
							}}
						>
							<SyncPointMarkerPanel
								syncPointInfo={syncPointInfo}
								onSyncPointInfoChanged={onSyncPointInfoChanged}
								onSeek={(time) => {
									onPlaybackTimeChange?.(time);
								}}
								width={actualWidth}
								height={markerPanelHeight}
								zoom={zoom}
								pixelPerMilliseconds={pixelPerMilliseconds}
								leftPadding={leftPadding}
							/>
						</div>

						{/* 播放光标 */}
						<div
							style={{
								position: 'absolute',
								top: 0,
								left: `${leftPadding + playbackTime * pixelPerMilliseconds * zoom - scrollOffset}px`,
								width: '2px',
								height: `${actualHeight}px`,
								background: '#ff6b6b',
								pointerEvents: 'none',
								opacity: 0.6,
								transition: 'left 0.05s linear',
								zIndex: 10,
							}}
						/>
					</div>
				</div>
			</div>

			{/* 底部状态栏 */}
			<div
				style={{
					padding: '8px 12px',
					background: '#f5f5f5',
					borderTop: '1px solid #e0e0e0',
					fontSize: '12px',
					color: '#666',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
				}}
			>
				<span>
					播放时间: {(playbackTime / 1000).toFixed(2)}s /{' '}
					{(syncPointInfo.endTime / 1000).toFixed(2)}s
				</span>
				<span>
					虚拟宽度: {virtualWidth}px | 缩放: {zoom.toFixed(2)}x
				</span>
			</div>
		</div>
	);
};
