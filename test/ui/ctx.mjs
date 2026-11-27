import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1500, height: 900 }); const wait = ms => new Promise(r => setTimeout(r, ms));
const errs = [], out = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); const check = (n, ok) => out.push((ok ? 'ok   ' : 'FAIL ') + n);
await p.goto('file:///home/claude/app/dist/index.html'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kuadro-clickopen', '0'); }); await p.reload();
const click = (sel, t) => p.evaluate((sel, t) => { const e = [...document.querySelectorAll(sel)].find(e => e.textContent.trim().startsWith(t)); if (!e) throw new Error('no ' + sel + ' ' + t); e.click(); }, sel, t);
const sheet = t => p.evaluate(t => JSON.parse(localStorage.getItem('demo-data')).sheets.find(s => s.title === t), t);
const titles = async t => (await sheet(t)).rows.slice(1).map(r => r[2]);
await click('button', 'Abrir demostración'); await wait(1500); await click('.nav', 'MITOS'); await wait(300); await click('.seg button', 'Kanban'); await wait(400);
// 1. reordenar arrastrando la 4ª tarjeta encima de la 1ª (mitad superior)
const before = await titles('MITOS');
const moved = await p.evaluate(() => { const col = [...document.querySelectorAll('.kcol')].find(c => c.querySelector('.kcol-h').textContent.startsWith('Pendiente')); const cards = col.querySelectorAll('.card'); const src = cards[3], dst = cards[0]; const b = dst.getBoundingClientRect(); const dt = new DataTransfer();
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); const ev = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: b.left + 20, clientY: b.top + 5 };
  dst.dispatchEvent(new DragEvent('dragover', ev)); return src.querySelector('.card-t').textContent; });
await wait(150); check('línea de inserción visible', await p.evaluate(() => !!document.querySelector('.card.ins-b'))); await p.screenshot({ path: '/tmp/shots/reorder-line.png', captureBeyondViewport: false });
await p.evaluate(() => { const col = [...document.querySelectorAll('.kcol')].find(c => c.querySelector('.kcol-h').textContent.startsWith('Pendiente')); const dst = col.querySelectorAll('.card')[0]; const b = dst.getBoundingClientRect(); const dt = new DataTransfer(); dt.setData('text/plain', window.__drag); });
await p.evaluate(m => { const col = [...document.querySelectorAll('.kcol')].find(c => c.querySelector('.kcol-h').textContent.startsWith('Pendiente')); const cards = [...col.querySelectorAll('.card')]; const src = cards.find(c => c.querySelector('.card-t').textContent === m), dst = cards[0]; const b = dst.getBoundingClientRect(); const dt = new DataTransfer();
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); const ev = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: b.left + 20, clientY: b.top + 5 }; dst.dispatchEvent(new DragEvent('dragover', ev)); dst.dispatchEvent(new DragEvent('drop', ev)); src.dispatchEvent(new DragEvent('dragend', { bubbles: true })); }, moved);
await wait(800); const after = await titles('MITOS');
check('la tarjeta quedó primera en el Sheet', after[0] === moved && after.length === before.length);
check('el kanban muestra el nuevo orden', await p.evaluate(m => document.querySelector('.kcol .card .card-t').textContent === m, moved));
// 2. clic derecho en tarjeta → Bajar al final de la columna
const first = await p.evaluate(() => document.querySelector('.kcol .card .card-t').textContent); await p.click('.kcol .card', { button: 'right' }); await wait(200); console.log('MENU1', JSON.stringify(await p.evaluate(() => document.querySelector('.ctx')?.innerText)));
await wait(250); check('menú contextual abre', await p.evaluate(() => !!document.querySelector('.ctx'))); 
const hov = async t => { const h = await p.evaluateHandle(t => [...document.querySelectorAll('.ctx > .ctx-i')].find(e => e.textContent.startsWith(t)), t); await h.hover(); await wait(200); };
await hov('Cambiar');
await p.screenshot({ path: '/tmp/shots/ctx-card.png', captureBeyondViewport: false });
await click('.ctx-i', 'Bajar al final'); await wait(800); check('bajar al final', (await titles('MITOS')).at(-1) === first);
// 3. clic derecho → Cambiar estado → Editando (submenú)
await p.click('.kcol .card', { button: 'right' }); await wait(200);
const t3 = await p.evaluate(() => document.querySelector('.ctx-t').textContent);
await hov('Cambiar');
await click('.ctx.sub .ctx-i', 'Editando'); await wait(700);
check('submenú cambia el estado', (await sheet('MITOS')).rows.find(r => r[2] && r[2].startsWith(t3.slice(0, 20)))[4] === 'Editando');
// 4. duplicar y eliminar desde la tabla
await click('.seg button', 'Tabla'); await wait(300);
await p.click('.grid tbody tr td[data-col="Título del Video"]', { button: 'right', offset: { x: 200, y: 10 } }); await wait(200);
const n0 = (await sheet('MITOS')).rows.length; await click('.ctx-i', 'Duplicar'); await wait(900);
const rows = (await sheet('MITOS')).rows; check('duplicar crea copia', rows.length === n0 + 1 && rows.at(-1)[2].endsWith('(copia)'));
{ const h = await p.evaluateHandle(() => { const trs = document.querySelectorAll('.grid tbody tr'); return trs[trs.length - 1].querySelector('td[data-col="Fecha"]'); }); await h.scrollIntoView(); await h.click({ button: 'right' }); } await wait(200);
await click('.ctx-i', 'Eliminar'); await wait(800); check('eliminar desde el menú', (await sheet('MITOS')).rows.length === n0);
// 5. menú de encabezado: ordenar
{ const h = await p.evaluateHandle(() => [...document.querySelectorAll('.grid th')].find(t => t.textContent.includes('Título del Video'))); await h.click({ button: 'right' }); } await wait(200);
await p.screenshot({ path: '/tmp/shots/ctx-col.png', captureBeyondViewport: false });
await click('.ctx-i', 'Ordenar A'); await wait(300); check('ordenar desde encabezado', await p.evaluate(() => document.querySelector('.topbar select').value === 'Título del Video'));
console.log(out.join('\n')); console.log('ERRORS', errs); await b.close();
