import React, { useRef, useState, useCallback } from 'react';
import type { PlayerController } from '../PlayerController';

interface ProgressBarProps {
	controller: PlayerController;
	currentMs: number;
	totalMs: number;
}

/**
 * ProgressBar - 播放进度条 (React 版本)
 *
 * 功能特性：
 * ✅ 已实现：
 * - 显示播放进度
 * - 支持点击跳转（可配置）
 * - 支持拖拽跳转（可配置）
 * - 支持最小/最大宽度限制
 * - 支持禁用交互（观看模式）
 * - 响应全局配置变化
 *
 * 🔜 待实现（TODO）：
 * - showTooltip: 悬停显示时间提示
 * - showTimestamp: 在进度条上显示时间戳刻度
 * - smoothSeek: 平滑跳转动画
 * - updateInterval: 进度更新节流
 *
 * 配置位置：
 * - 当前：使用 globalConfig.uiConfig.progressBar 的默认值
 * - TODO: 用户可在设置面板中修改（需要在 SettingsPanel 中添加 UI）
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ controller, currentMs, totalMs }) => {
	const barRef = useRef<HTMLDivElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	// ========== 订阅全局配置 ==========
	const globalConfig = controller.getGlobalConfigStore();
	const progressBarConfig = globalConfig((s) => s.uiConfig.progressBar);

	// 解构配置
	const {
		enableInteraction,
		enableDrag,
		enableClick,
		minWidth,
		maxWidth,
		height,
		showHandle,
		// showTooltip, // TODO: 待实现
		// showTimestamp, // TODO: 待实现
		// smoothSeek, // TODO: 待实现
		// updateInterval, // TODO: 待实现
	} = progressBarConfig;

	// 计算进度百分比
	const progress = totalMs > 0 ? (currentMs / totalMs) * 100 : 0;

	// ========== 交互处理逻辑 ==========
	// 处理进度条交互 (点击/拖拽)
	const handleProgressInteraction = useCallback(
		(e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
			// 检查是否启用交互
			if (!enableInteraction) return;
			if (!barRef.current || totalMs <= 0) return;

			const rect = barRef.current.getBoundingClientRect();
			const clickX = (e as MouseEvent).clientX - rect.left;
			const percentage = Math.max(0, Math.min(1, clickX / rect.width));
			const targetMs = percentage * totalMs;

			// 通过 controller 跳转
			controller.seek(Math.floor(targetMs));
		},
		[controller, totalMs, enableInteraction]
	);

	// 鼠标按下 - 区分点击和拖拽
	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!enableInteraction) return;

		// 如果启用点击，立即跳转
		if (enableClick) {
			handleProgressInteraction(e);
		}

		// 如果启用拖拽，进入拖拽模式
		if (enableDrag) {
			setIsDragging(true);
		}

		e.preventDefault();
	};

	// 鼠标移动 (拖拽中)
	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (isDragging) {
				handleProgressInteraction(e);
			}
		},
		[isDragging, handleProgressInteraction]
	);

	// 鼠标释放
	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	// 注册/注销全局事件
	React.useEffect(() => {
		if (isDragging) {
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			return () => {
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
			};
		}
	}, [isDragging, handleMouseMove, handleMouseUp]);

	// ========== 样式计算 ==========
	const containerStyle: React.CSSProperties = {
		minWidth: minWidth > 0 ? `${minWidth}px` : undefined,
		maxWidth: maxWidth > 0 ? `${maxWidth}px` : undefined,
		cursor: enableInteraction ? 'pointer' : 'default',
	};

	const barStyle: React.CSSProperties = {
		height: `${height}px`,
	};

	return (
		<div
			ref={barRef}
			className={`progress-bar-container ${isDragging ? 'dragging' : ''} ${
				!enableInteraction ? 'disabled' : ''
			}`}
			style={containerStyle}
			onMouseDown={handleMouseDown}
		>
			<div className="progress-bar" style={barStyle}>
				<div className="progress-fill" style={{ width: `${progress}%` }} />
				{/* 根据配置显示/隐藏拖拽手柄 */}
				{showHandle && <div className="progress-handle" style={{ left: `${progress}%` }} />}
			</div>
		</div>
	);
};
