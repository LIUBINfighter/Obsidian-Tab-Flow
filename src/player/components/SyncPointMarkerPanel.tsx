/**
 * SyncPointMarkerPanel - 同步点标记面板
 *
 * 功能：
 * - 显示所有同步点标记
 * - 支持拖拽移动标记
 * - 支持双击激活/禁用标记
 * - 显示 BPM 信息
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SyncPointMarker, SyncPointInfo } from '../types/sync-point';
import { SyncPointMarkerType } from '../types/sync-point';

export interface SyncPointMarkerPanelProps {
	/** 同步点信息 */
	syncPointInfo: SyncPointInfo;
	/** 同步点变化回调 */
	onSyncPointInfoChanged(info: SyncPointInfo): void;
	/** 寻址回调 */
	onSeek(milliseconds: number): void;

	/** 面板宽度（像素） */
	width: number;
	/** 面板高度（像素） */
	height: number;

	/** 缩放级别 */
	zoom: number;
	/** 水平滚动偏移（像素） */
	pixelPerMilliseconds: number;
	/** 左边距（像素） */
	leftPadding: number;
}

/** 拖拽信息 */
interface MarkerDragInfo {
	startX: number;
	startY: number;
	endX: number;
}

const dragLimit = 10;
const dragThreshold = 5;

/**
 * 计算时间位置转换到 X 坐标
 */
function timePositionToX(
	pixelPerMilliseconds: number,
	time: number,
	zoom: number,
	leftPadding: number
): number {
	return leftPadding + time * pixelPerMilliseconds * zoom;
}

/**
 * 计算 X 坐标转换到时间位置
 */
function xToTimePosition(
	pixelPerMilliseconds: number,
	x: number,
	zoom: number,
	leftPadding: number
): number {
	return Math.max(0, (x - leftPadding) / (pixelPerMilliseconds * zoom));
}

/**
 * 生成唯一 ID
 */
// function generateId(): string {
// 	return `${Date.now().toString(32)}-${Math.random().toString(16).slice(2)}`;
// }

/**
 * 构建标记标签
 */
function buildMarkerLabel(marker: SyncPointMarker): string {
	switch (marker.markerType) {
		case SyncPointMarkerType.StartMarker:
			return 'Start';
		case SyncPointMarkerType.EndMarker:
			return 'End';
		case SyncPointMarkerType.MasterBar:
			if (marker.occurence > 0) {
				return `${marker.masterBarIndex + 1} (${marker.occurence + 1})`;
			}
			return `${marker.masterBarIndex + 1}`;
		case SyncPointMarkerType.Intermediate:
			return '';
		default:
			return '';
	}
}

/**
 * 计算标记的内联样式
 */
function computeMarkerInlineStyle(
	marker: SyncPointMarker,
	pixelPerMilliseconds: number,
	zoom: number,
	leftPadding: number,
	draggingMarker: SyncPointMarker | null,
	draggingInfo: MarkerDragInfo | null
): React.CSSProperties {
	let left = timePositionToX(pixelPerMilliseconds, marker.syncTime, zoom, leftPadding);

	if (marker === draggingMarker && draggingInfo) {
		const deltaX = draggingInfo.endX - draggingInfo.startX;
		left += deltaX;
	}

	return {
		left: `${left}px`,
		position: 'absolute',
		top: 0,
		width: '30px',
		height: '100%',
		cursor: marker.syncBpm !== undefined ? 'grab' : 'default',
	};
}

/**
 * 更新同步点信息（移动标记后重新计算）
 */
// function updateSyncPointsAfterModification(
// 	modifiedIndex: number,
// 	syncPointInfo: SyncPointInfo,
// 	isDelete: boolean
// ): SyncPointInfo {
// 	const newInfo = {
// 		...syncPointInfo,
// 		syncPointMarkers: [...syncPointInfo.syncPointMarkers],
// 	};

// 	// 简化版本：只更新当前标记，不重新计算所有标记
// 	// 完整实现可参考官方示例中的复杂算法

// 	return newInfo;
// }

/**
 * SyncPointMarkerPanel 组件
 */
