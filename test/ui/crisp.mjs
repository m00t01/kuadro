// Background image is baked into a plain body background (no blurred layer behind the text); Open button has no transparency.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 800 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const img = 'data:image/png;base64,' + fs.readFileSync('/tmp/thumb.png').toString('base64');
await p.goto('file:///home/claude/kuadro/dist/index.html'); await p.evaluate(i => { localStorage.clear(); localStorage.setItem('appearance', JSON.stringify({ theme: 'dark', image: i, blur: 12, dim: 55 })); }, img); await p.reload(); await wait(400);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Try the demo')).click()); await wait(2000);
ok('background baked into the body', await p.evaluate(() => document.body.classList.contains('img-flat') && getComputedStyle(document.body).backgroundImage.startsWith('url("data:image/jpeg')));
ok('no blurred layer behind the text', await p.evaluate(() => getComputedStyle(document.body, '::before').display === 'none' && getComputedStyle(document.querySelector('.sidebar')).backdropFilter === 'none'));
await p.hover('.grid tbody tr:nth-child(2) td.title'); await wait(100);
ok('Open button fully opaque', await p.evaluate(() => { const o = document.querySelector('.grid tbody tr:nth-child(2) .openbtn'); return getComputedStyle(o).opacity === '1' && getComputedStyle(o).visibility === 'visible'; }));
await p.screenshot({ path: '/tmp/shots/crisp.png', captureBeyondViewport: false });
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
