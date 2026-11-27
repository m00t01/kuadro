// Drag rows by their number to reorder them in the table (also into and out of folders).
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 900 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const titles = () => p.evaluate(() => [...document.querySelectorAll('.grid tbody tr')].map(tr => tr.classList.contains('fhead') ? '[' + tr.querySelector('.fh-name').textContent + ']' : (tr.querySelector('td.title .cellbtn') || {}).textContent));
const sheetTitles = () => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('demo-data-en')).sheets.find(x => x.title === 'Main channel'); const h = s.rows[0]; return s.rows.slice(1).map(r => r[h.indexOf('Video title')]); });
// Drag the row at display index `from` and drop it before/after the row at display index `to`.
const drag = (from, to, after) => p.evaluate((from, to, after) => { const trs = [...document.querySelectorAll('.grid tbody tr')]; const src = trs[from].querySelector('td.num'), dst = trs[to]; const dt = new DataTransfer(); src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); const r = dst.getBoundingClientRect(), y = after ? r.bottom - 3 : r.top + 3; dst.querySelector('td.title').dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y })); return new Promise(res => setTimeout(() => { const ind = dst.className; dst.querySelector('td.title').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y })); src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); res(ind); }, 60)); }, from, to, after);
await p.goto('file:///home/claude/kuadro/dist/index.html'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kuadro-clickopen', '0'); }); await p.reload(); await wait(400);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Open demo')).click()); await wait(1800);
await p.evaluate(() => [...document.querySelectorAll('.sidebar .nav')].find(b => b.textContent.startsWith('Main channel')).click()); await wait(400);
const t0 = await titles();
const ind = await drag(11, 2, false); await wait(1200);
ok('drop indicator shown', /drop-before/.test(ind));
let t = await titles(); ok('row 12 moved above row 3', t[2] === t0[11] && t[3] === t0[2]);
let sh = await sheetTitles(); ok('order saved in the Sheet', sh[2] === t0[11] && sh[3] === t0[2]);
await drag(0, 5, true); await wait(1200); t = await titles(); ok('drag down, drop after', t[5] === t0[0]);
// Folder: create with rows 2-3, then drag a row into the middle of it.
await p.evaluate(() => { const n = [...document.querySelectorAll('.grid tbody td.num')]; n[2].click(); n[3].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); });
await p.evaluate(() => { const e = document.querySelector('.grid tbody tr:nth-child(3) td.title'), b = e.getBoundingClientRect(); e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: b.x + 30, clientY: b.y + 10 })); }); await wait(200);
await p.evaluate(() => [...document.querySelectorAll('.ctx > .ctx-i')].find(x => x.textContent.startsWith('Move to folder')).dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))); await wait(150);
await p.evaluate(() => [...document.querySelectorAll('.ctx.sub .ctx-i')].find(x => x.textContent.startsWith('New folder')).click()); await wait(200);
await p.keyboard.type('Box'); await p.keyboard.press('Enter'); await wait(2200);
t = await titles(); const fi = t.indexOf('[Box]'); const far = t[12];
await drag(12, fi + 1, true); await wait(1500); t = await titles();
ok('dragged row lands inside the folder at that spot', t[fi + 2] === far && await p.evaluate(i => [...document.querySelectorAll('.grid tbody tr')][i].querySelector('td.num').classList.contains('inf'), fi + 2));
ok('folder count updated', await p.evaluate(() => document.querySelector('.fh-n').textContent === '3'));
const fsh = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('demo-data-en')).sheets.find(x => x.title === 'Main channel'); return s.rowGroups; });
ok('Sheets group still covers the folder', JSON.stringify(fsh) === JSON.stringify([{ start: fi + 1, end: fi + 4, depth: 1 }]));
// Drag it back out below the folder.
await drag(fi + 2, fi + 6, true); await wait(1500); t = await titles();
ok('dragged out of the folder', await p.evaluate(() => document.querySelector('.fh-n').textContent === '2') && t[fi + 6] === far && !(await p.evaluate(i => [...document.querySelectorAll('.grid tbody tr')][i].querySelector('td.num').classList.contains('inf'), fi + 6)));
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
