const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
for (const name of fs.readdirSync(root).filter(name => name.endsWith('.js'))) execFileSync(process.execPath, ['--check', path.join(root, name)]);
const manifest = require('../manifest.json');
if (manifest.version !== require('../package.json').version) throw new Error('Versões divergentes.');
for (const file of ['vendor/exceljs.min.js', 'vendor/EXCELJS-LICENSE.txt', manifest.background.service_worker, manifest.action.default_popup]) if (!fs.existsSync(path.join(root, file))) throw new Error(`Arquivo ausente: ${file}`);
console.log('Sintaxe, versão e arquivos obrigatórios conferidos.');
