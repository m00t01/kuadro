// Audit: visit every screen in EN/ES, dark/light, wide/narrow; report console errors, untranslated text, horizontal overflow, clipped text.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const wait = ms => new Promise(r => setTimeout(r, ms));
const report = [];
const ES_WORDS = /\b(Agregar|Eliminar|Guardar|Cancelar|Buscar|Pestaña|Carpeta|Columna|Fila|Ajustes|Vista|Elemento|Sin título|Vacío|Abrir|Cerrar|Nueva|Nuevo|Mover|Cambiar|Mostrar|Ocultar|Restablecer|Plantilla|Automatizaci|Historial|Usuarios|Permisos|Todos|Hoy|Mañana|semana|días|Arrastra|Escribe|Pega|Clic|Activa|Pausada)\b/;
async function run(lang, theme, width) {
  const p = await b.newPage(); await p.setViewport({ width, height: 820 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); }); p.on('dialog', d => d.dismiss());
  await p.goto('file:///home/claude/kuadro/dist/index.html');
  await p.evaluate((lang, theme) => { localStorage.clear(); localStorage.setItem('kuadro-lang', lang); localStorage.setItem('appearance', JSON.stringify({ theme })); localStorage.setItem('kuadro-clickopen', '0'); }, lang, theme); await p.reload(); await wait(500);
  const tag = `${lang}-${theme}-${width}`;
  const scan = async name => {
    const r = await p.evaluate((esRe, lang) => {
      const re = new RegExp(esRe), out = { overflow: [], untranslated: [], clipped: [] };
      if (document.documentElement.scrollWidth > innerWidth + 2) out.overflow.push('page scrollWidth ' + document.documentElement.scrollWidth);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = walker.nextNode())) { const t = n.textContent.trim(); if (!t || t.length < 3) continue; const el = n.parentElement; if (!el || el.closest('.grid tbody, .card, .gcard, .cal, .ProseMirror, select, option, .ptitle, .tpl-i .muted, .auto-i .muted, .hrow, .fh-name, .qchip, .chip, .sidebar .nav span, .info')) continue;
        const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (lang === 'en' && re.test(t)) out.untranslated.push(t.slice(0, 80)); }
      document.querySelectorAll('button, .btn, .mini, .nav, label, .tab, .seg button').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible') out.clipped.push((e.textContent || '').trim().slice(0, 40)); });
      return out; }, ES_WORDS.source, lang);
    for (const k of ['overflow', 'untranslated', 'clipped']) for (const v of [...new Set(r[k])]) report.push(`[${tag}] ${name} ${k}: ${v}`);
  };
  const click = async (sel, text) => p.evaluate((s, t) => { const e = [...document.querySelectorAll(s)].find(x => x.textContent.trim().startsWith(t)); if (e) { e.click(); return true; } return false; }, sel, text);
  await scan('home'); if (width === 1400) await p.screenshot({ path: `/tmp/audit/${tag}-home.png` });
  await click('button', lang === 'en' ? 'Open demo' : 'Abrir demo'); await wait(2000);
  const views = lang === 'en' ? ['Table', 'Kanban', 'Gallery', 'Calendar', 'Dashboard'] : ['Tabla', 'Kanban', 'Galería', 'Calendario', 'Panel'];
  for (const v of views) { await click('.views button, .seg button', v); await wait(500); await scan('view ' + v); if (width === 1400) await p.screenshot({ path: `/tmp/audit/${tag}-${v}.png` }); }
  await click('.views button, .seg button', views[0]); await wait(300);
  await p.evaluate(() => document.querySelector('.grid tbody tr .openbtn')?.click()); await wait(600); await scan('page'); if (width === 1400) await p.screenshot({ path: `/tmp/audit/${tag}-page.png` });
  await p.keyboard.press('Escape'); await wait(200); await p.keyboard.press('Escape'); await wait(300);
  await click('.sidebar .nav', '🔔'); await wait(300); await scan('inbox'); if (width === 1400) await p.screenshot({ path: `/tmp/audit/${tag}-inbox.png` }); await p.keyboard.press('Escape'); await wait(200);
  await p.evaluate(() => document.querySelectorAll('.inbox .icon').forEach(x => x.click())); await wait(200);
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control'); await wait(300); await scan('palette'); if (width === 1400) await p.screenshot({ path: `/tmp/audit/${tag}-palette.png` }); await p.keyboard.press('Escape'); await wait(200);
  await click('.sidebar .nav', lang === 'en' ? 'Settings' : 'Ajustes'); await wait(300);
  const secs = await p.evaluate(() => [...document.querySelectorAll('.set nav button')].map(b => b.textContent.trim()));
  for (const sname of secs) { await click('.set nav button', sname); await wait(300); await scan('settings ' + sname); if (width === 1400) await p.screenshot({ path: `/tmp/audit/${tag}-set-${sname.replace(/\W+/g, '_')}.png` }); }
  if (errs.length) report.push(`[${tag}] ERRORS: ${[...new Set(errs)].join(' || ')}`);
  await p.close();
}
for (const lang of ['en', 'es']) for (const theme of ['dark', 'light']) for (const width of [1400, 1000]) { if (theme === 'light' && width === 1000) continue; await run(lang, theme, width); }
console.log(report.length ? report.join('\n') : 'no issues'); await b.close();
