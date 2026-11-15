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
await p.evaluate(() => [...document.querySelectorAll('button, .sec, li, a')].find(b => b.textContent.trim().startsWith('Appearance')).click()); await wait(300);
ok('settings panel ready state', (await txt()).includes('Installed version: 1.0.0') && (await txt()).includes('Restart and update'));
await p.evaluate(() => __set({ state: 'none' })); await wait(100);
ok('settings check button', (await txt()).includes('Check for updates') && (await txt()).includes("You're on the latest version."));
await p.evaluate(() => { const el = [...document.querySelectorAll('b.tx')].find(b => b.textContent === 'Updates'); el.scrollIntoView(); });
await p.screenshot({ path: '/tmp/shots/upd-settings.png' });
await p.evaluate(() => { localStorage.setItem('kuadro-lang', 'es'); localStorage.removeItem('current'); }); await p.reload(); await wait(800);
ok('spanish', (await txt()).includes('Buscar actualizaciones'));
console.log(out.join('\n')); console.log('errors:', errs); await b.close();
