// 简单的类型声明文件，避免依赖外部类型包
declare module "color-convert" {
	interface HSL {
		hex(hsl: [number, number, number]): string;
	}

	const convert: {
		hsl: HSL;
	};

	export = convert;
}
