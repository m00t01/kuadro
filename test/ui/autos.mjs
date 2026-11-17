// Automations: template gallery built from the project's columns, editor with the new options, checklist progress in the table.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 900 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const click = (sel, text) => p.evaluate((s, t) => { const e = [...document.querySelectorAll(s)].find(x => x.textContent.trim().startsWith(t)); if (!e) throw new Error('no ' + t); e.click(); }, sel, text);
await p.goto('file:///home/claude/kuadro/dist/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(400);
await click('button', 'Open demo'); await wait(1800);
await click('.sidebar .nav', 'Settings'); await wait(300); await click('.set nav button', 'Automations'); await wait(200);
await click('button', '✨ Add from template'); await wait(300);
const names = await p.evaluate(() => [...document.querySelectorAll('.tpl-i b')].map(b => b.textContent));
ok('template gallery has creator templates (' + names.length + ')', names.length >= 8);
await p.screenshot({ path: '/tmp/shots/tpl-gallery.png', captureBeyondViewport: false });
await p.evaluate(() => [...document.querySelectorAll('.tpl-i')].find(x => x.textContent.includes('Late video')).querySelector('button').click()); await wait(300);
ok('template opens in the editor, explained', await p.evaluate(() => document.querySelector('.autoed .info').textContent.includes('1 days after') || document.querySelector('.autoed .info').textContent.includes('days after')));
await p.screenshot({ path: '/tmp/shots/auto-editor.png', captureBeyondViewport: false });
await click('.autoed .btn.primary', 'Save'); await wait(400);
ok('saved', await p.evaluate(() => [...document.querySelectorAll('.auto-i b')].some(b => b.textContent.includes('Late video'))));
// Add a checklist from a row's right-click menu and see progress in the table.
await p.keyboard.press('Escape'); await wait(200); await p.evaluate(() => document.querySelector('.modal .x, .modal-x, .modal button.icon')?.click()); await wait(200);
await click('.sidebar .nav', 'Main channel'); await wait(400);
await p.evaluate(() => { const e = document.querySelector('.grid tbody tr td.title'), b = e.getBoundingClientRect(); e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: b.x + 30, clientY: b.y + 10 })); }); await wait(200);
await p.evaluate(() => [...document.querySelectorAll('.ctx > .ctx-i')].find(x => x.textContent.startsWith('Add checklist')).dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))); await wait(150);
await p.evaluate(() => [...document.querySelectorAll('.ctx.sub .ctx-i')].find(x => x.textContent.startsWith('Editing')).click()); await wait(800);
ok('progress shown in the table', await p.evaluate(() => (document.querySelector('.grid tbody tr td.title .prog') || {}).textContent === '0/5'));
await p.screenshot({ path: '/tmp/shots/chk-table.png', captureBeyondViewport: false });
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
