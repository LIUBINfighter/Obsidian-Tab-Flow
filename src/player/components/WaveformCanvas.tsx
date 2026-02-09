/**
 * WaveformCanvas - 波形可视化组件
 *
 * 基于 Canvas 绘制音频波形，支持：
 * - 立体声波形显示
 * - 时间轴标注
 * - 缩放功能
 * - 平滑滚动
 */

import React, { useEffect, useRef, useState } from 'react';

export interface WaveformCanvasProps {
	/** 左声道样本数据 */
	leftSamples: Float32Array;
	/** 右声道样本数据 */
	rightSamples: Float32Array;
	/** 音频采样率（Hz） */
	sampleRate: number;
	/** 音频总时长（毫秒） */
	endTime: number;

	/** Canvas 宽度（像素） */
	width: number;
	/** Canvas 高度（像素） */
	height: number;

	/** 缩放级别 */
	zoom?: number;
	/** 水平滚动偏移（像素） */
	scrollOffset?: number;
	/** 当前播放位置（毫秒） */
	playbackTime?: number;

	/** 波形颜色 */
	waveFormColor?: string;
	/** 时间轴颜色 */
	timeAxisLineColor?: string;
	/** 播放光标颜色 */
	cursorColor?: string;

	/** 左边距（像素） */
	leftPadding?: number;
	/** 时间轴高度（像素） */
	timeAxisHeight?: number;
}

const defaultProps = {
	zoom: 1,
	scrollOffset: 0,
	playbackTime: 0,
	waveFormColor: '#436d9d99',
	timeAxisLineColor: '#a5a5a5',
	cursorColor: '#ff6b6b',
	leftPadding: 15,
	timeAxisHeight: 20,
};

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
 * 格式化时间为 MM:SS
 */
