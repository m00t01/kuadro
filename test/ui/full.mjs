// Recorrido completo de la interfaz con la demo en inglés.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1500, height: 900 });
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [], errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/net::|ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); }); p.on('dialog', d => d.accept());
const ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n);
const shot = n => p.screenshot({ path: `/tmp/shots/${n}.png`, captureBeyondViewport: false });
const click = (sel, t) => p.evaluate((sel, t) => { const e = [...document.querySelectorAll(sel)].find(e => e.textContent.trim().startsWith(t)); if (!e) throw new Error('missing ' + sel + ' ' + t); e.click(); }, sel, t);
const data = () => p.evaluate(() => JSON.parse(localStorage.getItem('demo-data-en')));
const sheet = async t => (await data()).sheets.find(s => s.title === t);
const col = async (tab, name) => { const s = await sheet(tab); const i = s.rows[0].indexOf(name); return s.rows.slice(1).map(r => r[i]); };
const step = async (name, fn) => { try { await fn(); } catch (e) { out.push('EXC  ' + name + ': ' + e.message.split('\n')[0]); await shot('fail-' + name.replace(/\W+/g, '_')); } };
await p.goto('file:///home/claude/app/dist/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(400);

await step('home', async () => {
  ok('inicio en inglés por defecto', await p.evaluate(() => document.body.innerText.includes('Open demo') && document.body.innerText.includes('Tables, kanban')));
  await click('.seg button', 'Español'); await wait(700); ok('cambiar a español', await p.evaluate(() => document.body.innerText.includes('Abrir demostración')));
  await shot('lang-es'); await click('.seg button', 'English'); await wait(700); ok('volver a inglés', await p.evaluate(() => document.body.innerText.includes('Open demo')));
  await click('button', 'Open demo'); await wait(1600);
});
const TAB = 'Main channel';
await step('tabla-teclado', async () => {
  await click('.nav', TAB); await wait(300);
  ok('título fijo primero', await p.evaluate(() => document.querySelector('.grid thead th:nth-child(2)').textContent.includes('Video title')));
  await p.click('.grid tbody tr:nth-child(1) td[data-col="Video title"]'); await wait(100);
  await p.keyboard.type('Edited with keyboard'); await p.keyboard.press('Enter'); await wait(400);
  ok('escribir reemplaza y Enter guarda', (await col(TAB, 'Video title'))[0] === 'Edited with keyboard');
  ok('Enter baja a la siguiente fila', await p.evaluate(() => !!document.querySelector('.grid tbody tr:nth-child(2) td.act')));
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('Delete'); await wait(400);
  ok('Supr vacía', (await col(TAB, 'Video title'))[0] === '');
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control'); await wait(500);
  ok('Ctrl+Z restaura', (await col(TAB, 'Video title'))[0] === 'Edited with keyboard');
  await p.keyboard.down('Control'); await p.keyboard.press('y'); await p.keyboard.up('Control'); await wait(500);
  ok('Ctrl+Y rehace', (await col(TAB, 'Video title'))[0] === '');
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control'); await wait(400);
  // pegar 2x2 en Notes/ID? → pegar en Topic/Status de las filas 3 y 4
  await p.click('.grid tbody tr:nth-child(3) td[data-col="Topic"]');
  await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'Trend\tEditing\nReaction\tRecording'); document.querySelector('.gridbox').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }); await wait(500);
  const tp = await col(TAB, 'Topic'), stt = await col(TAB, 'Status');
  ok('pegar bloque 2x2', tp[2] === 'Trend' && stt[2] === 'Editing' && tp[3] === 'Reaction' && stt[3] === 'Recording');
  // copiar
  const copied = await p.evaluate(() => { let txt = ''; const dt = new DataTransfer(); const ev = new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }); document.querySelector('.gridbox').dispatchEvent(ev); return dt.getData('text/plain'); });
  ok('copiar rango', copied.includes('Trend\tEditing'));
  // Shift+flechas y casilla con espacio
  await p.click('.grid tbody tr:nth-child(5) td[data-col="Script ready"]'); const before = (await col(TAB, 'Script ready'))[4];
  await p.keyboard.press('Space'); await wait(400); ok('espacio cambia casilla', (await col(TAB, 'Script ready'))[4] === !before);
  await shot('table-kb');
});
await step('tabla-seleccion', async () => {
  await p.click('.grid tbody tr:nth-child(6) td.num'); await p.keyboard.down('Shift'); await p.click('.grid tbody tr:nth-child(8) td.num'); await p.keyboard.up('Shift'); await wait(200);
  await p.evaluate(() => {}); ok('barra masiva visible', await p.evaluate(() => !!document.querySelector('.bulk')));
  const n = await p.evaluate(() => document.querySelector('.bulk b').textContent); ok('selección de rango (3)', n.startsWith('3'));
  await click('.bulk .btn', 'Change'); await wait(200); await click('.ctx-i', 'Discarded'); await wait(600);
  const s = await col(TAB, 'Status'); ok('cambio masivo de estado', s[5] === 'Discarded' && s[6] === 'Discarded' && s[7] === 'Discarded');
  await shot('bulk'); await p.keyboard.press('Escape');
});
await step('columnas', async () => {
  const th = await p.evaluateHandle(() => [...document.querySelectorAll('.grid th')].find(t => t.textContent.includes('Channel')));
  const bb = await th.boundingBox(); const w0 = bb.width;
  await p.mouse.move(bb.x + bb.width - 2, bb.y + 10); await p.mouse.down(); await p.mouse.move(bb.x + bb.width + 80, bb.y + 10, { steps: 5 }); await p.mouse.up(); await wait(200);
  const w1 = (await th.boundingBox()).width; ok('ajustar ancho', w1 > w0 + 60);
  await th.click({ button: 'right' }); await wait(200); await click('.ctx-i', 'Hide in this view'); await wait(300);
  ok('ocultar columna', await p.evaluate(() => ![...document.querySelectorAll('.grid th')].some(t => t.textContent.includes('Channel'))));
  await p.click('.topbar .btn[data-k=columns]'); await wait(200); await p.evaluate(() => [...document.querySelectorAll('.pop label')].find(l => l.textContent.includes('Channel')).querySelector('input').click()); await wait(200);
  ok('mostrar de nuevo', await p.evaluate(() => [...document.querySelectorAll('.grid th')].some(t => t.textContent.includes('Channel')))); await p.keyboard.press('Escape');
});
await step('kanban', async () => {
  await click('.seg button', 'Kanban'); await wait(400);
  await p.click('.topbar .btn[data-k=props]'); await wait(200);
  await p.evaluate(() => { const s = document.querySelector('.pop select'); s.value = 'Channel'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300); await p.keyboard.press('Escape');
  ok('carriles por canal', await p.evaluate(() => document.querySelectorAll('.lane').length >= 2)); await shot('kanban-lanes');
  await p.click('.topbar .btn[data-k=props]'); await wait(200); await p.evaluate(() => { const s = document.querySelector('.pop select'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.keyboard.press('Escape'); await wait(300);
  await p.evaluate(() => [...document.querySelectorAll('.kcol')].find(c => c.textContent.startsWith('Discarded')).querySelector('.kc-btn').click()); await wait(300);
  ok('plegar columna', await p.evaluate(() => !!document.querySelector('.kcol.folded')));
  await shot('kanban-folded');
});
await step('calendario', async () => {
  await click('.seg button', 'Calendar'); await wait(400);
  ok('panel sin programar', await p.evaluate(() => !!document.querySelector('.unsched')));
  const t = await p.evaluate(() => document.querySelector('.unsched .cal-i').textContent);
  await p.evaluate(() => { const src = document.querySelector('.unsched .cal-i'); const day = [...document.querySelectorAll('.cal-c:not(.out)')][14]; const dt = new DataTransfer(); src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); day.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); day.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); }); await wait(500);
  ok('programar arrastrando', await p.evaluate(t => [...document.querySelectorAll('.cal-g .cal-i')].some(e => e.textContent === t), t));
  await click('.sm-seg button', 'Week'); await wait(300); ok('vista semana', await p.evaluate(() => document.querySelectorAll('.cal-g .cal-c').length === 7)); await shot('cal-week');
});
await step('pagina', async () => {
  await click('.seg button', 'Table'); await wait(300);
  await p.evaluate(() => document.querySelector('.grid tbody tr:nth-child(2) .openbtn').click()); await wait(700);
  await p.hover('.page-in'); await click('.page-add .mini', '☺ Add icon'); await wait(200); await click('.emoji-grid button', '🔥'); await wait(300);
  await click('.page-add .mini', '▭ Add cover'); await wait(200); await p.click('.grad-grid button:nth-child(3)'); await wait(300);
  ok('ícono y portada', await p.evaluate(() => document.querySelector('.page-icon')?.textContent === '🔥' && !!document.querySelector('.cover')));
  ok('vista previa con contador', await p.evaluate(() => /\/100 characters/.test(document.querySelector('.yp-count').textContent)));
  await click('.ytprev .sm-seg button', 'Compare'); await wait(200); await click('.yp-add', '＋ Add variant'); await wait(300);
  ok('variante agregada', await p.evaluate(() => document.querySelectorAll('.yp-var').length === 2)); await shot('page-yt');
  await p.click('.prose .ProseMirror'); await p.keyboard.type('/head'); await wait(250);
  ok('menú / aparece', await p.evaluate(() => !!document.querySelector('.slash')));
  await p.keyboard.press('Enter'); await p.keyboard.type('Intro section'); await p.keyboard.press('Enter');
  await p.keyboard.type('/callout'); await wait(200); await p.keyboard.press('Enter'); await p.keyboard.type('Remember to say hi'); await wait(200);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('End'); await p.keyboard.press('Enter');
  await p.keyboard.type('/toggle'); await wait(200); await p.keyboard.press('Enter'); await wait(200);
  await p.keyboard.type('/table'); await wait(200); await p.keyboard.press('Enter'); await wait(1300);
  const md = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('demo-data-en')); const r = d.sheets.find(s => s.title === '_app_pages').rows; return r.slice(1).map(x => x.slice(3).join('')).join('\n'); });
  ok('bloques guardados (título, destacado, desplegable, tabla)', /# Intro section/.test(md) && /data-callout/.test(md) && /data-toggle/.test(md) && /<table|\|/.test(md));
  await click('.page-h .icon', '✕'); await wait(300); await p.evaluate(() => document.querySelector('.grid tbody tr:nth-child(2) .openbtn').click()); await wait(800);
  ok('al reabrir se ven los bloques', await p.evaluate(() => !!document.querySelector('.prose h1') && !!document.querySelector('.prose .callout') && !!document.querySelector('.prose .toggle') && !!document.querySelector('.prose table')));
  await shot('page-blocks');
  // comentarios con mención
  await p.click('.page .mention textarea'); await p.keyboard.type('Hey @Y'); await wait(200); ok('autocompletar mención', await p.evaluate(() => !!document.querySelector('.mlist')));
  await p.keyboard.press('Enter'); await p.keyboard.type('check this'); await p.keyboard.press('Enter'); await wait(400);
  await p.evaluate(() => [...document.querySelectorAll('.cmt .mini')].find(b => b.textContent === 'Reply').click()); await wait(200); await p.keyboard.type('Done!'); await p.keyboard.press('Enter'); await wait(400);
  ok('comentario y respuesta', await p.evaluate(() => document.querySelectorAll('.cmt').length === 2 && !!document.querySelector('.cmt.reply')));
  await p.evaluate(() => [...document.querySelectorAll('.cmt.reply .mini')].find(b => b.textContent === 'Delete').click()); await wait(300);
  ok('borrar comentario', await p.evaluate(() => document.querySelector('.cmt.reply').textContent.includes('Comment deleted')));
  await shot('page-comments'); await click('.page-h .icon', '✕'); await wait(200);
});
await step('automatizacion', async () => {
  await click('.nav', 'Settings'); await wait(300); await click('.set nav button', 'Automations'); await wait(200);
  ok('automatizaciones de ejemplo', await p.evaluate(() => document.querySelectorAll('.auto-i').length === 2));
  await click('.btn', '＋ New automation'); await wait(300);
  await p.evaluate(() => { const ed = document.querySelectorAll('.modal')[1]; const sels = ed.querySelectorAll('.ablock')[0].querySelectorAll('select'); sels[2].value = 'Recording'; sels[2].dispatchEvent(new Event('change', { bubbles: true })); }); await wait(100);
  await click('.modal .mini', '＋ Action'); await wait(100);
  await p.evaluate(() => { const ed = document.querySelectorAll('.modal')[1]; const blk = ed.querySelectorAll('.ablock')[2]; const s = blk.querySelectorAll('select'); s[1].value = 'Script ready'; s[1].dispatchEvent(new Event('change', { bubbles: true })); }); await wait(100);
  await p.evaluate(() => { const ed = document.querySelectorAll('.modal')[1]; const blk = ed.querySelectorAll('.ablock')[2]; const s = blk.querySelectorAll('select'); s[2].value = 'true'; s[2].dispatchEvent(new Event('change', { bubbles: true })); }); await wait(100);
  const sentence = await p.evaluate(() => document.querySelectorAll('.modal')[1].querySelector('.info').textContent); ok('frase de la regla: ' + sentence, /When “Status” changes to “Recording”, then set “Script ready” to “true”/.test(sentence));
  await shot('auto-editor'); await click('.modal .btn.primary', 'Save'); await wait(400);
  await click('.modal-h .icon', '✕'); await wait(200);
  await p.click('.grid tbody tr:nth-child(10) td[data-col="Status"]'); await p.keyboard.press('Enter'); await wait(200); await click('.pop .pop-i', 'Recording'); await wait(600);
  ok('regla propia se ejecuta', (await col(TAB, 'Script ready'))[9] === true);
  await p.click('.grid tbody tr:nth-child(11) td[data-col="Status"]'); await p.keyboard.press('Enter'); await wait(200); await click('.pop .pop-i', 'Published'); await wait(600);
  const pd = (await col(TAB, 'Publish date'))[10]; ok('regla de ejemplo: fecha al publicar', typeof pd === 'number' && pd > 46000);
});
await step('buscar-contenido', async () => {
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control'); await wait(200); await p.keyboard.type('remember to say'); await wait(300);
  ok('Ctrl+K encuentra dentro del guion', await p.evaluate(() => document.querySelector('.palette').textContent.includes('Remember to say hi'))); await shot('palette'); await p.keyboard.press('Escape');
});
await step('bandeja', async () => {
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('demo-data-en')); const h = d.sheets.find(s => s.title === '_app_history'); const main = d.sheets.find(s => s.title === 'Main channel'); h.rows.push([new Date().toISOString(), 'ana@example.com', 'Main channel', main.rows[3][17], 'Writer', '', 'You', 'edit', main.rows[3][2]]); localStorage.setItem('demo-data-en', JSON.stringify(d)); });
  await p.reload(); await wait(1600); await p.evaluate(() => document.querySelector('.status .icon').click()); await wait(800);
  ok('insignia de no leídos', await p.evaluate(() => !!document.querySelector('.nav .badge')));
  await click('.nav', '🔔 Inbox'); await wait(300); ok('bandeja muestra asignación', await p.evaluate(() => document.querySelector('.inbox').textContent.includes('assigned you as writer'))); await shot('inbox');
  await click('.ib-h .icon', '✕'); await wait(200);
});
await step('tema-claro', async () => {
  await click('.nav', 'Settings'); await wait(300); await click('.set nav button', 'Appearance'); await wait(200); await click('.sm-seg button', 'Light'); await wait(300);
  ok('tema claro', await p.evaluate(() => document.body.classList.contains('light'))); await click('.modal-h .icon', '✕'); await click('.seg button', 'Kanban'); await wait(400); await shot('light-kanban');
  await click('.seg button', 'Table'); await wait(300); await shot('light-table');
});
console.log(out.join('\n')); console.log('ERRORS', [...new Set(errs)].slice(0, 8)); await b.close();
