// Screenshots of the home screen: browser demo, signed out (native), signed in with projects, signed in empty.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const wait = ms => new Promise(r => setTimeout(r, ms)); const errs = [];
async function shot(name, { nat, user, projects, theme = 'dark', lang = 'en', w = 1400 }) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: 820 }); p.on('pageerror', e => errs.push(name + ': ' + e.message));
  if (nat) await p.evaluateOnNewDocument(u => { window.native = { status: async () => u, creds: async () => ({ has: !!u, clientId: '' }), logout: async () => {}, prefs: async () => ({}), setPrefs: () => {} }; }, user || null);
  await p.goto('file:///home/claude/kuadro/dist/index.html');
  await p.evaluate((theme, lang, projects) => { localStorage.clear(); localStorage.setItem('kuadro-lang', lang); localStorage.setItem('appearance', JSON.stringify({ theme })); if (projects) localStorage.setItem('projects', JSON.stringify(projects)); }, theme, lang, projects);
  await p.reload(); await wait(700); await p.screenshot({ path: `/tmp/audit/home-${name}.png` }); await p.close();
}
const ago = h => new Date(Date.now() - h * 3600e3).toISOString();
const projects = [{ id: 'a', sheetId: 'x1', name: 'Main channel 2026', opened: ago(2) }, { id: 'b', sheetId: 'x2', name: 'Shorts pipeline', opened: ago(50) }, { id: 'c', sheetId: 'x3', name: 'Sponsors' }];
const user = { name: 'Alex Rivera', email: 'alex@example.com' };
await shot('browser', {});
await shot('signedout', { nat: true });
await shot('projects', { nat: true, user, projects });
await shot('empty', { nat: true, user, projects: [] });
await shot('projects-light', { nat: true, user, projects, theme: 'light' });
await shot('projects-es', { nat: true, user, projects, lang: 'es' });
await shot('projects-narrow', { nat: true, user, projects, w: 760 });
console.log('errors:', errs); await b.close();
