import React, { useState } from 'react';
import type { PlayerController } from '../PlayerController';

interface ExportModalProps {
	controller: PlayerController;
	isOpen: boolean;
	onClose: () => void;
}

type ExportFormat = 'wav' | 'mp3' | 'midi' | 'gp';
type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';

/**
 * ExportModal - 导出模态框
 * 
 * 支持导出格式：
 * - WAV: 高质量无损音频
 * - MP3: 压缩音频（通过 WAV 转换）
 * - MIDI: MIDI 文件
 * - GP: Guitar Pro 7 格式
 */
export const ExportModal: React.FC<ExportModalProps> = ({ controller, isOpen, onClose }) => {
	const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('wav');
	const [status, setStatus] = useState<ExportStatus>('idle');
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string>('');

	// 导出选项
	const [sampleRate, setSampleRate] = useState(44100);
	const [masterVolume, setMasterVolume] = useState(0.8);
	const [metronomeVolume, setMetronomeVolume] = useState(0);

	const runtimeStore = controller.getRuntimeStore();
	const api = runtimeStore((s) => s.alphaTabApi);

	if (!isOpen) return null;

	const handleExport = async () => {
		if (!api) {
			setError('AlphaTab API 未就绪');
			return;
		}

		setStatus('exporting');
		setProgress(0);
		setError('');

		try {
			switch (selectedFormat) {
				case 'wav':
					await exportWAV();
					break;
				case 'mp3':
					await exportMP3();
					break;
				case 'midi':
					await exportMIDI();
					break;
				case 'gp':
					await exportGP();
					break;
			}
			setStatus('success');
		} catch (err) {
			console.error('[ExportModal] 导出失败:', err);
			setError(err instanceof Error ? err.message : '导出失败');
			setStatus('error');
		}
	};

	/**
	 * 导出 WAV 音频
	 */
	const exportWAV = async () => {
		if (!api) throw new Error('API not ready');

		// 创建导出选项
		const alphaTab = await import('@coderline/alphatab');
		const options = new alphaTab.synth.AudioExportOptions();
		options.masterVolume = masterVolume;
		options.metronomeVolume = metronomeVolume;
		options.sampleRate = sampleRate;

		// 开始导出
		const exporter = await api.exportAudio(options);

		// 收集音频块
		const chunks: Float32Array[] = [];
		try {
			// eslint-disable-next-line no-constant-condition
			while (true) {
				const chunk = await exporter.render(500); // 每次渲染 500ms
				if (chunk === undefined) {
					break;
				}

				chunks.push(chunk.samples);
				
				// 更新进度（粗略估计）
				const currentTime = chunks.reduce((sum, c) => sum + c.length, 0) / sampleRate / 2;
				const totalTime = api.score?.masterBars.length || 1;
				setProgress(Math.min((currentTime / totalTime) * 100, 99));
			}
		} finally {
			exporter.destroy();
		}

		// 转换为 WAV 格式
		const wav = convertSamplesToWavBlob(chunks, sampleRate);
		
		// 下载文件
		const fileName = getFileName('wav');
		downloadBlob(wav, fileName);
		
		setProgress(100);
	};

	/**
	 * 导出 MP3 音频
	 * 注意：浏览器不支持直接导出 MP3，需要先导出 WAV 然后提示用户转换
	 */
	const exportMP3 = async () => {
		// 先导出 WAV
		await exportWAV();
		
		// 提示用户使用在线工具转换
		alert('WAV 文件已导出。\n\n要转换为 MP3，您可以使用在线工具如：\n- https://cloudconvert.com/wav-to-mp3\n- https://convertio.co/wav-mp3/');
	};

	/**
	 * 导出 MIDI 文件
	 */
	const exportMIDI = async () => {
		if (!api) throw new Error('API not ready');

		setProgress(50);
		
		// 使用 AlphaTab 的 downloadMidi 方法
		api.downloadMidi();
		
		setProgress(100);
	};

	/**
	 * 导出 Guitar Pro 文件
	 */
	const exportGP = async () => {
		if (!api?.score) throw new Error('No score loaded');

		setProgress(30);

		const alphaTab = await import('@coderline/alphatab');
		const exporter = new alphaTab.exporter.Gp7Exporter();
		
		setProgress(60);
		
		const data = exporter.export(api.score, api.settings);
		
		setProgress(80);
		
		// 创建下载 - 转换为标准 ArrayBuffer
		const buffer = new Uint8Array(data).buffer;
		const blob = new Blob([buffer], { type: 'application/octet-stream' });
		const fileName = getFileName('gp');
		downloadBlob(blob, fileName);
		
		setProgress(100);
	};

	/**
	 * 将音频样本转换为 WAV Blob
	 */
	const convertSamplesToWavBlob = (chunks: Float32Array[], sampleRate: number): Blob => {
		const alphaTab = require('@coderline/alphatab');
		
		const samples = chunks.reduce((p, c) => p + c.length, 0);
		const wavHeaderSize = 44;
		const fileSize = wavHeaderSize + samples * 4;
		const buffer = alphaTab.io.ByteBuffer.withCapacity(fileSize);

		// 写入 WAV 头部
		// RIFF chunk
		buffer.write(new Uint8Array([0x52, 0x49, 0x46, 0x46]), 0, 4); // "RIFF"
		alphaTab.io.IOHelper.writeInt32LE(buffer, fileSize - 8);
		buffer.write(new Uint8Array([0x57, 0x41, 0x56, 0x45]), 0, 4); // "WAVE"

		// format chunk
		buffer.write(new Uint8Array([0x66, 0x6D, 0x74, 0x20]), 0, 4); // "fmt "
		alphaTab.io.IOHelper.writeInt32LE(buffer, 16); // block size
		alphaTab.io.IOHelper.writeInt16LE(buffer, 3); // audio format (IEEE float)
		const channels = 2;
		alphaTab.io.IOHelper.writeInt16LE(buffer, channels);
		alphaTab.io.IOHelper.writeInt32LE(buffer, sampleRate);
		alphaTab.io.IOHelper.writeInt32LE(buffer, Float32Array.BYTES_PER_ELEMENT * channels * sampleRate);
		const bitsPerSample = Float32Array.BYTES_PER_ELEMENT * 8;
		alphaTab.io.IOHelper.writeInt16LE(buffer, channels * Math.floor((bitsPerSample + 7) / 8));
		alphaTab.io.IOHelper.writeInt16LE(buffer, bitsPerSample);

		// data chunk
		buffer.write(new Uint8Array([0x64, 0x61, 0x74, 0x61]), 0, 4); // "data"
		alphaTab.io.IOHelper.writeInt32LE(buffer, samples * 4);
		for (const c of chunks) {
			const bytes = new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
			buffer.write(bytes, 0, bytes.length);
		}

		return new Blob([buffer.toArray()], { type: 'audio/wav' });
	};

	/**
	 * 获取文件名
	 */
	const getFileName = (extension: string): string => {
		const score = api?.score;
		const title = score?.title || 'Untitled';
		const artist = score?.artist || '';
		
		let fileName = title;
		if (artist) {
			fileName += ` - ${artist}`;
		}
		
		return `${fileName}.${extension}`;
	};

	/**
	 * 下载 Blob
	 */
	const downloadBlob = (blob: Blob, fileName: string) => {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const formatOptions = [
		{ value: 'wav' as ExportFormat, label: 'WAV 音频', desc: '无损高质量音频' },
		{ value: 'mp3' as ExportFormat, label: 'MP3 音频', desc: '压缩音频（需转换）' },
		{ value: 'midi' as ExportFormat, label: 'MIDI 文件', desc: '标准 MIDI 格式' },
		{ value: 'gp' as ExportFormat, label: 'Guitar Pro', desc: 'GP7 格式文件' },
	];

	return (
		<div className="modal-container mod-dim" onClick={onClose}>
			<div className="modal mod-settings" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<div className="modal-title">导出乐谱</div>
					<button
						className="clickable-icon modal-close-button"
						onClick={onClose}
						aria-label="关闭"
					>
						<svg className="svg-icon lucide-x" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</div>

				<div className="modal-content" style={{ padding: '20px' }}>
					{/* 格式选择 */}
					<div className="setting-item">
						<div className="setting-item-info">
							<div className="setting-item-name">导出格式</div>
							<div className="setting-item-description">选择要导出的文件格式</div>
						</div>
						<div className="setting-item-control">
							<select
								value={selectedFormat}
								onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
								disabled={status === 'exporting'}
							>
								{formatOptions.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label} - {opt.desc}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* 音频选项（仅 WAV/MP3 显示） */}
					{(selectedFormat === 'wav' || selectedFormat === 'mp3') && (
						<>
							<div className="setting-item">
								<div className="setting-item-info">
									<div className="setting-item-name">采样率</div>
									<div className="setting-item-description">音频采样率（Hz）</div>
								</div>
								<div className="setting-item-control">
									<select
										value={sampleRate}
										onChange={(e) => setSampleRate(Number(e.target.value))}
										disabled={status === 'exporting'}
									>
										<option value={22050}>22050 Hz</option>
										<option value={44100}>44100 Hz (CD 质量)</option>
										<option value={48000}>48000 Hz</option>
									</select>
								</div>
							</div>

							<div className="setting-item">
								<div className="setting-item-info">
									<div className="setting-item-name">主音量</div>
									<div className="setting-item-description">导出音频的主音量</div>
								</div>
								<div className="setting-item-control">
									<input
										type="range"
										min="0"
										max="1"
										step="0.1"
										value={masterVolume}
										onChange={(e) => setMasterVolume(Number(e.target.value))}
										disabled={status === 'exporting'}
									/>
									<span style={{ marginLeft: '10px' }}>{Math.round(masterVolume * 100)}%</span>
								</div>
							</div>

							<div className="setting-item">
								<div className="setting-item-info">
									<div className="setting-item-name">节拍器音量</div>
									<div className="setting-item-description">导出时包含节拍器声音</div>
								</div>
								<div className="setting-item-control">
									<input
										type="range"
										min="0"
										max="1"
										step="0.1"
										value={metronomeVolume}
										onChange={(e) => setMetronomeVolume(Number(e.target.value))}
										disabled={status === 'exporting'}
									/>
									<span style={{ marginLeft: '10px' }}>
										{metronomeVolume === 0 ? '关闭' : `${Math.round(metronomeVolume * 100)}%`}
									</span>
								</div>
							</div>
						</>
					)}

					{/* 进度显示 */}
					{status === 'exporting' && (
						<div className="setting-item">
							<div className="setting-item-info">
								<div className="setting-item-name">导出进度</div>
							</div>
							<div className="setting-item-control" style={{ width: '100%' }}>
								<div
									style={{
										width: '100%',
										height: '8px',
										backgroundColor: 'var(--background-modifier-border)',
										borderRadius: '4px',
										overflow: 'hidden',
										marginTop: '10px',
									}}
								>
									<div
										style={{
											width: `${progress}%`,
											height: '100%',
											backgroundColor: 'var(--interactive-accent)',
											transition: 'width 0.3s ease',
										}}
									/>
								</div>
								<div style={{ marginTop: '5px', textAlign: 'center', fontSize: '0.9em' }}>
									{Math.round(progress)}%
								</div>
							</div>
						</div>
					)}

					{/* 状态消息 */}
					{status === 'success' && (
						<div className="setting-item" style={{ color: 'var(--text-success)' }}>
							✓ 导出成功！
						</div>
					)}

					{error && (
						<div className="setting-item" style={{ color: 'var(--text-error)' }}>
							✗ {error}
						</div>
					)}
				</div>

				<div className="modal-button-container">
					<button
						className="mod-cta"
						onClick={handleExport}
						disabled={status === 'exporting'}
					>
						{status === 'exporting' ? '导出中...' : '开始导出'}
					</button>
					<button onClick={onClose} disabled={status === 'exporting'}>
						{status === 'success' ? '关闭' : '取消'}
					</button>
				</div>
			</div>
		</div>
	);
};
