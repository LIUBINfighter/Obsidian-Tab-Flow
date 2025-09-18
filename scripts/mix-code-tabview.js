// TabView相关文件合并脚本
// node ./scripts/mix-code-tabview.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ## 1. 参数解析和初始化
// 解析 --dir 参数，默认为 ../src
let userDir = '../src';
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--dir' && process.argv[i + 1]) {
        userDir = process.argv[i + 1];
        break;
    }
}
const srcDir = path.join(__dirname, userDir);

// 定义TabView相关的特定文件路径
const tabViewFiles = [
    'src/components/TracksModal.ts',
    'src/views/TabView.ts',
    'src/state/TrackStateStore.ts',
    'src/types/trackState.ts',
    'src/utils/EventBus.ts',
    'src/events/trackEvents.ts',
    // 设置相关的文件
    'src/settings/defaults.ts',
    'src/settings/SettingTab.ts',
    'src/settings/tabs/generalTab.ts',
    'src/settings/tabs/playerTab.ts',
    'src/settings/tabs/editorTab.ts',
    'src/settings/tabs/aboutTab.ts'
];

// 生成简短的时间戳文件名
function getShortTimestamp() {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${mm}${dd}-${hh}${min}${ss}`;
}

// 检查 ./mix 目录是否存在，不存在则创建
const mixDir = path.join(__dirname, './mix');
if (!fs.existsSync(mixDir)) {
    fs.mkdirSync(mixDir, { recursive: true });
}

const outputFile = path.join(mixDir, `tabview-merged-${getShortTimestamp()}.mix.txt`);

// 检查srcDir是否存在
if (!fs.existsSync(srcDir)) {
    console.error(`目录不存在: ${srcDir}`);
    process.exit(1);
}

// ## 2. 文件合并函数
function mergeTabViewFiles() {
    let merged = '';
    const mergedFiles = [];

    // 在开头写入所有被合并的文档相对路径
    merged += '// TabView相关文件合并列表:\n';

    // 合并指定的TabView相关文件
    tabViewFiles.forEach(relativePath => {
        const filePath = path.join(__dirname, '..', relativePath);
        
        if (fs.existsSync(filePath)) {
            const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
            merged += `// - ./${relPath}\n`;
            mergedFiles.push(relPath);
        } else {
            console.warn(`文件不存在: ${filePath}`);
        }
    });
    merged += '\n';

    // 合并每个文件的内容
    tabViewFiles.forEach(relativePath => {
        const filePath = path.join(__dirname, '..', relativePath);
        
        if (fs.existsSync(filePath)) {
            const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
            merged += `// <-- ./${relPath} -->\n`;
            merged += fs.readFileSync(filePath, 'utf-8') + '\n\n';
        }
    });

    // 添加相关的类型定义和事件文件
    const additionalFiles = [
        'src/types/assets.ts',
        'src/events/types.ts',
        'src/utils/tabViewHelpers.ts'
    ];

    additionalFiles.forEach(relativePath => {
        const filePath = path.join(__dirname, '..', relativePath);
        
        if (fs.existsSync(filePath)) {
            const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
            merged += `// <-- ./${relPath} -->\n`;
            merged += fs.readFileSync(filePath, 'utf-8') + '\n\n';
            mergedFiles.push(relPath);
        }
    });

    fs.writeFileSync(outputFile, merged, 'utf-8');
    console.log(`Merged ${mergedFiles.length} TabView related files into ${outputFile}`);
    console.log('包含的文件:');
    mergedFiles.forEach(file => console.log(`  - ${file}`));
}

// ## 3. 主执行部分
mergeTabViewFiles();
