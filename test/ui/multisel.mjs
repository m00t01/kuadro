// Table: drag to select cells, right-click acts on the whole selection, row height, hide rows.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 900 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const cellBox = (r, c) => p.evaluate((r, c) => { const b = document.querySelector(`td[data-rc="${r}:${c}"]`).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, r, c);
const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('demo-data-en')));
await p.goto('file:///home/claude/kuadro/dist/index.html'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kuadro-clickopen', '0'); }); await p.reload(); await wait(400);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Try the demo')).click()); await wait(1800);
await p.evaluate(() => [...document.querySelectorAll('.sidebar .nav')].find(b => b.textContent.startsWith('Main channel')).click()); await wait(400);
const statusCol = await p.evaluate(() => [...document.querySelectorAll('.grid thead th')].findIndex(th => th.textContent.includes('Status')) - 1);
// Drag from (0,status) to (3,status).
const a = await cellBox(0, statusCol), z = await cellBox(3, statusCol);
await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, (a.y + z.y) / 2, { steps: 4 }); await p.mouse.move(z.x, z.y, { steps: 4 }); await p.mouse.up(); await wait(200);
ok('drag selects a range of cells', await p.evaluate(() => document.querySelectorAll('.grid td.inrg').length === 4));
ok('no text selected while dragging', await p.evaluate(() => String(getSelection()).trim() === ''));
await p.mouse.click(z.x, z.y, { button: 'right' }); await wait(250);
ok('right-click shows selection menu', await p.evaluate(() => /4 cells · 4 rows/.test(document.querySelector('.ctx .ctx-t').textContent)));
await p.screenshot({ path: '/tmp/shots/multi-menu.png', captureBeyondViewport: false });
await p.evaluate(() => { const it = [...document.querySelectorAll('.ctx-i')].find(i => i.textContent.startsWith('Change “Status” in all')); it.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); }); await wait(150);
await p.evaluate(() => [...document.querySelectorAll('.ctx.sub .ctx-i')].find(i => i.textContent.startsWith('Recording')).click()); await wait(700);
const vals = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('demo-data-en')); const s = d.sheets.find(x => x.title === 'Main channel'); const h = s.rows[0]; return s.rows.slice(1, 5).map(r => r[h.indexOf('Status')]); });
ok('bulk change applied to the 4 rows', vals.every(v => v === 'Recording'));
// Hide 2 rows via the selection menu.
const t0 = await p.evaluate(() => document.querySelectorAll('.grid tbody tr').length);
const a2 = await cellBox(0, 0), z2 = await cellBox(1, 0);
await p.mouse.move(a2.x + 60, a2.y); await p.mouse.down(); await p.mouse.move(z2.x + 60, z2.y, { steps: 5 }); await p.mouse.up(); await wait(150);
await p.mouse.click(z2.x + 60, z2.y, { button: 'right' }); await wait(200);
await p.evaluate(() => [...document.querySelectorAll('.ctx-i')].find(i => i.textContent.startsWith('Hide 2 rows')).click()); await wait(300);
ok('rows hidden', await p.evaluate(() => document.querySelectorAll('.grid tbody tr').length) === t0 - 2);
ok('hidden bar shown', await p.evaluate(() => (document.querySelector('.hidbar') || {}).textContent?.includes('2 rows hidden')));
await p.evaluate(() => [...document.querySelectorAll('.hidbar .mini')].find(b => b.textContent === 'Show all again').click()); await wait(200);
ok('show all again', await p.evaluate(() => document.querySelectorAll('.grid tbody tr').length) === t0);
// Row height.
const h1 = await p.evaluate(() => document.querySelector('.grid tbody').getBoundingClientRect().height);
await p.click('.topbar .btn[data-k=columns]'); await wait(200);
await p.evaluate(() => [...document.querySelectorAll('.pop button')].find(b => b.textContent === 'Single line').click()); await wait(200);
const h2 = await p.evaluate(() => document.querySelector('.grid tbody').getBoundingClientRect().height);
ok('single line makes rows shorter', h2 < h1 && await p.evaluate(() => [...document.querySelectorAll('.grid tbody tr')].every(tr => tr.getBoundingClientRect().height <= 36)));
await p.keyboard.press('Escape'); await wait(150);
await p.screenshot({ path: '/tmp/shots/compact.png', captureBeyondViewport: false });
// Single-row right click still shows the row menu with Hide row and no "of column".
const c5 = await cellBox(5, 0); await p.mouse.click(c5.x + 60, c5.y); await wait(100); await p.mouse.click(c5.x + 60, c5.y, { button: 'right' }); await wait(200);
ok('row menu has Hide row and table wording', await p.evaluate(() => { const t = document.querySelector('.ctx').textContent; return t.includes('Hide row') && !t.includes('of column'); }));
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
