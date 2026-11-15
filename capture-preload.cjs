const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('capture', {
  submit: c => ipcRenderer.send('capture:submit', c), close: () => ipcRenderer.send('capture:close'),
  onShow: cb => { const h = (_e, c) => cb(c); ipcRenderer.on('capture:show', h); return () => ipcRenderer.removeListener('capture:show', h); },
});
