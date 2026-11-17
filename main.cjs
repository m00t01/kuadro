// Proceso principal: ventana, inicio de sesión con Google (OAuth para apps de escritorio con PKCE) y utilidades nativas.
const { app, BrowserWindow, ipcMain, shell, dialog, Notification, safeStorage, Menu, clipboard, globalShortcut, Tray, nativeImage, screen } = require('electron');
const path = require('path'), fs = require('fs'), http = require('http'), crypto = require('crypto');
const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'];
const file = () => path.join(app.getPath('userData'), 'cuenta.json');
const enc = s => safeStorage.isEncryptionAvailable() ? 'e:' + safeStorage.encryptString(s).toString('base64') : 'p:' + s;
const dec = s => !s ? '' : s.startsWith('e:') ? safeStorage.decryptString(Buffer.from(s.slice(2), 'base64')) : s.slice(2);
const load = () => { try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { return {}; } };
const save = c => fs.writeFileSync(file(), JSON.stringify(c));
let access = null, win;
const M = { en: { ready: 'Done. You can go back to Kuadro.', fail: "Couldn't sign in.", open: 'Open Kuadro', cap: 'Quick capture', quit: 'Quit', upd: v => `Kuadro ${v} is ready`, updb: 'It will be installed when you close Kuadro.', imgs: 'Images', taken: 'That shortcut is already used by another app; choose another combination.', bad: "That shortcut isn't valid." }, es: { ready: 'Listo. Ya puedes volver a Kuadro.', fail: 'No se pudo iniciar sesión.', open: 'Abrir Kuadro', cap: 'Captura rápida', quit: 'Salir', upd: v => `Kuadro ${v} está lista`, updb: 'Se instalará al cerrar Kuadro.', imgs: 'Imágenes', taken: 'Ese atajo ya lo usa otro programa; elige otra combinación.', bad: 'Ese atajo no es válido.' } };
const L = () => M[(typeof prefs !== 'undefined' && prefs.lang) === 'es' ? 'es' : 'en'];
let ICON = ''; try { ICON = fs.readFileSync(path.join(__dirname, 'dist', 'icon.png')).toString('base64'); } catch { }
// Se conserva la carpeta de datos del nombre anterior (sesión de Google y proyectos guardados).
app.setPath('userData', path.join(app.getPath('appData'), 'HojaBase'));

