import React from 'react';
import { ChevronsUp, ChevronsDown } from 'lucide-react';

interface ScrollButtonsProps {
	viewportRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * ScrollButtons - 快速滚动按钮组
 * 一键滚动到乐谱顶部或底部
 */
export const ScrollButtons: React.FC<ScrollButtonsProps> = ({ viewportRef }) => {
	const scrollToTop = () => {
		if (viewportRef.current) {
			viewportRef.current.scrollTo({ top: 0, behavior: 'smooth' });
		}
	};

	const scrollToBottom = () => {
		if (viewportRef.current) {
			const maxScroll = viewportRef.current.scrollHeight - viewportRef.current.clientHeight;
			viewportRef.current.scrollTo({ top: maxScroll, behavior: 'smooth' });
		}
	};

	return (
		<div className="play-bar-button-group">
			<button
				className="play-bar-button"
				onClick={scrollToTop}
				aria-label="Scroll to Top"
				title="滚动到顶部"
			>
				<ChevronsUp size={16} />
			</button>
			<button
				className="play-bar-button"
				onClick={scrollToBottom}
				aria-label="Scroll to Bottom"
				title="滚动到底部"
			>
				<ChevronsDown size={16} />
			</button>
		</div>
	);
};
