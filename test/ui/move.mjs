import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1500, height: 900 }); const wait = ms => new Promise(r => setTimeout(r, ms));
const errs = [], out = []; p.on('pageerror', e => errs.push(e.message)); const check = (n, ok) => out.push((ok ? 'ok   ' : 'FAIL ') + n);
await p.goto('file:///home/claude/app/dist/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
const click = (sel, t) => p.evaluate((sel, t) => [...document.querySelectorAll(sel)].find(e => e.textContent.trim().startsWith(t)).click(), sel, t);
const sheet = t => p.evaluate(t => JSON.parse(localStorage.getItem('demo-data')).sheets.find(s => s.title === t), t);
const has = async (t, title) => (await sheet(t)).rows.some(r => r[2] === title);
await click('button', 'Abrir demostración'); await wait(1500); await click('.nav', 'REACCIONES'); await wait(300); await click('.seg button', 'Kanban'); await wait(400);
// 1. arrastrar tarjeta del kanban a la pestaña ROBLOX VARIEDAD
const title = await p.evaluate(() => { const card = document.querySelector('.kcol .card'); const t = card.querySelector('.card-t').textContent; const dst = [...document.querySelectorAll('.nav')].find(e => e.textContent.startsWith('ROBLOX VARIEDAD'));
  const dt = new DataTransfer(); card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return t; });
await wait(900);
check('kanban → pestaña: sale de REACCIONES', !(await has('REACCIONES', title))); check('kanban → pestaña: llega a ROBLOX VARIEDAD', await has('ROBLOX VARIEDAD', title));
check('contador de la barra lateral actualizado', await p.evaluate(() => [...document.querySelectorAll('.nav')].find(e => e.textContent.startsWith('REACCIONES')).textContent.endsWith('1')));
// 2. desde la página: mover a MITOS
await click('.nav', 'ROBLOX VARIEDAD'); await wait(300); await click('.seg button', 'Tabla'); await wait(300);
await p.evaluate(t => { const tr = [...document.querySelectorAll('.grid tbody tr')].find(tr => tr.textContent.includes(t)); tr.querySelector('.openbtn').click(); }, title); await wait(500);
await p.select('.tabsel', 'MITOS'); await wait(900);
check('página → MITOS', await has('MITOS', title) && !(await has('ROBLOX VARIEDAD', title)));
check('la página sigue abierta tras moverla', await p.evaluate(t => (document.querySelector('.ptitle') || {}).value === t, title));
await p.screenshot({ path: '/tmp/shots/move-page.png' });
await click('.page-h .icon', '✕'); await wait(200);
// 3. tabla: arrastrar el número de fila a SHORTS 2D
await click('.nav', 'MITOS'); await wait(300);
const t2 = await p.evaluate(() => { const tr = document.querySelector('.grid tbody tr'); const t = tr.querySelector('td.title').querySelector('.cellbtn').textContent.trim(); const dst = [...document.querySelectorAll('.nav')].find(e => e.textContent.startsWith('SHORTS 2D'));
  const dt = new DataTransfer(); tr.querySelector('td.num').dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); return t; });
await wait(900); check('tabla → SHORTS 2D', await has('SHORTS 2D', t2) && !(await has('MITOS', t2)));
// 4. historial muestra el movimiento
await click('.nav', 'Ajustes'); await wait(300); await click('.set nav button', 'Historial'); await wait(300);
check('historial registra «Movió de … a …»', await p.evaluate(() => document.querySelector('.hist').textContent.includes('Movió de')));
await p.screenshot({ path: '/tmp/shots/move-hist.png' });
console.log(out.join('\n')); console.log('ERRORS', errs); await b.close();
