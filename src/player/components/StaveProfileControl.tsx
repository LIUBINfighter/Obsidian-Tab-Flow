import React, { useState } from 'react';
import { Music } from 'lucide-react';
import * as alphaTab from '@coderline/alphatab';
import type { PlayerController } from '../PlayerController';

interface StaveProfileControlProps {
	controller: PlayerController;
}

/**
 * StaveProfileControl - 谱表模式控制
 * 切换五线谱、六线谱显示模式
 */
export const StaveProfileControl: React.FC<StaveProfileControlProps> = ({ controller }) => {
	const globalConfig = controller.getGlobalConfigStore();

	const profiles = [
		{ name: '五线谱+六线谱', value: alphaTab.StaveProfile.ScoreTab },
		{ name: '仅五线谱', value: alphaTab.StaveProfile.Score },
		{ name: '仅六线谱', value: alphaTab.StaveProfile.Tab },
		{ name: '混合模式', value: alphaTab.StaveProfile.TabMixed },
	];

	// 从 globalConfig 读取初始谱表模式
	const initialProfile = globalConfig((s) => s.alphaTabSettings.display.staveProfile);
	const [profile, setProfile] = useState<alphaTab.StaveProfile>(initialProfile);

	const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newProfile = parseInt(e.target.value) as alphaTab.StaveProfile;
		setProfile(newProfile);

		// 更新全局配置（持久化）
		globalConfig.getState().updateAlphaTabSettings({
			display: {
				...globalConfig.getState().alphaTabSettings.display,
				staveProfile: newProfile,
			},
		});

		// 同步到 API
		controller.setStaveProfile(newProfile);
	};

	return (
		<div className="play-bar-control">
			<Music size={16} className="play-bar-control-icon" />
			<select
				className="play-bar-control-select"
				value={profile}
				onChange={handleChange}
				aria-label="Stave Profile"
				title="谱表模式"
			>
				{profiles.map(({ name, value }) => (
					<option key={value} value={value}>
						{name}
					</option>
				))}
			</select>
		</div>
	);
};
