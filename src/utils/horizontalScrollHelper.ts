import * as alphaTab from '@coderline/alphatab';

/**
 * 设置元素的滚轮事件，使其在横向布局时将垂直滚轮转写为水平滚动。
 * @param element 要绑定滚轮事件的元素
 * @param api alphaTab API 实例，用于判断布局模式
 * @returns 一个函数，调用此函数可移除事件监听
 */
export function setupHorizontalScroll(element: HTMLElement, api: alphaTab.AlphaTabApi): () => void {
	const handler = (e: WheelEvent) => {
		// 不干预缩放/系统快捷
		if (e.ctrlKey || e.metaKey || e.altKey) return;

		// 根据 alphaTab 的布局模式判断是否需要横向滚动
		const isHorizontalLayout =
			api.settings?.display?.layoutMode ===
			alphaTab.LayoutMode?.Horizontal;
		if (!isHorizontalLayout) return;

		const target = element;
		const canScrollHoriz = target.scrollWidth > target.clientWidth;
		if (!canScrollHoriz) return;

		// 归一化 delta
		const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? target.clientWidth : 1;
		const primaryDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		const dx = primaryDelta * unit;

		const atStart = target.scrollLeft <= 0;
		const atEnd = target.scrollLeft + target.clientWidth >= target.scrollWidth - 1;
		const goingLeft = dx < 0;
		const goingRight = dx > 0;

		// 如果在边界且尝试滚动超出边界，则不阻止默认事件
		if ((atStart && goingLeft) || (atEnd && goingRight)) return;

		target.scrollLeft += dx;
		e.preventDefault();
		e.stopPropagation();
	};

	element.addEventListener('wheel', handler, { passive: false });

	return () => {
		element.removeEventListener('wheel', handler);
	};
}
