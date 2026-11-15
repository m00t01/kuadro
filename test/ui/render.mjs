import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const svg = fs.readFileSync('/home/claude/app/build/icon.svg', 'utf8');
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
for (const s of [1024, 256]) { await p.setViewport({ width: s, height: s }); await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`); await p.screenshot({ path: `/home/claude/app/build/icon-${s}.png`, omitBackground: true }); }
await p.setViewport({ width: 900, height: 300 });
await p.setContent(`<html><body style="margin:0;display:flex;gap:40px;align-items:center;justify-content:center;height:300px;background:linear-gradient(90deg,#f3f3f3 50%,#191919 50%)">${[200,96,48,24].map(s=>svg.replace('<svg ',`<svg width="${s}" height="${s}" `)).join('')}<div style="width:30px"></div>${[96,32].map(s=>svg.replace('<svg ',`<svg width="${s}" height="${s}" `)).join('')}</body></html>`);
await p.screenshot({ path: '/tmp/shots/icon-preview.png' }); await b.close();