export const SyncPointMarkerPanel: React.FC<SyncPointMarkerPanelProps> = ({
	syncPointInfo,
	onSyncPointInfoChanged,
	onSeek,
	width,
	height,
	zoom,
	pixelPerMilliseconds,
	leftPadding,
}) => {
	const wrapRef = useRef<HTMLDivElement>(null);
	const [draggingMarker, setDraggingMarker] = useState<SyncPointMarker | null>(null);
	const [draggingInfo, setDraggingInfo] = useState<MarkerDragInfo | null>(null);

	/**
	 * 处理标记双击（激活/禁用同步点）
	 */
	const onToggleMarker = useCallback(
		(marker: SyncPointMarker, e: React.MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();

			const markerIndex = syncPointInfo.syncPointMarkers.indexOf(marker);
			if (markerIndex === -1) return;

			const newMarkers = [...syncPointInfo.syncPointMarkers];
			if (marker.syncBpm !== undefined) {
				// 禁用同步点
				newMarkers[markerIndex] = { ...marker, syncBpm: undefined };
			} else {
				// 激活同步点（使用默认的合成器 BPM）
				newMarkers[markerIndex] = { ...marker, syncBpm: marker.synthBpm };
			}

			onSyncPointInfoChanged({
				...syncPointInfo,
				syncPointMarkers: newMarkers,
			});
		},
		[syncPointInfo, onSyncPointInfoChanged]
	);

	/**
	 * 开始拖拽标记
	 */
	const startMarkerDrag = useCallback((marker: SyncPointMarker, e: React.MouseEvent) => {
		if (e.button !== 0 || marker.syncBpm === undefined) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();

		setDraggingMarker(marker);
		setDraggingInfo({
			startX: e.pageX,
			startY: e.pageY,
			endX: e.pageX,
		});
	}, []);

	/**
	 * 处理鼠标移动
	 */
	const mouseMoveListener = useCallback(
		(e: MouseEvent) => {
			if (!draggingMarker || !draggingInfo) return;

			e.preventDefault();
			e.stopPropagation();

			setDraggingInfo((prev) => {
				if (!prev) return prev;

				let newEndX = e.pageX;
				const deltaX = newEndX - prev.startX;

				// 检查边界
				const markerIndex = syncPointInfo.syncPointMarkers.indexOf(draggingMarker);
				if (markerIndex > 0) {
					const prevMarker = syncPointInfo.syncPointMarkers[markerIndex - 1];
					if (prevMarker.syncBpm !== undefined) {
						const prevX = timePositionToX(
							pixelPerMilliseconds,
							prevMarker.syncTime,
							zoom,
							leftPadding
						);
						const minX = prevX + dragLimit;
						const thisX =
							timePositionToX(
								pixelPerMilliseconds,
								draggingMarker.syncTime,
								zoom,
								leftPadding
							) + deltaX;

						if (thisX < minX) {
							newEndX = prev.startX - (thisX - minX);
						}
					}
				}

				if (markerIndex < syncPointInfo.syncPointMarkers.length - 1) {
					const nextMarker = syncPointInfo.syncPointMarkers[markerIndex + 1];
					if (nextMarker.syncBpm !== undefined) {
						const nextX = timePositionToX(
							pixelPerMilliseconds,
							nextMarker.syncTime,
							zoom,
							leftPadding
						);
						const maxX = nextX - dragLimit;
						const thisX =
							timePositionToX(
								pixelPerMilliseconds,
								draggingMarker.syncTime,
								zoom,
								leftPadding
							) + deltaX;

						if (thisX > maxX) {
							newEndX = prev.startX + (maxX - thisX);
						}
					}
				}

				return { ...prev, endX: newEndX };
			});
		},
		[draggingMarker, draggingInfo, syncPointInfo, pixelPerMilliseconds, zoom, leftPadding]
	);

	/**
	 * 处理鼠标抬起（完成拖拽）
	 */
	const mouseUpListener = useCallback(
		(e: MouseEvent) => {
			if (!draggingMarker || !draggingInfo) return;

			e.preventDefault();
			e.stopPropagation();

			const deltaX = draggingInfo.endX - draggingInfo.startX;

			if (
				deltaX > dragThreshold ||
				(draggingMarker.syncBpm !== undefined && Math.abs(deltaX) > 0)
			) {
				const zoomedPixel = pixelPerMilliseconds * zoom;
				const deltaTime = deltaX / zoomedPixel;
				const newTimePosition = Math.max(0, draggingMarker.syncTime + deltaTime);

				const markerIndex = syncPointInfo.syncPointMarkers.indexOf(draggingMarker);
				const newMarkers = syncPointInfo.syncPointMarkers.map((m, i) =>
					i === markerIndex ? { ...m, syncTime: newTimePosition } : m
				);

				onSyncPointInfoChanged({
					...syncPointInfo,
					syncPointMarkers: newMarkers,
				});
			}

			setDraggingMarker(null);
			setDraggingInfo(null);
		},
		[
			draggingMarker,
			draggingInfo,
			syncPointInfo,
			pixelPerMilliseconds,
			zoom,
			onSyncPointInfoChanged,
		]
	);

	/**
	 * 绑定鼠标事件
	 */
	useEffect(() => {
		if (draggingMarker) {
			document.addEventListener('mousemove', mouseMoveListener);
			document.addEventListener('mouseup', mouseUpListener);

			return () => {
				document.removeEventListener('mousemove', mouseMoveListener);
				document.removeEventListener('mouseup', mouseUpListener);
			};
		}
	}, [draggingMarker, mouseMoveListener, mouseUpListener]);

	/**
	 * 处理面板点击（寻址）
	 */
	const onClick = useCallback(
		(e: React.MouseEvent) => {
			if (e.target === wrapRef.current && wrapRef.current) {
				const rect = wrapRef.current.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const time = xToTimePosition(pixelPerMilliseconds, x, zoom, leftPadding);
				onSeek(time);
			}
		},
		[pixelPerMilliseconds, zoom, leftPadding, onSeek]
	);

	return (
		<div
			ref={wrapRef}
			onClick={onClick}
			style={{
				position: 'relative',
				width: `${width}px`,
				height: `${height}px`,
				background: 'transparent',
				cursor: 'crosshair',
				borderTop: '1px solid #e0e0e0',
				borderBottom: '1px solid #e0e0e0',
			}}
		>
			{syncPointInfo.syncPointMarkers.map((marker) => (
				<div
					key={marker.uniqueId}
					style={computeMarkerInlineStyle(
						marker,
						pixelPerMilliseconds,
						zoom,
						leftPadding,
						draggingMarker,
						draggingInfo
					)}
					onDoubleClick={(e) => onToggleMarker(marker, e)}
					onMouseDown={(e) => startMarkerDrag(marker, e)}
					className="sync-point-marker"
					title={`${buildMarkerLabel(marker)} - ${marker.syncTime.toFixed(0)}ms ${marker.syncBpm ? `@ ${marker.syncBpm.toFixed(1)}bpm` : '(disabled)'}`}
				>
					{/* 标记头 */}
					<div
						style={{
							position: 'absolute',
							top: 0,
							left: '50%',
							transform: 'translateX(-50%)',
							width: 0,
							height: 0,
							borderLeft: '5px solid transparent',
							borderRight: '5px solid transparent',
							borderTop: `10px solid ${
								marker.syncBpm !== undefined ? '#ff6b6b' : '#cccccc'
							}`,
							cursor: 'grab',
						}}
					/>

					{/* 标记线 */}
					<div
						style={{
							position: 'absolute',
							left: '50%',
							top: '10px',
							width: '1px',
							height: '100%',
							background: marker.syncBpm !== undefined ? '#ff6b6b' : '#cccccc',
							transform: 'translateX(-50%)',
						}}
					/>

					{/* 标记标签 */}
					{buildMarkerLabel(marker) && (
						<div
							style={{
								position: 'absolute',
								left: '50%',
								top: '15px',
								transform: 'translateX(-50%)',
								fontSize: '11px',
								whiteSpace: 'nowrap',
								background: marker.syncBpm !== undefined ? '#ff6b6b' : '#e0e0e0',
								color: '#ffffff',
								padding: '2px 4px',
								borderRadius: '3px',
								fontWeight: 'bold',
							}}
						>
							{buildMarkerLabel(marker)}
						</div>
					)}

					{/* 标记 BPM */}
					{marker.syncBpm !== undefined &&
						marker.markerType !== SyncPointMarkerType.EndMarker && (
							<div
								style={{
									position: 'absolute',
									left: '50%',
									top: '35px',
									transform: 'translateX(-50%)',
									fontSize: '10px',
									whiteSpace: 'nowrap',
									background: '#ff6b6b',
									color: '#ffffff',
									padding: '2px 3px',
									borderRadius: '2px',
								}}
							>
								{marker.syncBpm.toFixed(1)} bpm
							</div>
						)}
				</div>
			))}
		</div>
	);
};
