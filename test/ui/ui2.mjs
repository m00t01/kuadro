import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1500, height: 900 });
const errs = [], out = []; p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|net::/.test(m.text())) errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
p.on('dialog', d => d.accept());
await p.goto('file:///home/claude/app/dist/index.html'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kuadro-clickopen', '0'); }); await p.reload(); const shot = n => p.screenshot({ path: `/tmp/shots/${n}.png` }); const wait = ms => new Promise(r => setTimeout(r, ms));
const clickText = async (sel, t) => { const ok = await p.evaluate((sel, t) => { const e = [...document.querySelectorAll(sel)].find(e => e.textContent.trim().startsWith(t)); if (e) e.click(); return !!e; }, sel, t); if (!ok) errs.push('NO ELEMENT ' + sel + ' ' + t); await wait(350); };
const demo = () => p.evaluate(() => JSON.parse(localStorage.getItem('demo-data')));
const sheet = async t => (await demo()).sheets.find(s => s.title === t);
const check = (name, ok) => out.push((ok ? 'ok   ' : 'FAIL ') + name);
try {
  await clickText('button', 'Abrir demostración'); await wait(1200); await clickText('.nav', 'MITOS');
  // 1. editar celda de selección desde la tabla
  await p.evaluate(() => document.querySelectorAll('.grid tbody tr')[0].querySelectorAll('td')[5].querySelector('.cellbtn').click()); await wait(300);
  await clickText('.pop-i', 'Grabando'); await wait(500);
  let s = await sheet('MITOS'); check('select desde tabla escribe en el Sheet', s.rows[1][4] === 'Grabando');
  // 2. crear opción nueva en un desplegable
  await p.evaluate(() => document.querySelectorAll('.grid tbody tr')[1].querySelectorAll('td')[5].querySelector('.cellbtn').click()); await wait(300);
  await p.type('.pop-q', 'En revisión'); await p.keyboard.press('Enter'); await wait(600);
  s = await sheet('MITOS'); check('crear opción nueva y asignarla', s.rows[2][4] === 'En revisión');
  // 3. texto: editar título en la tabla
  await p.evaluate(() => document.querySelectorAll('.grid tbody tr')[2].querySelector('td.title .cellbtn').click()); await wait(200);
  await p.keyboard.down('Control'); await p.keyboard.press('a'); await p.keyboard.up('Control'); await p.keyboard.type('Título editado desde la tabla'); console.log('DBG', await p.evaluate(() => document.activeElement.tagName + '.' + document.activeElement.className + ' | ' + (document.querySelector('textarea.edit')||{}).value + ' | pop=' + !!document.querySelector('.pop') + ' | toasts=' + document.querySelector('.toasts').textContent)); await p.keyboard.press('Enter'); await wait(500);
  s = await sheet('MITOS'); check('editar texto en tabla', s.rows[3][2] === 'Título editado desde la tabla');
  // 4. nueva fila + título en página
  await clickText('.btn.primary', '+ Nuevo'); await wait(600); await p.type('.ptitle', 'Video creado en la app'); await p.click('.page-h'); await wait(800);
  s = await sheet('MITOS'); const last = s.rows[s.rows.length - 1]; check('nueva fila con ID y título', last[2] === 'Video creado en la app' && /^[a-z0-9]{8}$/.test(last[17]) && last[0].f === '=ROW()-1');
  // 5. fecha desde la página
  await p.evaluate(() => { const pr = [...document.querySelectorAll('.prop')].find(x => x.textContent.startsWith('▦Fecha de publicación')); pr.querySelector('.cellbtn').click(); }); await wait(200);
  await p.evaluate(() => { const i = document.querySelector('.prop input[type=date]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '2026-12-05'); i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(600);
  s = await sheet('MITOS'); check('fecha guardada como fecha real', s.rows[s.rows.length - 1][10] === 46361);
  await shot('7-newpage'); await clickText('.page-h .icon', '✕');
  // 6. kanban: arrastrar tarjeta
  await clickText('.seg button', 'Kanban'); await wait(300);
  const moved = await p.evaluate(() => { const cols = [...document.querySelectorAll('.kcol')]; const src = cols.find(c => c.querySelector('.kcol-h').textContent.startsWith('Pendiente')); const card = src.querySelector('.card'); const title = card.querySelector('.card-t').textContent; const dst = cols.find(c => c.querySelector('.kcol-h').textContent.startsWith('Publicado')); const dt = new DataTransfer(); card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, cancelable: true })); dst.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt, cancelable: true })); return title; }); await wait(600);
  s = await sheet('MITOS'); check('sin columna «Sin estado» con valor por defecto', await p.evaluate(() => ![...document.querySelectorAll('.kcol-h')].some(h => h.textContent.startsWith('Sin'))));
  check('arrastrar tarjeta cambia el estado', s.rows.find(r => r[2] === moved)[4] === 'Publicado');
  // 7. calendario muestra el video con fecha
  await clickText('.seg button', 'Calendario'); await wait(300); await clickText('.cal-h .btn', '›'); await wait(300);
  check('calendario muestra el elemento en diciembre', await p.evaluate(() => [...document.querySelectorAll('.cal-i')].some(e => e.textContent.includes('Video creado en la app')))); await shot('8-cal');
  // 8. ajustes: agregar columna multi-selección, usuario y rol
  await clickText('.nav', 'Ajustes'); await wait(300); await clickText('.set nav button', 'Columnas'); await clickText('.set-b .btn', '+ Agregar columna'); await wait(200);
  await p.type('.modal input', 'Etiquetas'); await p.select('.modal:not(.wide) select', 'multi'); await clickText('.btn.primary', 'Crear columna'); await wait(900);
  s = await sheet('MITOS'); check('columna nueva en el Sheet', s.rows[0][18] === 'Etiquetas');
  await clickText('.set nav button', 'Usuarios'); await p.type('.set-b input[placeholder=Nombre]', 'Ana'); await p.type('.set-b input[placeholder="correo@gmail.com"]', 'ana@gmail.com'); await clickText('.set-b .btn', 'Agregar persona'); await wait(500);
  await clickText('.set nav button', 'Roles'); await wait(200); await shot('9-roles');
  await clickText('.set nav button', 'Historial'); await wait(200); await shot('10-hist');
  const cfg = JSON.parse((await sheet('_app_config')).rows[1].slice(3).join('')); check('usuario guardado en la configuración', cfg.users.some(u => u.email === 'ana@gmail.com') && cfg.schema.Etiquetas.type === 'multi' && cfg.schema.Estado.options.some(o => o.v === 'En revisión'));
  await clickText('.modal-h .icon', '✕');
  // 9. multi-selección en tabla
  await clickText('.seg button', 'Tabla'); await wait(300);
  await p.evaluate(() => { const tds = document.querySelectorAll('.grid tbody tr')[0].querySelectorAll('td'); tds[tds.length - 1].querySelector('.cellbtn').click(); }); await wait(300);
  await p.type('.pop-q', 'viral'); await p.keyboard.press('Enter'); await wait(400); await p.type('.pop-q', 'gta'); await p.keyboard.press('Enter'); await wait(600);
  s = await sheet('MITOS'); check('multi-selección guarda varias etiquetas', s.rows[1][18] === 'viral, gta'); await p.keyboard.press('Escape');
  // 10. paleta Ctrl+K
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control'); await wait(200); await p.type('.palette input', 'brainrot'); await wait(300);
  check('buscador Ctrl+K encuentra en otras pestañas', await p.evaluate(() => document.querySelectorAll('.palette .pop-i').length >= 2)); await p.keyboard.press('Enter'); await wait(400);
  check('abre la página del resultado', await p.evaluate(() => (document.querySelector('.ptitle') || {}).value.includes('BRAINROT')));
  // 11. comentario
  await p.type('.page .askbar input', 'Revisar miniatura @Ana'); await p.keyboard.press('Enter'); await wait(500);
  check('comentario guardado', (await sheet('_app_comments')).rows.length === 2); await shot('11-page2');
  await clickText('.page-h .icon', '✕'); await clickText('.seg button', 'Panel'); await wait(300); await shot('12-dash');
} catch (e) { out.push('EXCEPTION ' + e.message); await shot('fail'); }
console.log(out.join('\n')); console.log('ERRORS', errs.slice(0, 10)); console.log("VAL", JSON.stringify((await sheet("MITOS")).rows[3][2]));await b.close();
