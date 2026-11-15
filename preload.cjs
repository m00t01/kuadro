const { contextBridge, ipcRenderer } = require('electron');
const call = ch => (...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('native', {
  status: call('auth:status'), creds: call('auth:creds'), login: call('auth:login'), logout: call('auth:logout'), token: call('auth:token'),
  json: call('net:json'), fetch: call('net:fetch'), pickImage: call('file:pickImage'), notify: call('notify'), open: call('open'), copy: call('clipboard'),
  prefs: call('prefs:get'), setPrefs: call('prefs:set'), captureContext: c => ipcRenderer.send('capture:context', c),
  onCapture: cb => { const h = (_e, c) => cb(c); ipcRenderer.on('capture:add', h); return () => ipcRenderer.removeListener('capture:add', h); },
});
