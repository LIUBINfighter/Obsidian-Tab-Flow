/**
 * TracksPanel - 音轨管理侧边栏
 * 
 * 参考 SettingsPanel 设计，提供侧边栏形式的音轨管理界面
 * 用户可以实时查看修改后的效果，无需关闭面板
 */

import type * as AlphaTab from '@coderline/alphatab';
import React, { useState, useEffect } from 'react';
import type { PlayerController } from '../PlayerController';
import { useAlphaTabEvent } from '../hooks';
import { TrackItem } from './TrackItem';

export interface TracksPanelProps {
	controller: PlayerController;
	isOpen: boolean;
	onClose: () => void;
}

export const TracksPanel: React.FC<TracksPanelProps> = ({ controller, isOpen, onClose }) => {
	const runtimeStore = controller.getRuntimeStore();
	const api = runtimeStore((s) => s.alphaTabApi);

	// 当前曲谱
	const [score, setScore] = useState<AlphaTab.model.Score | null>(null);

	// 已选中的音轨
	const [selectedTracks, setSelectedTracks] = useState<Map<number, AlphaTab.model.Track>>(new Map());

	// 监听事件
	useEffect(() => {
		if (!api) return;

		// 初始化曲谱和选中音轨
		if (api.score) {
			setScore(api.score);

			const initialSelectedTracks = new Map<number, AlphaTab.model.Track>();
			for (const track of api.tracks) {
				initialSelectedTracks.set(track.index, track);
			}
			setSelectedTracks(initialSelectedTracks);
		}
	}, [api]);

	// 监听 renderStarted 更新选中音轨
	useAlphaTabEvent(
		api,
		'renderStarted',
		() => {
			if (!api) return;

			const newSelectedTracks = new Map<number, AlphaTab.model.Track>();
			for (const track of api.tracks) {
				newSelectedTracks.set(track.index, track);
			}
			setSelectedTracks(newSelectedTracks);
		},
		[api]
	);

	// 监听 scoreLoaded 更新曲谱
	useAlphaTabEvent<AlphaTab.model.Score>(
		api,
		'scoreLoaded',
		(loadedScore) => {
			setScore(loadedScore);
		},
		[api]
	);

	// 事件处理
	const handleTrackSelectionChange = (track: AlphaTab.model.Track, selected: boolean) => {
		console.log('[TracksPanel] 音轨选择变化', {
			track: track.name,
			index: track.index,
			selected,
		});
	};

	const selectAllTracks = () => {
		if (!api || !score) return;

		const allTracks = score.tracks.slice().sort((a, b) => a.index - b.index);
		api.renderTracks(allTracks);
	};

	const deselectAllTracks = () => {
		if (!api || !score || score.tracks.length === 0) return;

		// 只渲染第一个音轨
		api.renderTracks([score.tracks[0]]);
	};

	if (!api || !score) {
		return null;
	}

	return (
		<div className={`tracks-panel ${isOpen ? 'tracks-panel-open' : ''}`}>
			{/* Header */}
			<div className="tracks-panel-header">
				<h3>Tracks Management</h3>
				<div className="tracks-panel-header-actions">
					<button
						type="button"
						className="tracks-panel-button tracks-panel-button-sm"
						onClick={selectAllTracks}
						title="Select all tracks">
						All
					</button>
					<button
						type="button"
						className="tracks-panel-button tracks-panel-button-sm"
						onClick={deselectAllTracks}
						title="Clear selection (keep first)">
						Clear
					</button>
					<button
						type="button"
						className="tracks-panel-close"
						onClick={onClose}
						aria-label="Close tracks panel">
						✕
					</button>
				</div>
			</div>

			{/* Content */}
			<div className="tracks-panel-content">
				{score.tracks.length === 0 ? (
					<div className="tracks-panel-empty">
						<p>No tracks available in current score</p>
					</div>
				) : (
					score.tracks.map((track) => (
						<TrackItem
							key={track.index}
							api={api}
							track={track}
							isSelected={selectedTracks.has(track.index)}
							onSelectionChange={handleTrackSelectionChange}
						/>
					))
				)}
			</div>

			{/* Footer */}
			<div className="tracks-panel-footer">
				<div className="tracks-panel-info">
					<span>
						{selectedTracks.size} / {score.tracks.length} tracks selected
					</span>
				</div>
			</div>
		</div>
	);
};
