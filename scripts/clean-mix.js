// 这是一个清除 mix 文件夹下生成内容的脚本
// node ./scripts/clean-mix.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
