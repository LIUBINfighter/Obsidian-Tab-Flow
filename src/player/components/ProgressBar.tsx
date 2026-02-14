import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { PlayerController } from '../PlayerController';

interface ProgressBarProps {
	controller: PlayerController;
	currentMs: number;
	totalMs: number;
	/**
	 * 是否启用交互（可选）
	 * - undefined: 使用全局配置
	 * - true: 强制启用交互
	 * - false: 强制禁用交互（只读模式）
	 */
	enableInteraction?: boolean;
}

/**
 * ProgressBar - 播放进度条 (React 版本)
 *
 * 架构设计：
 * - 参考 AlphaTab 官方文档和旧版 ProgressBar.ts 的正确实现
 * - 使用双层 DOM 结构：外层容器 + 内层进度条
 * - barRef 绑定到**内层 progress-bar**（实际交互目标）
 * - 通过 getBoundingClientRect() 获取准确的点击位置
 *
 * 功能特性：
 * ✅ 已实现：
 * - 显示播放进度
 * - 支持点击跳转（可配置）
 * - 支持拖拽跳转（可配置）
 * - 支持最小/最大宽度限制
 * - 支持禁用交互（观看模式）
 * - 响应全局配置变化
 * - 修复：barRef 绑定到正确的元素，解决线性偏差问题
 * - 新增：组件级 enableInteraction prop，可覆盖全局配置
 *
 * 🔜 待实现（TODO）：
 * - showTooltip: 悬停显示时间提示
 * - showTimestamp: 在进度条上显示时间戳刻度
 * - smoothSeek: 平滑跳转动画
 * - updateInterval: 进度更新节流
 *
 * 配置方式：
 * 1. 全局配置（globalConfig.uiConfig.progressBar）
 * 2. 组件级覆盖（props.enableInteraction）
 *
 * 使用示例：
 * ```tsx
 * // 可交互模式（DebugBar）
 * <ProgressBar
 *   controller={controller}
 *   currentMs={positionMs}
 *   totalMs={durationMs}
 *   enableInteraction={true}
 * />
 *
 * // 只读模式（PlayBar）
 * <ProgressBar
 *   controller={controller}
 *   currentMs={positionMs}
 *   totalMs={durationMs}
 *   enableInteraction={false}
 * />
 *
 * // 使用全局配置（默认）
 * <ProgressBar
 *   controller={controller}
 *   currentMs={positionMs}
 *   totalMs={durationMs}
 * />
 * ```
 *
 * 已知问题修复：
 * - ✅ 修复 barRef 绑定错误导致的拖拽偏差问题
 * - ✅ 清理样式文件，创建独立的 progress-bar.css
 * - ✅ 参考官方文档使用正确的 AlphaTab API
 * - ✅ 修复进度条撑高 DebugBar 的问题
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
	controller,
	currentMs,
	totalMs,
	enableInteraction: enableInteractionProp,
}) => {
	// ========== Refs ==========
	// 关键修复：barRef 绑定到内层 progress-bar，而非外层 container
	const barRef = useRef<HTMLDivElement>(null);

	// ========== State ==========
	const [isDragging, setIsDragging] = useState(false);

	// ========== 订阅全局配置 ==========
	const globalConfig = controller.getGlobalConfigStore();
	const progressBarConfig = globalConfig((s) => s.uiConfig.progressBar);

	// 解构配置
	const {
		enableInteraction: enableInteractionConfig,
		enableDrag: enableDragConfig,
		enableClick: enableClickConfig,
		minWidth,
		maxWidth,
		height,
		showHandle,
		// showTooltip, // TODO: 待实现
		// showTimestamp, // TODO: 待实现
		// smoothSeek, // TODO: 待实现
		// updateInterval, // TODO: 待实现
	} = progressBarConfig;

	// ========== 交互性控制 ==========
	/**
	 * 优先级：
	 * 1. props.enableInteraction（组件级别覆盖）
	 * 2. config.enableInteraction（全局配置）
	 */
	const enableInteraction =
		enableInteractionProp !== undefined ? enableInteractionProp : enableInteractionConfig;

	// 只有在交互启用时，才允许拖拽和点击
	const enableDrag = enableInteraction && enableDragConfig;
	const enableClick = enableInteraction && enableClickConfig;

	// ========== 进度计算 ==========
	// 计算进度百分比
	const progress = totalMs > 0 ? (currentMs / totalMs) * 100 : 0;

	// ========== 交互处理逻辑 ==========
	/**
	 * 处理进度条交互 (点击/拖拽)
	 *
	 * 关键修复点：
	 * 1. 使用 barRef.current（内层 progress-bar）获取准确的 rect
	 * 2. clickX 相对于实际进度条的位置
	 * 3. 避免使用外层容器导致的尺寸偏差
	 */
	const handleProgressInteraction = useCallback(
		(e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
			// 检查是否启用交互
			if (!enableInteraction) return;
			if (!barRef.current || totalMs <= 0) return;

			// 获取进度条的准确位置和尺寸
			const rect = barRef.current.getBoundingClientRect();
			const clickX = (e as MouseEvent).clientX - rect.left;

			// 计算百分比（限制在 0-1 之间）
			const percentage = Math.max(0, Math.min(1, clickX / rect.width));

			// 计算目标时间（毫秒）
			const targetMs = percentage * totalMs;

			// 调试日志（开发时可取消注释）
			// console.debug('[ProgressBar] Seek:', {
			// 	clientX: (e as MouseEvent).clientX,
			// 	rectLeft: rect.left,
			// 	rectWidth: rect.width,
			// 	clickX,
			// 	percentage: (percentage * 100).toFixed(2) + '%',
			// 	targetMs: Math.floor(targetMs),
			// });

			// 通过 controller 跳转（已修复为使用正确的 API）
			controller.seek(Math.floor(targetMs));
		},
		[controller, totalMs, enableInteraction]
	);

	// ========== 鼠标事件处理 ==========
	/**
	 * 鼠标按下 - 区分点击和拖拽
	 */
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

	/**
	 * 鼠标移动 (拖拽中)
	 */
	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (isDragging) {
				handleProgressInteraction(e);
			}
		},
		[isDragging, handleProgressInteraction]
	);

	/**
	 * 鼠标释放
	 */
	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	// ========== 全局事件监听 ==========
	/**
	 * 注册/注销全局鼠标事件（用于拖拽）
	 */
	useEffect(() => {
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
	// 外层容器样式（仅控制尺寸）
	const containerStyle: React.CSSProperties = {
		minWidth: minWidth > 0 ? `${minWidth}px` : undefined,
		maxWidth: maxWidth > 0 ? `${maxWidth}px` : undefined,
		// 固定高度，防止撑高 DebugBar（与 progress-handle 高度一致）
		height: '12px',
	};

	// 进度条样式（控制高度）
	const barStyle: React.CSSProperties = {
		height: `${height}px`,
	};

	// ========== 渲染 ==========
	return (
		<div
			className={`progress-bar-container ${isDragging ? 'dragging' : ''} ${
				!enableInteraction ? 'disabled' : ''
			}`}
			style={containerStyle}
		>
			{/* 关键修复：barRef 绑定到内层 progress-bar */}
			<div
				ref={barRef}
				className={`progress-bar ${isDragging ? 'dragging' : ''}`}
				style={barStyle}
				onMouseDown={handleMouseDown}
			>
				{/* 进度填充 */}
				<div className="progress-fill" style={{ width: `${progress}%` }} />

				{/* 拖拽手柄（根据配置显示/隐藏） */}
				{showHandle && <div className="progress-handle" style={{ left: `${progress}%` }} />}
			</div>
		</div>
	);
};
