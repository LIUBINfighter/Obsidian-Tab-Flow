import React, { useState } from 'react';
import * as alphaTab from '@coderline/alphatab';
import type { PlayerController } from '../PlayerController';

interface StaveProfileControlProps {
	controller: PlayerController;
}

/**
 * StaveProfileControl - 谱表模式控制
 * 五线+六线、仅五线、仅六线、混合六线
 */
export const StaveProfileControl: React.FC<StaveProfileControlProps> = ({ controller }) => {
	const profiles = [
		{ name: '五线+六线', value: alphaTab.StaveProfile.ScoreTab },
		{ name: '仅五线谱', value: alphaTab.StaveProfile.Score },
		{ name: '仅六线谱', value: alphaTab.StaveProfile.Tab },
		{ name: '混合六线谱', value: alphaTab.StaveProfile.TabMixed },
	];

	const [currentProfile, setCurrentProfile] = useState<alphaTab.StaveProfile>(
		alphaTab.StaveProfile.ScoreTab
	);

	const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const profile = parseInt(e.target.value) as alphaTab.StaveProfile;
		setCurrentProfile(profile);
		controller.setStaveProfile(profile);
	};

	return (
		<div className="play-bar-stave">
			<label className="stave-label">谱表:</label>
			<select
				className="stave-select"
				value={currentProfile}
				onChange={handleProfileChange}
				aria-label="Stave Profile"
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
