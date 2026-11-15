const { app, BrowserWindow } = require('electron');
require('../../main.cjs');
app.whenReady().then(() => setTimeout(async () => {
  const w = BrowserWindow.getAllWindows()[0];
  const r = await w.webContents.executeJavaScript(`(async()=>({native: Object.keys(window.native||{}), status: await window.native.status(), creds: await window.native.creds(), text: document.body.innerText.slice(0,200)}))()`);
  console.log(JSON.stringify(r)); require('fs').writeFileSync('/tmp/shots/electron.png', (await w.webContents.capturePage()).toPNG()); app.quit();
}, 4000));
