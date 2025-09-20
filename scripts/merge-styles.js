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

const cssFiles = fs.readdirSync(stylesDir)
    .filter(f => f.endsWith('.css'))
    .sort();

// prepend comment indicating current npm script
// const lifecycle = process.env.npm_lifecycle_event || '';
// let merged = lifecycle ? `/* build: ${lifecycle} */\n` : '';
   let merged = "/* This file is auto generated, to edit this please refer to ./src/styles/*.css  */ \n";
for (const file of cssFiles) {
    const filePath = path.join(stylesDir, file);
    merged += `/* --- ${file} --- */\n`;
    merged += fs.readFileSync(filePath, 'utf-8') + '\n';
}

fs.writeFileSync(outputFile, merged, 'utf-8');
console.log(`merged ${cssFiles.length} css files and save to ${outputFile}`);