async function tokenReq(params) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error_description || d.error || 'Google rechazó la solicitud'); return d;
}
async function login(creds) {
  const c = load(); if (creds) { c.clientId = creds.clientId; c.secret = enc(creds.clientSecret); }
  if (!c.clientId || !c.secret) throw new Error('Faltan el ID de cliente y el secreto.');
  const verifier = crypto.randomBytes(48).toString('base64url'), challenge = crypto.createHash('sha256').update(verifier).digest('base64url'), state = crypto.randomBytes(12).toString('hex');
  const code = await new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1'); if (u.pathname !== '/') { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      const ok = u.searchParams.get('code') && u.searchParams.get('state') === state;
      res.end(`<body style="font-family:sans-serif;background:#191919;color:#eee;text-align:center;padding-top:80px"><img src="data:image/png;base64,${ICON}" width="96"><h2>${ok ? L().ready : L().fail}</h2></body>`);
      clearTimeout(timer); srv.close(); ok ? resolve({ code: u.searchParams.get('code'), port: srv.address()?.port || port }) : reject(new Error(u.searchParams.get('error') || 'Inicio de sesión cancelado.'));
    });
    let port; const timer = setTimeout(() => { srv.close(); reject(new Error('Se agotó el tiempo de espera del inicio de sesión.')); }, 5 * 60000);
    srv.listen(0, '127.0.0.1', () => {
      port = srv.address().port;
      const q = new URLSearchParams({ client_id: c.clientId, redirect_uri: `http://127.0.0.1:${port}`, response_type: 'code', scope: SCOPES.join(' '), code_challenge: challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent', state });
      shell.openExternal('https://accounts.google.com/o/oauth2/v2/auth?' + q);
    });
  });
  const t = await tokenReq({ code: code.code, client_id: c.clientId, client_secret: dec(c.secret), redirect_uri: `http://127.0.0.1:${code.port}`, grant_type: 'authorization_code', code_verifier: verifier });
  if (!t.refresh_token) throw new Error('Google no entregó permiso permanente. Vuelve a intentarlo.');
  access = { token: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000 };
  const info = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
  c.refresh = enc(t.refresh_token); c.user = { email: info.email, name: info.name || info.email }; save(c); if (win) { win.show(); win.focus(); }
  return c.user;
}
async function token(force) {
  if (!force && access && access.exp > Date.now()) return access.token;
  const c = load(); if (!c.refresh) throw new Error('Sesión no iniciada.');
  try { const t = await tokenReq({ client_id: c.clientId, client_secret: dec(c.secret), refresh_token: dec(c.refresh), grant_type: 'refresh_token' }); access = { token: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000 }; return access.token; }
  catch (e) { throw new Error('La sesión de Google caducó; cierra sesión y vuelve a entrar. (' + e.message + ')'); }
}
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
ipcMain.handle('auth:status', () => { const c = load(); return c.refresh && c.user ? c.user : null; });
ipcMain.handle('auth:creds', () => { const c = load(); return { clientId: c.clientId || '', has: !!c.secret }; });
ipcMain.handle('auth:login', (_e, creds) => login(creds));
ipcMain.handle('auth:logout', () => { const c = load(); delete c.refresh; delete c.user; save(c); access = null; });
ipcMain.handle('auth:token', (_e, force) => token(force));
ipcMain.handle('net:json', async (_e, url) => { const h = new URL(url).hostname; if (!['www.youtube.com', 'www.googleapis.com'].includes(h)) throw new Error('Host no permitido'); const r = await fetch(url); if (!r.ok) { let msg = 'HTTP ' + r.status; try { const d = await r.json(); if (d.error && d.error.message) msg += ': ' + d.error.message; } catch { } throw new Error(msg); } return r.json(); });
// Las llamadas a Google salen desde aquí, no desde la ventana, para no depender de CORS.
ipcMain.handle('net:fetch', async (_e, url, o) => {
  if (!['sheets.googleapis.com', 'www.googleapis.com'].includes(new URL(url).hostname)) throw new Error('Host no permitido');
  const r = await fetch(url, { method: o.method, headers: o.headers, body: o.body });
  return { ok: r.ok, status: r.status, statusText: r.statusText, text: await r.text() };
});
ipcMain.handle('file:pickImage', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: L().imgs, extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] }); if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0]; return { name: path.basename(p), mime: MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', bytes: fs.readFileSync(p) };
});
ipcMain.handle('notify', (_e, title, body) => { if (Notification.isSupported()) new Notification({ title, body }).show(); });
ipcMain.handle('clipboard', (_e, text) => clipboard.writeText(String(text ?? '')));
ipcMain.handle('open', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });

// ---------- Preferencias de la computadora (atajo, bandeja, inicio automático) ----------
const prefsFile = () => path.join(app.getPath('userData'), 'preferencias.json');
const PREFS0 = { shortcut: 'CommandOrControl+Shift+Space', tray: true, autostart: false, lang: 'en' };
let prefs = { ...PREFS0 }; try { prefs = { ...PREFS0, ...JSON.parse(fs.readFileSync(prefsFile(), 'utf8')) }; } catch { }
const savePrefs = () => fs.writeFileSync(prefsFile(), JSON.stringify(prefs));
let tray = null, capWin = null, capCtx = { tabs: [], def: '', project: '' }, quitting = false;
function registerShortcut() {
  globalShortcut.unregisterAll(); if (!prefs.shortcut) return null;
  try { return globalShortcut.register(prefs.shortcut, openCapture) ? null : L().taken; } catch { return L().bad; }
}
function openCapture() {
  if (!capWin || capWin.isDestroyed()) {
    capWin = new BrowserWindow({ width: 560, height: 210, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: '#1f1f1f', webPreferences: { preload: path.join(__dirname, 'capture-preload.cjs'), contextIsolation: true } });
    capWin.loadFile(path.join(__dirname, 'dist', 'capture.html')); capWin.on('blur', () => capWin && !capWin.isDestroyed() && capWin.hide());
    capWin.webContents.once('did-finish-load', () => showCapture());
  } else showCapture();
}
function showCapture() {
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea; capWin.setPosition(Math.round(d.x + (d.width - 560) / 2), Math.round(d.y + d.height * 0.22));
  capWin.webContents.send('capture:show', capCtx); capWin.show(); capWin.focus();
}
ipcMain.on('capture:context', (_e, c) => { capCtx = c || capCtx; });
ipcMain.on('capture:close', () => capWin && !capWin.isDestroyed() && capWin.hide());
ipcMain.on('capture:submit', (_e, c) => { if (win && !win.isDestroyed()) win.webContents.send('capture:add', c); });
ipcMain.handle('prefs:get', () => prefs);
ipcMain.handle('prefs:set', (_e, patch) => {
  const old = { ...prefs }; prefs = { ...prefs, ...patch }; let error = null;
  if ('shortcut' in patch) { error = registerShortcut(); if (error) { prefs.shortcut = old.shortcut; registerShortcut(); } }
  if ('tray' in patch || 'lang' in patch) { if (tray) { tray.destroy(); tray = null; } setupTray(); }
  if ('autostart' in patch) app.setLoginItemSettings({ openAtLogin: !!prefs.autostart, openAsHidden: true, args: ['--oculto'] });
  savePrefs(); return { prefs, error };
});
function setupTray() {
  if (!prefs.tray) { if (tray) { tray.destroy(); tray = null; } return; }
  if (tray) return;
  const img = nativeImage.createFromPath(path.join(__dirname, 'dist', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(img); tray.setToolTip('Kuadro');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: L().open, click: showMain }, { label: L().cap, click: openCapture }, { type: 'separator' }, { label: L().quit, click: () => { quitting = true; app.quit(); } }]));
  tray.on('click', showMain);
}
function showMain() { if (!win || win.isDestroyed()) create(); else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } }

