import fs from 'fs';
import path from 'path';

// parse optional directory flag for styles
const args = process.argv.slice(2);
const dirFlagIndex = args.indexOf('--dir');
const dirArg = dirFlagIndex !== -1 ? args[dirFlagIndex + 1] : './styles';
const stylesDir = path.resolve(process.cwd(), dirArg);
const outputFile = path.join(process.cwd(), './styles.css');

if (!fs.existsSync(stylesDir)) {
	console.error(`目录不存在: ${stylesDir}`);
	process.exit(1);
}

/**
 * 递归收集所有 CSS 文件
 * @param {string} dir - 目录路径
 * @param {string[]} fileList - 文件列表（递归累积）
 * @param {string} baseDir - 基础目录（用于相对路径）
 * @returns {string[]} CSS 文件的完整路径列表
 */
function collectCssFilesRecursive(dir, fileList = [], baseDir = '') {
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory()) {
			// 递归进入子目录
			collectCssFilesRecursive(filePath, fileList, baseDir || dir);
		} else if (file.endsWith('.css')) {
			// 收集 CSS 文件
			fileList.push(filePath);
		}
	}

	return fileList;
}

const cssFiles = collectCssFilesRecursive(stylesDir).sort();

// prepend comment indicating current npm script
// const lifecycle = process.env.npm_lifecycle_event || '';
// let merged = lifecycle ? `/* build: ${lifecycle} */\n` : '';
let merged =
	'/* This file is auto generated, to edit this please refer to ./src/styles/*.css  */ \n';
for (const filePath of cssFiles) {
	// 计算相对路径用于注释
	const relativePath = path.relative(stylesDir, filePath);
	merged += `/* --- ${relativePath} --- */\n`;
	merged += fs.readFileSync(filePath, 'utf-8') + '\n';
}

fs.writeFileSync(outputFile, merged, 'utf-8');
console.log(`merged ${cssFiles.length} css files and save to ${outputFile}`);
