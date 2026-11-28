// Performance with ~1000 rows in one tab: initial render, view switch, typing in search, opening a page.
import puppeteer from 'puppeteer-core';
const N = +(process.env.N || 1000);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const wait = ms => new Promise(r => setTimeout(r, ms));
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 820 }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file:///home/claude/kuadro/dist/index.html');
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kuadro-lang', 'en'); localStorage.setItem('kuadro-clickopen', '0'); }); await p.reload(); await wait(400);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Try the demo')).click()); await wait(2000);
await p.evaluate(N => { const d = JSON.parse(localStorage.getItem('demo-data-en')); const s = d.sheets[0]; const head = s.rows[0], body = s.rows.slice(1); const out = [head]; for (let i = 0; out.length <= N; i++) { const r = [...body[i % body.length]]; r[0] = String(out.length); out.push(r); } s.rows = out; localStorage.setItem('demo-data-en', JSON.stringify(d)); }, N);
const t0 = Date.now(); await p.reload(); await p.waitForFunction(n => document.querySelectorAll(".grid tbody tr").length >= n, { timeout: 60000 }, 100); const tLoad = Date.now() - t0;
const rows = await p.evaluate(() => document.querySelectorAll('.grid tbody tr').length);
const time = async (label, fn) => { const s = await p.evaluate(() => performance.now()); await fn(); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); const e = await p.evaluate(() => performance.now()); console.log(label.padEnd(28), Math.round(e - s), 'ms'); };
console.log('rows rendered', rows, '| load+render', tLoad, 'ms');
await time('switch to Kanban', () => p.evaluate(() => [...document.querySelectorAll('.seg button')].find(b => b.textContent === 'Kanban').click()));
await time('switch to Table', () => p.evaluate(() => [...document.querySelectorAll('.seg button')].find(b => b.textContent === 'Table').click()));
await time('type in search (1 key)', async () => { await p.focus('.search input, input[placeholder^="Search"]'); await p.keyboard.type('e'); await wait(250); });
await p.evaluate(() => { const i = document.querySelector('input[placeholder^="Search"]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(400);
await time('edit a cell (setCell)', () => p.evaluate(() => { const td = document.querySelectorAll('.grid tbody tr')[3].querySelectorAll('td')[3]; td.click(); }));
await time('open page', () => p.evaluate(() => document.querySelector('.grid tbody tr .openbtn').click()));
await time('scroll 5000px', () => p.evaluate(() => { const b = document.querySelector('.body'); b.scrollTop = 5000; }));
for (let k = 0; k < 12; k++) { await p.evaluate(() => { const b = document.querySelector('.body'); b.scrollTop = b.scrollHeight; }); await wait(250); }
console.log('rows after scrolling to the end', await p.evaluate(() => document.querySelectorAll('.grid tbody tr').length), '(expect', N + 37, ')');
console.log('errors', errs); await b.close();
