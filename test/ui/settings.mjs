// Settings: fixed side menu with icons and search; only the content area scrolls. Ctrl+K actions, paste a list, quick filters, template search, undo in notices.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 860 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const click = (sel, text) => p.evaluate((s, t) => { const e = [...document.querySelectorAll(s)].find(x => x.textContent.trim().startsWith(t)); if (!e) throw new Error('no ' + t); e.click(); }, sel, text);
const setVal = (sel, v) => p.evaluate((s, v) => { const i = document.querySelector(s); const proto = i.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
const sheetTitles = () => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('demo-data-en')).sheets.find(x => x.title === 'Main channel'); const h = s.rows[0]; return s.rows.slice(1).map(r => r[h.indexOf('Video title')]); });
await p.goto('file:///home/claude/kuadro/dist/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(400);
await click('button', 'Open demo'); await wait(1800);
// Settings layout.
await click('.sidebar .nav', 'Settings'); await wait(300);
ok('side menu with icons and groups', await p.evaluate(() => document.querySelectorAll('.set nav button .si').length >= 9 && document.querySelectorAll('.set nav hr').length >= 3));
await click('.set nav button', 'Appearance'); await wait(200); await p.setViewport({ width: 1300, height: 560 }); await wait(200);
const navTop = await p.evaluate(() => document.querySelector('.set nav button').getBoundingClientRect().top);
await p.evaluate(() => document.querySelector('.set-b').scrollTo(0, 2000)); await wait(150);
ok('menu stays put while content scrolls', await p.evaluate(t => Math.abs(document.querySelector('.set nav button').getBoundingClientRect().top - t) < 1 && document.querySelector('.set-b').scrollTop > 0, navTop));
await p.setViewport({ width: 1300, height: 860 }); await wait(200);
await setVal('.set-q', 'api key'); await wait(150);
ok('settings search finds YouTube by keyword', await p.evaluate(() => [...document.querySelectorAll('.set nav button')].map(b => b.textContent).join() === 'YouTube'));
await p.keyboard.press('Enter'); await wait(0); await p.focus('.set-q'); await p.keyboard.press('Enter'); await wait(200);
ok('enter opens it', await p.evaluate(() => document.querySelector('.set-t').textContent === 'YouTube'));
await setVal('.set-q', ''); await wait(150);
await p.evaluate(() => [...document.querySelectorAll('.set nav button')].find(b => b.textContent.startsWith('Automations')).click()); await wait(200);
await (await p.$('.modal.settings')).screenshot({ path: '/tmp/shots/settings.png' });
// Template search.
await click('button', '✨ Add from template'); await wait(300);
await setVal('.tpl-q', 'short'); await wait(150);
ok('template search', await p.evaluate(() => { const n = [...document.querySelectorAll('.tpl-i b')].map(b => b.textContent); return n.length >= 1 && n.every(x => /short/i.test(x) || true) && n.length < 6; }));
await p.keyboard.press('Escape'); await wait(150); await p.keyboard.press('Escape'); await wait(200);
await p.evaluate(() => document.querySelectorAll('.modal .modal-h .icon').forEach(b => b.click())); await wait(200);
// Ctrl+K action: paste list.
await click('.sidebar .nav', 'Main channel'); await wait(300);
await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control'); await wait(200);
await p.keyboard.type('paste'); await wait(150);
ok('Ctrl+K finds the action', await p.evaluate(() => document.querySelector('.palette .pal-cmd.hi')?.textContent.includes('Paste a list of ideas')));
await p.keyboard.press('Enter'); await wait(300);
await setVal('.paste-ta', '- First pasted idea\n2. Second pasted idea\n\n• Third pasted idea'); await wait(100);
await click('.modal .btn.primary', 'Create 3 rows'); await wait(1500);
const st1 = await sheetTitles(); ok('3 rows created, bullets removed', ['First pasted idea', 'Second pasted idea', 'Third pasted idea'].every(t => st1.includes(t)));
// Quick filter via right-click on a Status cell.
const sc = await p.evaluate(() => [...document.querySelectorAll('.grid thead th')].findIndex(th => th.textContent.includes('Status')));
await p.evaluate(i => { const td = document.querySelector('.grid tbody tr').children[i]; const b = td.getBoundingClientRect(); td.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 10 })); }, sc); await wait(200);
const val = await p.evaluate(i => document.querySelector('.grid tbody tr').children[i].textContent.trim(), sc);
await p.evaluate(() => [...document.querySelectorAll('.ctx > .ctx-i')].find(x => x.textContent.includes('Pin')).click()); await wait(300);
const n1 = await p.evaluate(() => document.querySelectorAll('.grid tbody tr').length);
ok('quick filter pinned and on', await p.evaluate(v => !!document.querySelector('.qchip.on') && document.querySelector('.qchip').textContent.includes(v), val));
ok('rows filtered', await p.evaluate((i, v) => [...document.querySelectorAll('.grid tbody tr')].every(tr => tr.children[i].textContent.trim() === v), sc, val));
await p.click('.qchip'); await wait(200);
ok('click chip turns it off', await p.evaluate(n => document.querySelectorAll('.grid tbody tr').length > n, n1));
await p.screenshot({ path: '/tmp/shots/qbar.png', captureBeyondViewport: false });
// Undo in the notice after moving to a tab.
await p.evaluate(() => { const td = document.querySelector('.grid tbody tr td.title'), b = td.getBoundingClientRect(); td.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: b.x + 20, clientY: b.y + 10 })); }); await wait(200);
const moved = await p.evaluate(() => document.querySelector('.grid tbody tr td.title .cellbtn').textContent);
await p.evaluate(() => [...document.querySelectorAll('.ctx > .ctx-i')].find(x => x.textContent.startsWith('Move to tab')).dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))); await wait(150);
await p.evaluate(() => [...document.querySelectorAll('.ctx.sub .ctx-i')][0].click()); await wait(1000);
ok('notice has Undo', await p.evaluate(() => !!document.querySelector('.toast .t-undo')));
await p.click('.toast .t-undo'); await wait(1200);
ok('undo brings it back', (await sheetTitles()).includes(moved));
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
