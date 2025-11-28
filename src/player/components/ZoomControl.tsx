import React, { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import type { PlayerController } from '../PlayerController';

interface ZoomControlProps {
	controller: PlayerController;
}

/**
 * ZoomControl - 缩放控制
 * 50% ~ 200% 缩放选择
 */
export const ZoomControl: React.FC<ZoomControlProps> = ({ controller }) => {
	const globalConfig = controller.getGlobalConfigStore();

	const zoomLevels = [
		{ label: '50%', value: 0.5 },
		{ label: '75%', value: 0.75 },
		{ label: '100%', value: 1.0 },
		{ label: '125%', value: 1.25 },
		{ label: '150%', value: 1.5 },
		{ label: '200%', value: 2.0 },
	];

	// 从 globalConfig 读取初始缩放值
	const initialZoom = globalConfig((s) => s.alphaTabSettings.display.scale);
	const [currentZoom, setCurrentZoom] = useState(initialZoom);

	const handleZoomChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const zoom = parseFloat(e.target.value);
		if (!isNaN(zoom)) {
			setCurrentZoom(zoom);

			// 更新全局配置（持久化）
			globalConfig.getState().updateAlphaTabSettings({
				display: { ...globalConfig.getState().alphaTabSettings.display, scale: zoom },
			});

			// 同步到 API
			controller.setZoom(zoom);
		}
	};

	return (
		<div className="play-bar-control">
			<ZoomIn size={16} className="play-bar-control-icon" />
			<select
				className="play-bar-control-select"
				value={currentZoom}
				onChange={handleZoomChange}
				aria-label="Zoom Level"
				title="缩放级别"
			>
				{zoomLevels.map(({ label, value }) => (
					<option key={value} value={value}>
						{label}
					</option>
				))}
			</select>
		</div>
	);
};
