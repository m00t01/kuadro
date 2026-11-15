import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1500, height: 900 }); const wait = ms => new Promise(r => setTimeout(r, ms));
const errs = [], out = []; p.on('pageerror', e => errs.push(e.message)); const check = (n, ok) => out.push((ok ? 'ok   ' : 'FAIL ') + n);
await p.goto('file:///home/claude/app/dist/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
const click = (sel, t) => p.evaluate((sel, t) => { const e = [...document.querySelectorAll(sel)].find(e => e.textContent.trim().startsWith(t)); if (!e) throw new Error('no ' + sel + ' ' + t); e.click(); }, sel, t);
const hov = async t => { const h = await p.evaluateHandle(t => [...document.querySelectorAll('.ctx > .ctx-i')].find(e => e.textContent.startsWith(t)), t); await h.hover(); await wait(200); };
await click('button', 'Abrir demostración'); await wait(1500); await click('.seg button', 'Kanban'); await wait(400);
// columnas: aplicar color de etiqueta a todas, luego Pendiente en morado
await p.click('.kcol-h', { button: 'right' }); await wait(200); await click('.ctx-i', 'Aplicar el color'); await wait(500);
check('todas las columnas coloreadas', await p.evaluate(() => [...document.querySelectorAll('.kcol')].every(c => / kb-/.test(c.className))));
await p.click('.kcol-h', { button: 'right' }); await wait(200); await hov('Color de la columna'); await click('.ctx.sub .ctx-i', 'Morado'); await wait(500);
check('Pendiente en morado', await p.evaluate(() => document.querySelector('.kcol').classList.contains('kb-purple')));
check('las tarjetas no cambian de color', await p.evaluate(() => { const c = [...document.querySelectorAll('.kcol')].map(k => k.querySelector('.card')).filter(Boolean).map(x => getComputedStyle(x).backgroundColor); return new Set(c).size === 1; }));
const cfg = await p.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('demo-data')).sheets.find(s => s.title === '_app_config').rows[1].slice(3).join('')));
check('color guardado en la configuración del proyecto', cfg.schema.Estado.options[0].colBg === 'purple' && cfg.schema.Estado.options[3].colBg === 'auto');
await p.screenshot({ path: '/tmp/shots/look-cols.png' });
// fondo: color preset
await click('.nav', 'Ajustes'); await wait(300); await click('.set nav button', 'Apariencia'); await wait(200);
await p.click('.sw[title="Océano"]'); await wait(200);
check('color de fondo aplicado', await p.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(12, 29, 43)'));
// imagen
const [fc] = await Promise.all([p.waitForFileChooser(), click('label.btn', 'Elegir imagen')]); await fc.accept(['/tmp/bg-test.jpg']); await wait(1200);
check('imagen de fondo aplicada', await p.evaluate(() => document.body.classList.contains('has-img') && getComputedStyle(document.body, '::before').backgroundImage.startsWith('url("data:image/jpeg')));
check('imagen reducida para guardarse', await p.evaluate(() => JSON.parse(localStorage.getItem('appearance')).image.length < 900000));
await p.screenshot({ path: '/tmp/shots/look-settings.png' });
await click('.modal-h .icon', '✕'); await wait(300); await p.screenshot({ path: '/tmp/shots/look-img.png' });
await p.reload(); await wait(1500); check('se conserva al reabrir', await p.evaluate(() => document.body.classList.contains('has-img')));
await click('.seg button', 'Tabla'); await wait(300); await p.screenshot({ path: '/tmp/shots/look-table.png' });
console.log(out.join('\n')); console.log('ERRORS', errs); await b.close();
