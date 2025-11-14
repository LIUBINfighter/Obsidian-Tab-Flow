declare module 'dom-to-image-more' {
	interface DomToImageOptions {
		width?: number;
		height?: number;
		style?: Record<string, string>;
		bgcolor?: string;
		quality?: number;
		cacheBust?: boolean;
		imagePlaceholder?: string;
		filter?: (node: Node) => boolean;
	}

	interface DomToImage {
		toBlob(node: Node, options?: DomToImageOptions): Promise<Blob | null>;
		toPng(node: Node, options?: DomToImageOptions): Promise<string>;
		toJpeg(node: Node, options?: DomToImageOptions): Promise<string>;
		toSvg(node: Node, options?: DomToImageOptions): Promise<string>;
	}

	const domToImage: DomToImage;
	export = domToImage;
}
