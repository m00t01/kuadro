// One click on a title opens its page (setting, on by default); double-click renames in place; Open button centered;
// in the page: Enter in the title jumps to the notes, Esc leaves a field, Esc again closes the page.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 860 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const titlePt = i => p.evaluate(i => { const td = document.querySelectorAll('.grid tbody tr')[i].querySelector('td.title'), b = td.getBoundingClientRect(); return { x: b.x + 60, y: b.y + b.height / 2 }; }, i);
const sheetTitles = () => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('demo-data-en')).sheets.find(x => x.title === 'Main channel'); const h = s.rows[0]; return s.rows.slice(1).map(r => r[h.indexOf('Video title')]); });
await p.goto('file:///home/claude/kuadro/dist/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(400);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Try the demo')).click()); await wait(1800);
await p.evaluate(() => [...document.querySelectorAll('.sidebar .nav')].find(b => b.textContent.startsWith('Main channel')).click()); await wait(400);
// Open button vertically centered.
await p.hover('.grid tbody tr:nth-child(3) td.title'); await wait(100);
ok('Open button vertically centered', await p.evaluate(() => { const td = document.querySelector('.grid tbody tr:nth-child(3) td.title').getBoundingClientRect(), o = document.querySelector('.grid tbody tr:nth-child(3) .openbtn').getBoundingClientRect(); return Math.abs((o.top + o.bottom) / 2 - (td.top + td.bottom) / 2) <= 1.5; }));
// Single click opens.
let pt = await titlePt(1); await p.mouse.click(pt.x, pt.y); await wait(500);
ok('one click on the title opens the page', await p.evaluate(() => !!document.querySelector('.page .ptitle')));
ok('and does not start editing the cell', await p.evaluate(() => !document.querySelector('.grid textarea.edit')));
// Clicking a title that is already selected also only opens (no editing).
await p.keyboard.press('Escape'); await wait(300); await p.mouse.click(pt.x, pt.y); await wait(500);
ok('clicking an already selected title only opens', await p.evaluate(() => !!document.querySelector('.page') && !document.querySelector('.grid textarea.edit')));
// Enter in the title goes to the notes editor.
await p.click('.page .ptitle'); await p.keyboard.press('End'); await p.keyboard.press('Enter'); await wait(150);
ok('Enter in the title jumps to Script & notes', await p.evaluate(() => document.activeElement.classList.contains('ProseMirror')));
await p.keyboard.type('First line of the script'); await wait(300);
ok('typing goes into the notes', await p.evaluate(() => document.querySelector('.page .ProseMirror').textContent.includes('First line of the script')));
await p.keyboard.press('Escape'); await wait(150);
ok('Esc leaves the editor, page stays open', await p.evaluate(() => !document.activeElement.classList.contains('ProseMirror') && !!document.querySelector('.page')));
await p.keyboard.press('Escape'); await wait(300);
ok('Esc again closes the page', await p.evaluate(() => !document.querySelector('.page')));
// Double-click renames in place (no page).
const before = await sheetTitles(); pt = await titlePt(4);
await p.mouse.click(pt.x, pt.y, { count: 2 }); await wait(400);
ok('double-click edits in place without opening', await p.evaluate(() => !document.querySelector('.page') && !!document.querySelector('.grid td.title textarea.edit')));
await p.keyboard.down('Control'); await p.keyboard.press('a'); await p.keyboard.up('Control'); await p.keyboard.type('Renamed by double click'); await p.keyboard.press('Enter'); await wait(1200);
ok('renamed', (await sheetTitles()).includes('Renamed by double click') && !(await p.evaluate(() => !!document.querySelector('.page'))));
// Esc inside a table cell editor leaves it.
pt = await titlePt(6); await p.mouse.click(pt.x, pt.y, { count: 2 }); await wait(300); await p.keyboard.press('Escape'); await wait(200);
ok('Esc leaves a cell', await p.evaluate(() => !document.querySelector('.grid textarea.edit') && !document.querySelector('.page')));
// Setting off: click only selects.
await p.evaluate(() => [...document.querySelectorAll('.sidebar .nav')].find(b => b.textContent.startsWith('Settings')).click()); await wait(300);
await p.evaluate(() => [...document.querySelectorAll('.set nav button')].find(b => b.textContent.startsWith('Appearance')).click()); await wait(200);
await p.evaluate(() => [...document.querySelectorAll('.set-b label')].find(l => l.textContent.includes('One click on the title opens')).querySelector('input').click()); await wait(100);
await p.keyboard.press('Escape'); await wait(300);
pt = await titlePt(2); await p.mouse.click(pt.x, pt.y); await wait(500);
ok('with the setting off, a click only selects', await p.evaluate(() => !document.querySelector('.page') && !!document.querySelector('.grid td.title.act')));
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
