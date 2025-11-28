import React, { useState } from 'react';
import { Timer } from 'lucide-react';
import type { PlayerController } from '../PlayerController';

interface CountInToggleProps {
	controller: PlayerController;
}

/**
 * CountInToggle - 预备拍开关
 */
export const CountInToggle: React.FC<CountInToggleProps> = ({ controller }) => {
	const globalConfig = controller.getGlobalConfigStore();

	// 从 globalConfig 读取初始预备拍状态（countInBars > 0 表示启用）
	const initialEnabled = globalConfig((s) => s.playerExtensions.countInBars > 0);
	const [enabled, setEnabled] = useState(initialEnabled);

	const handleToggle = () => {
		const newState = !enabled;
		setEnabled(newState);

		// 更新全局配置（持久化）
		// 启用时设置为 1 个小节，禁用时设置为 0
		globalConfig.getState().updatePlayerExtensions({
			countInBars: newState ? 1 : 0,
		});

		controller.setCountIn(newState);
	};

	return (
		<button
			className={`play-bar-button ${enabled ? 'active' : ''}`}
			onClick={handleToggle}
			aria-label="Count In"
			title="Toggle Count In"
		>
			<Timer size={16} />
			<span className="play-bar-button-text">预备拍</span>
		</button>
	);
};
