// Extra screenshots for visual review: context menu, template gallery, filter/props popovers, column editor, toasts, gallery empty hint.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const wait = ms => new Promise(r => setTimeout(r, ms)); const errs = [];
for (const theme of ['dark', 'light']) {
  const p = await b.newPage(); await p.setViewport({ width: 1400, height: 820 }); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.dismiss());
  await p.goto('file:///home/claude/kuadro/dist/index.html');
  await p.evaluate(t => { localStorage.clear(); localStorage.setItem('kuadro-lang', 'en'); localStorage.setItem('appearance', JSON.stringify({ theme: t })); }, theme); await p.reload(); await wait(400);
  const click = (sel, text) => p.evaluate((s, t) => { const e = [...document.querySelectorAll(s)].find(x => x.textContent.trim().startsWith(t)); if (e) e.click(); return !!e; }, sel, text);
  const S = n => p.screenshot({ path: `/tmp/audit/x-${theme}-${n}.png` });
  await click('button', 'Try the demo'); await wait(1800);
  const td = await p.evaluate(() => { const r = document.querySelectorAll('.grid tbody tr')[2].querySelector('td.title').getBoundingClientRect(); return { x: r.x + 60, y: r.y + 10 }; });
  await p.mouse.click(td.x, td.y, { button: 'right' }); await wait(300); await S('ctx');
  await p.evaluate(() => { const i = [...document.querySelectorAll('.ctx-i')].find(x => x.textContent.startsWith('Move to folder')); i && i.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); }); await p.hover('.ctx-i.has-sub:last-of-type').catch(() => {}); await wait(200); await S('ctx-sub');
  await p.keyboard.press('Escape'); await p.mouse.click(700, 790); await wait(200);
  await p.click('button[title]').catch(() => {});
  await p.evaluate(() => document.querySelector('.toolbar .icon, header .icon')?.click()); await wait(300); await S('toolbar-pop');
  await p.keyboard.press('Escape'); await wait(200);
  await p.evaluate(() => [...document.querySelectorAll('.grid th')].find(t => t.textContent.includes('Status'))?.click()); await wait(400); await S('coleditor');
  await p.keyboard.press('Escape'); await wait(300);
  await click('.sidebar .nav', 'Settings'); await wait(300); await click('.set nav button', 'Automations'); await wait(200); await click('button', 'Add from template'); await wait(300); await S('tplgal');
  await p.keyboard.press('Escape'); await wait(200); await click('.set nav button', 'Users'); await wait(200); await S('users');
  await click('.set nav button', 'YouTube'); await wait(200); await S('yt');
  await click('.set nav button', 'Templates'); await wait(200); await S('tpl');
  await click('.set nav button', 'Checklists'); await wait(200); await S('chk');
  await click('.set nav button', 'History'); await wait(200); await S('hist');
  await p.close();
}
console.log('errors', errs); await b.close();
