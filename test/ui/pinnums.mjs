// Pinned folder header (stays while its rows are visible, leaves after), hide row numbers, YouTube settings with key test.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1400, height: 700 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
await p.setRequestInterception(true);
p.on('request', r => { const u = r.url(); if (u.startsWith('https://www.googleapis.com/youtube/v3/videos')) { const good = u.includes('key=GOODKEY'); return r.respond({ status: good ? 200 : 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(good ? { items: [{ statistics: { viewCount: '1700000000' } }] } : { error: { message: 'API key not valid. Please pass a valid API key.' } }) }); } r.continue(); });
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const menu = async (sel, ...path) => { await p.evaluate(s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: b.x + 30, clientY: b.y + 10 })); }, sel); await wait(200); for (let i = 0; i < path.length; i++) { const last = i === path.length - 1; await p.evaluate((t, last, sub) => { const it = [...document.querySelectorAll(sub ? '.ctx.sub .ctx-i' : '.ctx > .ctx-i')].find(x => x.textContent.startsWith(t)); if (!it) throw new Error('no ' + t + ': ' + [...document.querySelectorAll('.ctx-i')].map(x => x.textContent).join('/')); if (last) it.click(); else it.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); }, path[i], last, i > 0); await wait(150); } };
await p.goto('file:///home/claude/kuadro/dist/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(400);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Open demo')).click()); await wait(1800);
await p.evaluate(() => [...document.querySelectorAll('.sidebar .nav')].find(b => b.textContent.startsWith('Main channel')).click()); await wait(400);
// Folder with rows 1..12 (select by checkbox range).
await p.evaluate(() => { const nums = [...document.querySelectorAll('.grid tbody td.num')]; nums[1].click(); nums[12].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); }); await wait(150);
await menu('.grid tbody tr:nth-child(3) td.title', 'Move to folder', 'New folder…'); await p.keyboard.type('Uploaded'); await p.keyboard.press('Enter'); await wait(2500);
ok('folder with 12 rows', await p.evaluate(() => document.querySelector('.fh-n').textContent === '12'));
await menu('tr.fhead td.fh', 'Pin name while scrolling'); await wait(200);
ok('pinned marker', await p.evaluate(() => document.querySelector('tr.fhead').classList.contains('pin')));
const pos = () => p.evaluate(() => { const th = document.querySelector('.grid thead th').getBoundingClientRect().bottom, h = document.querySelector('tr.fhead td.fh').getBoundingClientRect().top; return { th: Math.round(th), h: Math.round(h) }; });
await p.evaluate(() => document.querySelector('.body').scrollTo(0, 250)); await wait(200); let q = await pos();
ok('stays visible while scrolling through its rows', Math.abs(q.h - q.th) <= 2);
await p.screenshot({ path: '/tmp/shots/pinned.png', captureBeyondViewport: false });
await p.evaluate(() => document.querySelector('.body').scrollTo(0, 1100)); await wait(200); q = await pos();
ok('leaves once you scroll past the folder', q.h < q.th - 20);
await p.evaluate(() => document.querySelector('.body').scrollTo(0, 0)); await wait(100);
// Hide row numbers via right-click on the header corner.
await menu('.grid thead th.num', 'Hide row numbers'); await wait(200);
ok('row numbers hidden, column narrow, bracket kept', await p.evaluate(() => { const n = document.querySelector('.grid tbody td.num .n'); return n && getComputedStyle(n).display === 'none' && document.querySelector('.grid thead th.num').getBoundingClientRect().width < 30 && document.querySelectorAll('td.num.inf').length === 12; }));
await p.screenshot({ path: '/tmp/shots/nonum.png', captureBeyondViewport: false });
await p.click('.topbar .btn[data-k=columns]'); await wait(200);
await p.evaluate(() => [...document.querySelectorAll('.pop label')].find(l => l.textContent.includes('Show row numbers')).querySelector('input').click()); await wait(200);
ok('show again from Columns', await p.evaluate(() => getComputedStyle(document.querySelector('.grid tbody td.num .n')).display !== 'none'));
await p.keyboard.press('Escape'); await wait(150);
// YouTube settings.
await p.evaluate(() => [...document.querySelectorAll('.sidebar .nav')].find(b => b.textContent.startsWith('Settings')).click()); await wait(300);
await p.evaluate(() => [...document.querySelectorAll('.set nav button')].find(b => b.textContent === 'YouTube').click()); await wait(200);
ok('YouTube section with steps', await p.evaluate(() => document.body.innerText.includes('YouTube Data API v3') && !!document.querySelector('input[placeholder="AIza…"]')));
await p.type('input[placeholder="AIza…"]', 'BADKEY'); await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Test key').click()); await wait(600);
ok('bad key explained', await p.evaluate(() => document.body.innerText.includes("Google says the key isn't valid")));
await p.evaluate(() => { const i = document.querySelector('input[placeholder="AIza…"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); });
await p.type('input[placeholder="AIza…"]', 'GOODKEY'); await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Test key').click()); await wait(800);
ok('good key works and is saved', await p.evaluate(() => document.body.innerText.includes('It works! Test video: 1,700,000,000 views.')));
await (await p.$('.set-b')).screenshot({ path: '/tmp/shots/yt-settings.png' });
await wait(600); ok('key saved in project config', await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('demo-data-en')).sheets.find(s => s.title === '_app_config').rows).includes('GOODKEY')));
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
