import { build } from 'esbuild'; import fs from 'node:fs';
fs.mkdirSync('dist', { recursive: true });
await build({ entryPoints: ['src/capture.jsx'], bundle: true, outfile: 'dist/capture.js', jsx: 'automatic', jsxImportSource: 'preact', minify: !process.argv.includes('--dev'), target: 'chrome120', logLevel: 'warning' });
await build({ entryPoints: ['src/app.jsx'], bundle: true, outfile: 'dist/app.js', jsx: 'automatic', jsxImportSource: 'preact', minify: !process.argv.includes('--dev'), target: 'chrome120', loader: { '.json': 'json' }, define: { __VERSION__: JSON.stringify(JSON.parse(fs.readFileSync('package.json', 'utf8')).version) }, logLevel: 'warning' });
fs.copyFileSync('src/index.html', 'dist/index.html'); fs.copyFileSync('src/capture.html', 'dist/capture.html'); fs.copyFileSync('src/app.css', 'dist/app.css'); fs.copyFileSync('build/icon-256.png', 'dist/icon.png');
fs.mkdirSync('dist/demo', { recursive: true }); for (const f of fs.readdirSync('src/demo-thumbs')) fs.copyFileSync('src/demo-thumbs/' + f, 'dist/demo/' + f);
console.log('build ok', (fs.statSync('dist/app.js').size / 1024 | 0) + ' KB');
