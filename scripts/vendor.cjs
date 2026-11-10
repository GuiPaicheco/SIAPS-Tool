const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.dirname(require.resolve('exceljs/package.json'));
fs.mkdirSync(path.join(root, 'vendor'), { recursive: true });
for (const [from, to] of [['dist/exceljs.min.js', 'exceljs.min.js'], ['LICENSE', 'EXCELJS-LICENSE.txt']]) fs.copyFileSync(path.join(source, from), path.join(root, 'vendor', to));
console.log('ExcelJS 4.4.0 copiado para vendor/ com licença.');
