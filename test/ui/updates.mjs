// Updates UI: version line, check button, progress, ready banner and settings panel (with a simulated native bridge).
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 820 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.evaluateOnNewDocument(() => {
  const cbs = new Set(); let u = { state: 'idle', current: '1.0.0' };
  const set = x => { u = { ...u, ...x }; cbs.forEach(f => f(u)); };
  window.__set = set; window.__installed = 0;
  window.native = { status: async () => null, creds: async () => ({ has: false }), prefs: async () => ({ shortcut: 'CommandOrControl+Shift+Space', tray: true, autostart: false }), setPrefs: async x => ({ prefs: x }),
    updateState: async () => u, onUpdate: f => { cbs.add(f); return () => cbs.delete(f); },
    checkUpdates: async () => { set({ state: 'checking' }); await new Promise(r => setTimeout(r, 300)); set({ state: 'downloading', version: '1.1.0', percent: 42 }); return u; },
    installUpdate: async () => { window.__installed++; return true; }, notify: async () => { }, open: async () => { } };
});
const wait = ms => new Promise(r => setTimeout(r, ms)), out = [];
const ok = (n, v) => out.push((v ? 'ok   ' : 'FAIL ') + n), txt = () => p.evaluate(() => document.body.innerText);
await p.goto('file:///home/claude/kuadro/dist/index.html'); await wait(600);
ok('home shows version + check link', (await txt()).includes('Kuadro 1.0.0 · Check for updates'));
await p.evaluate(() => [...document.querySelectorAll('.home-ver a')][0].click()); await wait(100);
ok('checking state', (await txt()).includes('Checking for updates'));
await wait(400); ok('downloading %', (await txt()).includes('Downloading version 1.1.0… 42%'));
await p.evaluate(() => __set({ state: 'ready', version: '1.1.0' })); await wait(100);
ok('banner when ready', (await txt()).includes('Kuadro 1.1.0 is ready.'));
await p.screenshot({ path: '/tmp/shots/upd-home.png' });
await p.evaluate(() => [...document.querySelectorAll('.upd-banner button')][0].click()); await wait(50);
ok('restart calls install', await p.evaluate(() => __installed === 1));
await p.evaluate(() => document.querySelector('.upd-banner .icon').click()); await wait(50);
ok('banner dismissable', !(await txt()).includes('Kuadro 1.1.0 is ready.'));
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Open demo')).click()); await wait(1500);
await p.evaluate(() => [...document.querySelectorAll('.nav')].find(b => b.textContent.startsWith('Settings')).click()); await wait(300);
await p.setViewport({ width: 1300, height: 600 }); await wait(200);
ok('settings footer shows ready state', await p.evaluate(() => { const m = document.querySelector('.set nav .upd-mini'); return !!m && m.textContent.includes('Kuadro 1.0.0') && m.textContent.includes('Restart and update'); }));
ok('not inside Appearance anymore', await p.evaluate(() => { [...document.querySelectorAll('.set nav button')].find(b => b.textContent.startsWith('Appearance')).click(); return true; }) && await p.evaluate(() => !document.querySelector('.set-b').textContent.includes('Installed version')));
const pos = () => p.evaluate(() => { const m = document.querySelector('.upd-mini').getBoundingClientRect(), mod = document.querySelector('.modal.settings').getBoundingClientRect(); return { left: Math.round(m.left - mod.left), bottom: Math.round(mod.bottom - m.bottom) }; });
const a = await pos(); await p.evaluate(() => document.querySelector('.set-b').scrollTo(0, 3000)); await wait(100); const b2 = await pos();
ok('fixed bottom-left, content scroll does not move it', a.left < 5 && a.bottom < 5 && a.left === b2.left && a.bottom === b2.bottom);
await p.evaluate(() => __set({ state: 'none' })); await wait(100);
ok('check button and status', await p.evaluate(() => { const m = document.querySelector('.upd-mini'); return m.textContent.includes('Check for updates') && m.textContent.includes("You're on the latest version."); }));
await p.screenshot({ path: '/tmp/shots/upd-settings.png' });
await p.evaluate(() => { localStorage.setItem('kuadro-lang', 'es'); localStorage.removeItem('current'); }); await p.reload(); await wait(800);
ok('spanish', (await txt()).includes('Buscar actualizaciones'));
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
