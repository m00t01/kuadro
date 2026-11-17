// Visual audit of every window: inline automation editor/templates, inline column editor, and the regular dialogs.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1100, height: 720 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const click = (sel, text) => p.evaluate((s, t) => { const e = [...document.querySelectorAll(s)].find(x => x.textContent.trim().startsWith(t)); if (!e) throw new Error('no ' + t); e.click(); }, sel, text);
const shot = n => p.screenshot({ path: `/tmp/shots/w-${n}.png`, captureBeyondViewport: false });
// Every visible window must be fully on screen and its body must be able to scroll if it overflows.
const check = async n => { const r = await p.evaluate(() => [...document.querySelectorAll('.modal')].map(m => { const b = m.getBoundingClientRect(), mb = m.querySelector('.modal-b'), cs = getComputedStyle(mb); return { in: b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1, centered: Math.abs(b.left - (innerWidth - b.right)) < 3, scrolls: mb.scrollHeight <= mb.clientHeight + 1 || /auto|scroll/.test(cs.overflowY) || m.classList.contains('settings'), top: m.parentElement.parentElement === document.body }; })); ok(n + ' fits, centered, scrollable', r.length > 0 && r.every(x => x.in && x.centered && x.scrolls && x.top)); await shot(n); };
await p.goto('file:///home/claude/kuadro/dist/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(400);
await p.evaluate(() => [...document.querySelectorAll('a,button')].find(x => /how|credential|cómo/i.test(x.textContent))?.click()); await wait(300);
if (await p.$('.modal')) { await check('home-help'); await p.keyboard.press('Escape'); await wait(200); }
await click('button', 'Open demo'); await wait(1800);
await click('.sidebar .nav', 'Settings'); await wait(300); await check('settings');
await click('.set nav button', 'Automations'); await wait(200);
await click('button', '✨ Add from template'); await wait(300);
ok('templates shown inside Settings (no extra window)', await p.evaluate(() => document.querySelectorAll('.modal').length === 1 && !!document.querySelector('.set-b .tpl-gal')));
await p.evaluate(() => document.querySelector('.set-b').scrollTo(0, 500)); await wait(150);
ok('back button and search stay visible while scrolling', await p.evaluate(() => { const h = document.querySelector('.ip-h').getBoundingClientRect(), q = document.querySelector('.tpl-q').getBoundingClientRect(), sb = document.querySelector('.set-b').getBoundingClientRect(); return h.top >= sb.top - 1 && q.top > h.top && q.top < sb.top + 120; }));
await shot('tpl-inline');
await p.evaluate(() => document.querySelector('.tpl-i .mini').click()); await wait(300);
ok('editor shown inside Settings', await p.evaluate(() => document.querySelectorAll('.modal').length === 1 && !!document.querySelector('.set-b .autoed')));
await p.evaluate(() => document.querySelector('.set-b').scrollTo(0, 0)); await shot('editor-inline');
// Typing keeps focus (no remount).
await p.click('.autoed input'); await p.keyboard.type('Hello'); ok('typing keeps focus', await p.evaluate(() => document.activeElement.value.endsWith('Hello')));
await click('.ip-h .mini', '← Back'); await wait(200);
ok('back returns to the templates', await p.evaluate(() => !!document.querySelector('.set-b .tpl-gal') && !document.querySelector('.autoed')));
await click('.ip-h .mini', '← Back'); await wait(200);
ok('back again returns to the list', await p.evaluate(() => !document.querySelector('.tpl-gal') && !!document.querySelector('.set-b .btn.primary')));
await click('.set nav button', 'Columns'); await wait(200);
await p.evaluate(() => document.querySelector('.set-b .lrow.click').click()); await wait(300);
ok('column editor inside Settings', await p.evaluate(() => document.querySelectorAll('.modal').length === 1 && !!document.querySelector('.set-b .col-inline')));
await shot('col-inline');
await click('.ip-h .mini', '← Back'); await wait(200);
await click('.set-b button', '+ Add column'); await wait(300); await check('add-column'); await p.keyboard.press('Escape'); await wait(200);
await p.keyboard.press('Escape'); await wait(300);
ok('settings closed', await p.evaluate(() => !document.querySelector('.modal')));
await click('.sidebar .nav', 'Main channel'); await wait(300);
await click('.addrow', 'Paste list of ideas'); await wait(300); await check('paste'); await p.keyboard.press('Escape'); await wait(200);
await click('.addrow', '+ New folder'); await wait(300); await check('new-folder'); await p.keyboard.press('Escape'); await wait(200);
await p.evaluate(() => document.querySelector('.grid thead th:nth-child(4)').click()); await wait(300); if (await p.$('.modal')) { await check('column-from-table'); await p.keyboard.press('Escape'); await wait(200); }
await click('.topbar .btn', '+ New'); await wait(400); if (await p.$('.modal')) { await check('new-item'); await p.keyboard.press('Escape'); await wait(200); }
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
