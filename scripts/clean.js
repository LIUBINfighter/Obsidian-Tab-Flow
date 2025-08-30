// 这是一个增强的清除脚本，可以删除指定的文件并处理 mix 目录
// node ./scripts/clean.js --delete file1 file2 file3
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

// 解析命令行参数
const args = process.argv.slice(2);
let filesToDelete = [];

if (args[0] === '--delete') {
    filesToDelete = args.slice(1);
}

// 删除指定的文件
filesToDelete.forEach(file => {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
        console.log(`Deleted ${file}`);
    } else {
        console.log(`${file} does not exist.`);
    }
});

// 处理 mix 目录
const mixDir = path.join(__dirname, './mix');

if (fs.existsSync(mixDir)) {
    fs.rmSync(mixDir, { recursive: true, force: true });
    console.log('Cleared all files in mix directory.');
} else {
    console.log('Mix directory does not exist.');
}

// 重新创建 mix 目录
fs.mkdirSync(mixDir, { recursive: true });
console.log('Recreated mix directory.');
