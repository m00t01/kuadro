// Row color (saved in a Color column), group the table by a column, freeze columns up to one.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 860 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const ctx = async (sel, ...path) => { await p.evaluate(s => { const e = typeof s === 'string' ? document.querySelector(s) : s; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: b.x + 30, clientY: b.y + 10 })); }, sel); await wait(200); for (let i = 0; i < path.length; i++) { const last = i === path.length - 1; await p.evaluate((t, last, sub) => { const it = [...document.querySelectorAll(sub ? '.ctx.sub .ctx-i' : '.ctx > .ctx-i')].find(x => x.textContent.startsWith(t)); if (!it) throw new Error('no ' + t + ': ' + [...document.querySelectorAll('.ctx-i')].map(x => x.textContent).join('/')); if (last) it.click(); else it.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); }, path[i], last, i > 0); await wait(150); } };
const sheet = () => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('demo-data-en')).sheets.find(x => x.title === 'Main channel'); return { h: s.rows[0], rows: s.rows.slice(1) }; });
await p.goto('file:///home/claude/kuadro/dist/index.html'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kuadro-clickopen', '0'); }); await p.reload(); await wait(400);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Try the demo')).click()); await wait(1800);
await p.evaluate(() => [...document.querySelectorAll('.sidebar .nav')].find(b => b.textContent.startsWith('Main channel')).click()); await wait(400);
// Row color on one row, then on a 2-row selection.
await ctx('.grid tbody tr:nth-child(1) td.title', 'Row color', 'Green'); await wait(1600);
let sh = await sheet(); ok('Color column created with value', sh.h.includes('Color') && sh.rows[0][sh.h.indexOf('Color')] === 'green');
ok('row tinted', await p.evaluate(() => document.querySelector('.grid tbody tr').classList.contains('rc-green')));
ok('Color column not shown as a table column', await p.evaluate(() => ![...document.querySelectorAll('.grid thead th')].some(th => th.textContent.trim() === 'Color')));
await p.evaluate(() => { const n = [...document.querySelectorAll('.grid tbody td.num')]; n[2].click(); n[3].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); });
await ctx('.grid tbody tr:nth-child(3) td.title', 'Row color', 'Red'); await wait(1200);
ok('color several rows at once', await p.evaluate(() => [...document.querySelectorAll('.grid tbody tr')].slice(2, 4).every(tr => tr.classList.contains('rc-red'))));
await ctx('.grid tbody tr:nth-child(3) td.title', 'Row color', 'No color'); await wait(1000);
ok('remove color', await p.evaluate(() => !document.querySelector('.grid tbody tr:nth-child(3)').classList.contains('rc-red')));
await p.screenshot({ path: '/tmp/shots/rowcolor.png', captureBeyondViewport: false });
// Group by Status via header right-click.
await ctx([...await p.$$('.grid thead th')].length ? '.grid thead th:nth-child(6)' : '', 'Group by this column'); await wait(400);
const heads = await p.evaluate(() => [...document.querySelectorAll('tr.fhead')].map(tr => tr.querySelector('.fh-name').textContent + ':' + tr.querySelector('.fh-n').textContent));
const col = await p.evaluate(() => document.querySelector('.grid thead th:nth-child(6)').textContent.trim().replace(/^[^A-Za-z]+/, ''));
ok('grouped with a header per value (' + col + ')', heads.length >= 3 && heads.every(h => /:\d+$/.test(h)));
await p.screenshot({ path: '/tmp/shots/groupby.png', captureBeyondViewport: false });
await p.evaluate(() => document.querySelector('tr.fhead td.fh').click()); await wait(200);
ok('collapse a group', await p.evaluate(() => document.querySelector('tr.fhead').classList.contains('closed')));
// Drag a row onto another group header changes its value.
const dropped = await p.evaluate(() => { const fh = [...document.querySelectorAll('tr.fhead')]; const target = fh[2]; const row = [...document.querySelectorAll('.grid tbody tr:not(.fhead)')][0]; const id = row.querySelector('td.title .cellbtn').textContent; const dt = new DataTransfer(); row.querySelector('td.num').dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return { title: id, to: target.querySelector('.fh-name').textContent }; });
await wait(1200); sh = await sheet();
ok('drop on a group header sets that value', sh.rows.find(r => r[sh.h.indexOf('Video title')] === dropped.title)[sh.h.indexOf(col)] === dropped.to);
await ctx('tr.fhead td.fh', 'Remove grouping'); await wait(300);
ok('remove grouping', await p.evaluate(() => !document.querySelector('tr.fhead')));
// Freeze up to the 3rd column.
await ctx('.grid thead th:nth-child(4)', 'Freeze columns up to here'); await wait(300);
await p.evaluate(() => document.querySelector('.body').scrollTo(400, 0)); await wait(200);
ok('frozen columns stay while scrolling sideways', await p.evaluate(() => { const th = document.querySelector('.grid thead th:nth-child(4)'), first = document.querySelector('.grid thead th:nth-child(2)'); return th.classList.contains('sticky') && Math.abs(first.getBoundingClientRect().left - document.querySelector('.body').getBoundingClientRect().left - document.querySelector('.grid thead th.num').getBoundingClientRect().width) < 3; }));
await p.screenshot({ path: '/tmp/shots/freeze.png', captureBeyondViewport: false });
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