function formatTime(milliseconds: number): string {
	const totalSeconds = Math.abs(milliseconds / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.floor(totalSeconds - minutes * 60);
	return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * 绘制波形帧（背景线）
 */
function drawFrame(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	waveFormY: number,
	halfHeight: number,
	timeAxisHeight: number,
	timeAxisLineColor: string
) {
	ctx.fillStyle = timeAxisLineColor;
	// 中线
	ctx.fillRect(0, waveFormY + halfHeight, width, 1);
	// 分割线
	ctx.fillRect(0, waveFormY, width, 1);
	ctx.fillRect(0, waveFormY + 2 * halfHeight, width, 1);
	// 时间轴上方线
	ctx.fillRect(0, height - timeAxisHeight, width, 1);
}

/**
 * 绘制波形样本
 */
function drawSamples(
	ctx: CanvasRenderingContext2D,
	leftSamples: Float32Array,
	rightSamples: Float32Array,
	sampleRate: number,
	waveFormY: number,
	halfHeight: number,
	startX: number,
	endX: number,
	pixelPerMilliseconds: number,
	zoom: number,
	leftPadding: number,
	scrollOffset: number,
	waveFormColor: string,
	maxAmplitude: number
) {
	ctx.save();
	ctx.translate(-scrollOffset, 0);

	const zoomedPixelPerMilliseconds = pixelPerMilliseconds * zoom;
	const samplesPerPixel = sampleRate / (zoomedPixelPerMilliseconds * 1000);

	ctx.beginPath();

	for (let x = startX; x < endX; x++) {
		const startSample = Math.floor(x * samplesPerPixel);
		const endSample = Math.floor((x + 1) * samplesPerPixel);

		let maxTop = 0;
		let maxBottom = 0;

		for (
			let sample = startSample;
			sample <= endSample && sample < leftSamples.length;
			sample++
		) {
			const magnitudeTop = Math.abs((leftSamples[sample] || 0) / maxAmplitude);
			const magnitudeBottom = Math.abs((rightSamples[sample] || 0) / maxAmplitude);

			if (magnitudeTop > maxTop) maxTop = magnitudeTop;
			if (magnitudeBottom > maxBottom) maxBottom = magnitudeBottom;
		}

		const topBarHeight = Math.min(halfHeight, Math.round(maxTop * halfHeight));
		const bottomBarHeight = Math.min(halfHeight, Math.round(maxBottom * halfHeight));
		const barHeight = topBarHeight + bottomBarHeight || 1;

		ctx.rect(x + leftPadding, waveFormY + halfHeight - topBarHeight, 1, barHeight);
	}

	ctx.fillStyle = waveFormColor;
	ctx.fill();
	ctx.restore();
}

/**
 * 绘制时间轴
 */
function drawTimeAxis(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	timeAxisHeight: number,
	timeAxisY: number,
	pixelPerMilliseconds: number,
	zoom: number,
	leftPadding: number,
	scrollOffset: number,
	timeAxisLineColor: string
) {
	ctx.save();
	ctx.translate(-scrollOffset, 0);

	ctx.fillStyle = timeAxisLineColor;
	const style = window.getComputedStyle(ctx.canvas);
	ctx.font = style.font || '12px sans-serif';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'bottom';

	const zoomedPixelPerMilliseconds = pixelPerMilliseconds * zoom;
	const startX = Math.max(scrollOffset - leftPadding, 0);
	const endX = startX + width + leftPadding;

	const leftTimeSecond = Math.floor((startX - leftPadding) / zoomedPixelPerMilliseconds / 1000);
	const rightTimeSecond = Math.ceil(endX / zoomedPixelPerMilliseconds / 1000);

	const leftTime = Math.max(0, leftTimeSecond * 1000);
	const rightTime = rightTimeSecond * 1000;

	// 绘制秒刻度
	let time = leftTime;
	while (time <= rightTime) {
		const timeX = timePositionToX(pixelPerMilliseconds, time, zoom, leftPadding);
		// 秒刻度线
		ctx.fillRect(timeX, timeAxisY - timeAxisHeight, 1, timeAxisHeight);

		// 时间文本
		const label = formatTime(time);
		ctx.fillText(label, timeX + 3, height - 4);

		// 100ms 子刻度
		const nextSecond = time + 1000;
		let subTime = time;
		while (subTime < nextSecond && subTime <= rightTime) {
			const subTimeX = timePositionToX(pixelPerMilliseconds, subTime, zoom, leftPadding);
			ctx.fillRect(
				subTimeX,
				timeAxisY - Math.ceil(timeAxisHeight * 0.5),
				1,
				Math.ceil(timeAxisHeight * 0.5)
			);
			subTime += 100;
		}

		time += 1000;
	}

	ctx.restore();
}

/**
 * 绘制播放光标
 */
function drawCursor(
	ctx: CanvasRenderingContext2D,
	playbackTime: number,
	pixelPerMilliseconds: number,
	zoom: number,
	leftPadding: number,
	scrollOffset: number,
	cursorColor: string,
	height: number
) {
	const cursorX =
		timePositionToX(pixelPerMilliseconds, playbackTime, zoom, leftPadding) - scrollOffset;

	if (cursorX >= 0 && cursorX <= ctx.canvas.width) {
		ctx.strokeStyle = cursorColor;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(cursorX, 0);
		ctx.lineTo(cursorX, height);
		ctx.stroke();
	}
}

/**
 * 主绘制函数
 */
function drawWaveform(canvas: HTMLCanvasElement, props: WaveformCanvasProps & typeof defaultProps) {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// 计算基础尺寸
	const pixelPerMilliseconds = 100 / 1000; // 100px per second
	const waveFormY = props.timeAxisHeight;
	const halfHeight = (canvas.height - props.timeAxisHeight) / 2;

	// 绘制背景
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// 计算可见区域
	const startX = Math.max(props.scrollOffset - props.leftPadding, 0);
	const endX = startX + canvas.width + props.leftPadding;

	// 计算最大振幅
	let maxAmplitude = 1;
	for (let i = 0; i < props.leftSamples.length; i++) {
		const val = Math.abs(props.leftSamples[i]);
		if (val > maxAmplitude) maxAmplitude = val;
		const val2 = Math.abs(props.rightSamples[i]);
		if (val2 > maxAmplitude) maxAmplitude = val2;
	}

	// 绘制各部分
	drawFrame(
		ctx,
		canvas.width,
		canvas.height,
		waveFormY,
		halfHeight,
		props.timeAxisHeight,
		props.timeAxisLineColor
	);

	drawSamples(
		ctx,
		props.leftSamples,
		props.rightSamples,
		props.sampleRate,
		waveFormY,
		halfHeight,
		startX,
		endX,
		pixelPerMilliseconds,
		props.zoom,
		props.leftPadding,
		props.scrollOffset,
		props.waveFormColor,
		maxAmplitude
	);

	drawTimeAxis(
		ctx,
		canvas.width,
		canvas.height,
		props.timeAxisHeight,
		canvas.height - props.timeAxisHeight,
		pixelPerMilliseconds,
		props.zoom,
		props.leftPadding,
		props.scrollOffset,
		props.timeAxisLineColor
	);

	// 绘制播放光标
	if (props.playbackTime !== undefined) {
		drawCursor(
			ctx,
			props.playbackTime,
			pixelPerMilliseconds,
			props.zoom,
			props.leftPadding,
			props.scrollOffset,
			props.cursorColor,
			canvas.height
		);
	}
}

/**
 * WaveformCanvas 组件
 */
export const WaveformCanvas: React.FC<WaveformCanvasProps> = (props) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [maxAmplitude, setMaxAmplitude] = useState(1);

	const realProps = {
		...defaultProps,
		...props,
		maxAmplitude,
	};

	// 监听样本数据变化，计算最大振幅
	useEffect(() => {
		let amplitude = 0;

		for (let i = 0; i < props.leftSamples.length; i++) {
			const leftVal = Math.abs(props.leftSamples[i]);
			if (leftVal > amplitude) amplitude = leftVal;

			const rightVal = Math.abs(props.rightSamples[i]);
			if (rightVal > amplitude) amplitude = rightVal;
		}

		setMaxAmplitude(amplitude === 0 ? 1 : amplitude);
	}, [props.leftSamples, props.rightSamples]);

	// 监听 props 变化重绘
	useEffect(() => {
		if (canvasRef.current) {
			canvasRef.current.width = props.width;
			canvasRef.current.height = props.height;
			drawWaveform(canvasRef.current, realProps);
		}
	}, [
		props.width,
		props.height,
		props.zoom,
		props.scrollOffset,
		props.playbackTime,
		maxAmplitude,
		props.sampleRate,
		props.endTime,
	]);

	return (
		<canvas
			ref={canvasRef}
			style={{
				display: 'block',
				width: '100%',
				height: '100%',
				background: '#ffffff',
			}}
		/>
	);
};
