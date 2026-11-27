// Collapsible row folders: create from a selection, add a far row (goes to the end), bracket, collapse, drag onto folder, rename, delete.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 900 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const cellBox = (r, c) => p.evaluate((r, c) => { const b = document.querySelector(`td[data-rc="${r}:${c}"]`).getBoundingClientRect(); return { x: b.x + 80, y: b.y + b.height / 2 }; }, r, c);
const titles = () => p.evaluate(() => [...document.querySelectorAll('.grid tbody tr')].map(tr => tr.classList.contains('fhead') ? '[' + tr.querySelector('.fh-name').textContent + ']' : (tr.querySelector('td.title .cellbtn') || {}).textContent));
const sheet = () => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('demo-data-en')).sheets.find(x => x.title === 'Main channel'); return { h: s.rows[0], rows: s.rows, groups: s.rowGroups || [] }; });
const rightClickItem = async (pt, ...path) => { await p.mouse.click(pt.x, pt.y, { button: 'right' }); await wait(200); for (let i = 0; i < path.length; i++) { const last = i === path.length - 1; await p.evaluate((t, last, sub) => { const it = [...document.querySelectorAll(sub ? '.ctx.sub .ctx-i' : '.ctx > .ctx-i')].find(x => x.textContent.startsWith(t)); if (!it) throw new Error('no item ' + t + ' in: ' + [...document.querySelectorAll('.ctx .ctx-i, .ctx .ctx-t')].map(x => x.textContent).join(' / ')); if (last) it.click(); else it.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); }, path[i], last, i > 0); await wait(150); } };
await p.goto('file:///home/claude/kuadro/dist/index.html'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kuadro-clickopen', '0'); }); await p.reload(); await wait(400);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Open demo')).click()); await wait(1800);
await p.evaluate(() => [...document.querySelectorAll('.sidebar .nav')].find(b => b.textContent.startsWith('Main channel')).click()); await wait(400);
const t0 = await titles();
// Select rows 2-3 by dragging, then right-click → Move to folder → New folder…
const a = await cellBox(2, 0), z = await cellBox(3, 0); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(z.x, z.y, { steps: 5 }); await p.mouse.up(); await wait(150);
await rightClickItem(z, 'Move to folder', 'New folder…'); await wait(200);
ok('new folder dialog', await p.evaluate(() => document.body.innerText.includes('The 2 rows will be moved into the folder')));
await p.keyboard.type('On hold'); await p.keyboard.press('Enter'); await wait(1500);
let t = await titles();
ok('folder header appears where its rows were', t[2] === '[On hold]' && t[3] === t0[2] && t[4] === t0[3]);
ok('bracket on folder rows', await p.evaluate(() => document.querySelectorAll('.grid td.num.inf').length === 2 && document.querySelectorAll('.grid td.num.inf-last').length === 1));
// Far row (index 20 in original) → goes to the end of the folder.
const farTitle = t0[20]; const fi = t.indexOf(farTitle); const fpt = await p.evaluate(i => { const tr = [...document.querySelectorAll('.grid tbody tr')][i]; tr.scrollIntoView({ block: 'center' }); const b = tr.querySelector('td.title').getBoundingClientRect(); return { x: b.x + 80, y: b.y + b.height / 2 }; }, fi);
await p.mouse.click(fpt.x, fpt.y); await wait(100); await rightClickItem(fpt, 'Move to folder', '📁 On hold'); await wait(1500);
await p.evaluate(() => document.querySelector('.body').scrollTo(0, 0)); t = await titles(); ok('far row moved to the end of the folder', t[2] === '[On hold]' && t[5] === farTitle && t[6] === t0[4]);
const sh = await sheet(); const ti = sh.h.indexOf('Video title');
ok('rows physically together in the Sheet', sh.rows[3][ti] === t0[2] && sh.rows[4][ti] === t0[3] && sh.rows[5][ti] === farTitle);
ok('Folder column written', sh.h.includes('Folder') && sh.rows[5][sh.h.indexOf('Folder')] === 'On hold');
ok('Google Sheets row group created', JSON.stringify(sh.groups) === JSON.stringify([{ start: 3, end: 6, depth: 1 }]));
ok('Folder column not shown as a table column', await p.evaluate(() => ![...document.querySelectorAll('.grid thead th')].some(th => th.textContent.trim().endsWith('Folder'))));
await p.screenshot({ path: '/tmp/shots/folder-open.png', captureBeyondViewport: false });
// Collapse.
await p.evaluate(() => document.querySelector('tr.fhead td.fh').click()); await wait(250);
t = await titles(); ok('collapse hides its rows', t[2] === '[On hold]' && t[3] === t0[4]);
await p.screenshot({ path: '/tmp/shots/folder-closed.png', captureBeyondViewport: false });
await p.evaluate(() => document.querySelector('tr.fhead td.fh').click()); await wait(250);
// Drag row 10 onto the folder header.
const drag = await p.evaluate(() => { const rows = [...document.querySelectorAll('.grid tbody tr')]; const src = rows[10].querySelector('td.num'); const title = rows[10].querySelector('td.title .cellbtn').textContent; const dst = document.querySelector('tr.fhead'); const dt = new DataTransfer(); src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return title; });
await wait(1500); t = await titles(); ok('drag onto folder adds at the end', t[6] === drag);
// Rename by double-click.
await p.evaluate(() => document.querySelector('.fh-name').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))); await wait(150);
await p.keyboard.down('Control'); await p.keyboard.press('a'); await p.keyboard.up('Control'); await p.keyboard.type('Paused ideas'); await p.keyboard.press('Enter'); await wait(1200);
const sh2 = await sheet(); ok('rename updates header and Sheet cells', (await titles())[2] === '[Paused ideas]' && sh2.rows.filter(r => r[sh2.h.indexOf('Folder')] === 'Paused ideas').length === 4);
// Remove one row from folder → right below the folder.
const r3 = await p.evaluate(() => { const tr = [...document.querySelectorAll('.grid tbody tr')][3]; const b = tr.querySelector('td.title').getBoundingClientRect(); return { x: b.x + 80, y: b.y + b.height / 2 }; });
const outTitle = (await titles())[3]; await p.mouse.click(r3.x, r3.y); await wait(100); await rightClickItem(r3, 'Move to folder', 'Remove from folder'); await wait(1500);
t = await titles(); ok('removed row goes just below the folder', t.indexOf(outTitle) === 6 && !(await p.evaluate(() => [...document.querySelectorAll('.grid tbody tr')][6].querySelector('td.num').classList.contains('inf'))));
// Delete folder keeps rows.
const n0 = (await titles()).filter(x => !x.startsWith('[')).length;
const hp = await p.evaluate(() => { const b = document.querySelector('tr.fhead td.fh').getBoundingClientRect(); return { x: b.x + 120, y: b.y + b.height / 2 }; });
await rightClickItem(hp, 'Delete folder'); await wait(1500);
t = await titles(); ok('delete folder keeps its rows', !t.some(x => x.startsWith('[')) && t.length === n0);
ok('Google Sheets group removed', (await sheet()).groups.length === 0);
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