// ---------- Actualizaciones (desde GitHub Releases) ----------
// Windows: se descarga sola y se instala al cerrar o con "Reiniciar y actualizar".
// macOS: la app no está firmada, así que solo se avisa y se abre la página de descarga.
const RELEASES = 'https://github.com/m00t01/kuadro/releases/latest';
let upd = { state: 'idle', current: app.getVersion() }, updater = null;
const setUpd = p => { upd = { ...upd, ...p }; if (win && !win.isDestroyed()) win.webContents.send('update:state', upd); };
function setupUpdates() {
  if (!app.isPackaged) { setUpd({ state: 'dev' }); return; }
  try {
    const { autoUpdater } = require('electron-updater'); updater = autoUpdater;
    autoUpdater.autoDownload = process.platform === 'win32'; autoUpdater.autoInstallOnAppQuit = process.platform === 'win32';
    autoUpdater.on('checking-for-update', () => setUpd({ state: 'checking', error: '' }));
    autoUpdater.on('update-not-available', () => setUpd({ state: 'none', checkedAt: Date.now() }));
    autoUpdater.on('update-available', i => setUpd({ state: process.platform === 'win32' ? 'downloading' : 'available', version: i.version, percent: 0, checkedAt: Date.now() }));
    autoUpdater.on('download-progress', pr => setUpd({ state: 'downloading', percent: Math.round(pr.percent || 0) }));
    autoUpdater.on('update-downloaded', i => { setUpd({ state: 'ready', version: i.version }); if (Notification.isSupported()) new Notification({ title: L().upd(i.version), body: L().updb }).show(); });
    autoUpdater.on('error', e => setUpd({ state: 'error', error: String((e && e.message) || e).split('\n')[0].slice(0, 200), checkedAt: Date.now() }));
    const check = () => { if (upd.state !== 'downloading' && upd.state !== 'ready') autoUpdater.checkForUpdates().catch(() => { }); };
    check(); setInterval(check, 6 * 3600 * 1000);
  } catch (e) { setUpd({ state: 'error', error: String(e.message || e) }); }
}
ipcMain.handle('update:get', () => upd);
ipcMain.handle('update:check', async () => {
  if (!updater) return upd;
  if (upd.state === 'downloading' || upd.state === 'ready') return upd;
  setUpd({ state: 'checking', error: '' });
  try { await updater.checkForUpdates(); } catch (e) { setUpd({ state: 'error', error: String(e.message || e).split('\n')[0].slice(0, 200), checkedAt: Date.now() }); }
  return upd;
});
ipcMain.handle('update:install', () => {
  if (upd.state === 'ready' && updater) { quitting = true; setImmediate(() => updater.quitAndInstall(false, true)); return true; }
  shell.openExternal(RELEASES); return false;
});

function create() {
  win = new BrowserWindow({ width: 1440, height: 900, minWidth: 980, minHeight: 620, backgroundColor: '#191919', title: 'Kuadro', icon: path.join(__dirname, 'dist', 'icon.png'), autoHideMenuBar: true, show: !process.argv.includes('--oculto'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, spellcheck: true } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); } });
  // Con la bandeja activa, cerrar solo oculta la ventana: el atajo de captura sigue funcionando.
  win.on('close', e => { if (prefs.tray && !quitting) { e.preventDefault(); win.hide(); } });
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showMain);
  app.on('before-quit', () => { quitting = true; });
  app.whenReady().then(() => { if (process.platform !== 'darwin') Menu.setApplicationMenu(null); app.setAppUserModelId('com.marcostoscano.hojabase'); create(); setupTray(); registerShortcut(); setupUpdates(); app.on('activate', showMain); });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !prefs.tray) app.quit(); });
}
