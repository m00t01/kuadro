// Date alerts (late in red, soon in orange, in the inbox) and the weekly goal in the Dashboard.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 900 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const click = (sel, text) => p.evaluate((s, t) => { const e = [...document.querySelectorAll(s)].find(x => x.textContent.trim().startsWith(t)); if (!e) throw new Error('no ' + t); e.click(); }, sel, text);
await p.goto('file:///home/claude/kuadro/dist/index.html'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kuadro-clickopen', '0'); }); await p.reload(); await wait(400);
await click('button', 'Try the demo'); await wait(1800);
// Make row 1 late (2 days ago, Pending), row 2 due tomorrow (Pending), rows 3-4 published this week.
await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('demo-data-en')); const s = d.sheets.find(x => x.title === 'Main channel'), h = s.rows[0], di = h.indexOf('Publish date'), si = h.indexOf('Status');
  const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }; const mon = (() => { const x = new Date(); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); })();
  s.rows[1][di] = day(-2); s.rows[1][si] = 'Pending'; s.rows[2][di] = day(1); s.rows[2][si] = 'Pending'; s.rows[3][di] = mon; s.rows[3][si] = 'Published'; s.rows[4][di] = mon; s.rows[4][si] = 'Published';
  localStorage.setItem('demo-data-en', JSON.stringify(d)); localStorage.setItem('kuadro-alerts', JSON.stringify({ on: true, days: 2, scope: 'all' })); });
await p.reload(); await wait(1800); await click('.sidebar .nav', 'Main channel'); await wait(400);
const dateIdx = await p.evaluate(() => [...document.querySelectorAll('.grid thead th')].findIndex(th => th.textContent.includes('Publish date')));
const cls = await p.evaluate(i => [...document.querySelectorAll('.grid tbody tr')].slice(0, 2).map(tr => tr.children[i].className), dateIdx);
ok('late date red, upcoming orange', /due-late/.test(cls[0]) && /due-soon/.test(cls[1]));
await click('.sidebar .nav', 'Inbox'); await wait(300);
ok('inbox lists late and upcoming', await p.evaluate(() => { const t = document.querySelector('.inbox').innerText; return t.includes('Late') && t.includes('2 days ago') && t.includes('due tomorrow'); }));
await p.screenshot({ path: '/tmp/shots/inbox-due.png', captureBeyondViewport: false });
await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelector('.inbox .icon')?.click()); await wait(200);
await click('.views button, .seg button', 'Dashboard'); await wait(400);
await click('.goal button', 'Set a goal'); await wait(150); await p.evaluate(() => { const i = document.querySelector('.goal input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '3'); i.dispatchEvent(new Event('input', { bubbles: true })); });
await click('.goal button', 'Save'); await wait(500);
ok('weekly goal shows progress', await p.evaluate(() => document.querySelector('.goal-big').textContent.replace(/\s+/g, ' ').includes('2 / 3')));
await (await p.$('.goal')).screenshot({ path: '/tmp/shots/goal.png' });
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
