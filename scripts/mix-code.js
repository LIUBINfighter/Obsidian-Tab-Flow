// 这是一个简单的repomix思路的脚本
// node ./scripts/mix-code.js
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
const stylesFile = path.join(__dirname, '../styles.css');
const readmeFile = path.join(__dirname, '../README.md');
const githubWorkflowsDir = path.join(__dirname, '../.github/workflows');

// 生成简短的时间戳文件名
function getShortTimestamp() {
    const now = new Date();
    // const yyyy = now.getFullYear(); // 删除年份
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

const outputFile = path.join(mixDir, `merged-${getShortTimestamp()}.mix.txt`);

// 检查srcDir是否存在
if (!fs.existsSync(srcDir)) {
    console.error(`目录不存在: ${srcDir}`);
    process.exit(1);
}

// ## 2. 文件扫描函数
function getAllTsFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllTsFiles(filePath));
        } else if (file.endsWith('.ts')) {
            results.push(filePath);
        }
    });
    return results;
}

function getAllYmlFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) {
        return results;
    }
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllYmlFiles(filePath));
        } else if (file.endsWith('.yml') || file.endsWith('.yaml')) {
            results.push(filePath);
        }
    });
    return results;
}

// ## 3. 文件合并函数
function mergeFiles() {
    const tsFiles = getAllTsFiles(srcDir);
    const ymlFiles = getAllYmlFiles(githubWorkflowsDir);
    let merged = '';

    // 在开头写入所有被合并的文档相对路径
    merged += '// Merged files list:\n';
    if (fs.existsSync(readmeFile)) {
        const relPath = path.relative(process.cwd(), readmeFile).replace(/\\/g, '/');
        merged += `// - ./${relPath}\n`;
    }
    tsFiles.forEach(file => {
        const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
        merged += `// - ./${relPath}\n`;
    });
    if (fs.existsSync(stylesFile)) {
        const relPath = path.relative(process.cwd(), stylesFile).replace(/\\/g, '/');
        merged += `// - ./${relPath}\n`;
    }
    ymlFiles.forEach(file => {
        const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
        merged += `// - ./${relPath}\n`;
    });
    merged += '\n';

    // 合并 README.md
    if (fs.existsSync(readmeFile)) {
        merged += '## README.md\n\n';
        const relPath = path.relative(process.cwd(), readmeFile).replace(/\\/g, '/');
        merged += `// <-- ./${relPath} -->\n`;
        merged += fs.readFileSync(readmeFile, 'utf-8') + '\n\n';
    }

    // 合并 TypeScript 文件
    if (tsFiles.length > 0) {
        merged += '## TypeScript Source Files\n\n';
        tsFiles.forEach(file => {
            const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
            merged += `// <-- ./${relPath} -->\n`;
            merged += fs.readFileSync(file, 'utf-8') + '\n\n';
        });
    }

    // 合并 styles.css
    if (fs.existsSync(stylesFile)) {
        merged += '## Styles\n\n';
        const relPath = path.relative(process.cwd(), stylesFile).replace(/\\/g, '/');
        merged += `// <-- ./${relPath} -->\n`;
        merged += fs.readFileSync(stylesFile, 'utf-8') + '\n\n';
    }

    // 合并 GitHub Actions yml 文件
    if (ymlFiles.length > 0) {
        merged += '## GitHub Actions Workflows\n\n';
        ymlFiles.forEach(file => {
            const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
            merged += `# <-- ./${relPath} -->\n`;
            merged += fs.readFileSync(file, 'utf-8') + '\n\n';
        });
    }

    fs.writeFileSync(outputFile, merged, 'utf-8');
    const ymlCount = ymlFiles.length;
    console.log(`Merged ${tsFiles.length} ts files${fs.existsSync(stylesFile) ? ', styles.css' : ''}${fs.existsSync(readmeFile) ? ', README.md' : ''}${ymlCount > 0 ? `, ${ymlCount} yml files` : ''} into ${outputFile}`);
}

// ## 4. 主执行部分
mergeFiles();
