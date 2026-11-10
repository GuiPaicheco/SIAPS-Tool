const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { zipSync, unzipSync } = require('fflate');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'vendor.cjs')], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(__dirname, 'check.cjs')], { stdio: 'inherit' });
const files = {};
function add(file) {
  const full = path.join(root, file);
  if (fs.statSync(full).isDirectory()) for (const child of fs.readdirSync(full)) add(`${file}/${child}`);
  else files[file] = new Uint8Array(fs.readFileSync(full));
}
for (const file of ['manifest.json', 'background.js', 'catalog.js', 'core.js', 'main.js', 'excel.js', 'popup.js', 'popup.html', 'popup.css', 'vendor', 'assets', 'README.md', 'CHANGELOG.md', 'VALIDACAO.md', 'PENDENCIAS.md']) add(file);
const bytes = zipSync(files, { level: 6, mtime: new Date(2000, 0, 1) });
const extracted = unzipSync(bytes);
for (const [name, buffer] of Object.entries(files)) if (!Buffer.from(buffer).equals(Buffer.from(extracted[name] || []))) throw new Error(`Pacote divergente: ${name}`);
const version = require('../manifest.json').version;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const name = `SIAPS-TOOL-${version}.zip`;
fs.writeFileSync(path.join(root, 'dist', name), bytes);
fs.writeFileSync(path.join(root, 'dist', `${name}.sha256`), crypto.createHash('sha256').update(bytes).digest('hex') + `  ${name}\n`);
console.log(`${name}: ${Object.keys(files).length} arquivos conferidos contra os fontes.`);
