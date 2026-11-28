import { t as tr, LOCALE } from './i18n.js';
// Utilidades compartidas por las vistas.
export const native = typeof window !== 'undefined' ? window.native : null;
export const LS = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };
export const IP = {
  text: 'M4 7V4h16v3M9 20h6M12 4v16', hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18', select: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 10.5l4 4 4-4',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01', cal: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 2v4M8 2v4M3 10h18',
  sqcheck: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM21 15l-5-5L5 21',
  ordered: 'M10 6h11M10 12h11M10 18h11M4 4h1v5M4 9h2M6 20H4c0-1.5 2-2 2-3.5S4.5 15 4 15.5', inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', plus: 'M12 5v14M5 12h14', check: 'M20 6 9 17l-5-5',
  pin: 'M12 17v5M8 3h8l-1 6 3 4v2H6v-2l3-4z', folder: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6', expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7', x: 'M18 6 6 18M6 6l12 12',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  smile: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01', cover: 'M3 5h18v14H3zM3 12h18', alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  sort: 'M3 6h18M6 12h12M10 18h4', filter: 'M3 5h18l-7 8.5V19l-4 2v-7.5L3 5z', chevd: 'm6 9 6 6 6-6',
};
export const Ic = ({ n, s = 15, w = 1.9, cls }) => <svg class={'ic' + (cls ? ' ' + cls : '')} viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" stroke-width={w} stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d={IP[n]} /></svg>;
export const Empty = ({ ic, title, text, children }) => <div class="empty"><span class="em-ic"><Ic n={ic} s={20} w={1.7} /></span>{title && <b>{title}</b>}{text && <p>{text}</p>}{children}</div>;
export const ICON = { text: <Ic n="text" s={14} />, number: <Ic n="hash" s={14} />, select: <Ic n="select" s={14} />, multi: <Ic n="list" s={14} />, date: <Ic n="cal" s={14} />, checkbox: <Ic n="sqcheck" s={14} />, url: <Ic n="link" s={14} />, person: <Ic n="user" s={14} />, image: <Ic n="image" s={14} />, auto: <Ic n="ordered" s={14} /> };
export const DONE = /publicad|published|subid|uploaded|descartad|discard|finalizad|finished|hecho|done|complet|cancel/i;
// Avisos de fechas (preferencia personal en esta computadora).
export const alertPrefs = () => { try { return { on: true, days: 2, scope: 'mine', ...JSON.parse(localStorage.getItem('kuadro-alerts') || '{}') }; } catch { return { on: true, days: 2, scope: 'mine' }; } };
export const setAlertPrefs = p => { try { localStorage.setItem('kuadro-alerts', JSON.stringify({ ...alertPrefs(), ...p })); } catch { } };
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// Estado de la fecha de un elemento: atrasado (late), pronto (soon) o nada. Lo terminado no cuenta.
export function dueOf(st, r, days = alertPrefs().days) {
  const s = st.S.config.settings, d = String(r.v[s.dateCol] || '').slice(0, 10); if (!s.dateCol || !/^\d{4}-\d{2}-\d{2}$/.test(d) || DONE.test(String(r.v[s.groupCol] || ''))) return null;
  const n = Math.round((new Date(d + 'T12:00:00') - new Date(todayStr() + 'T12:00:00')) / 86400000);
  return n < 0 ? { late: true, n: -n } : n <= days ? { soon: true, n } : null;
}
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const when = x => { const d = new Date(x); return isNaN(d) ? String(x || '') : d.toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
export const ago = x => { const s = (Date.now() - Date.parse(x)) / 1000; if (isNaN(s)) return ''; if (s < 60) return tr('hace un momento'); if (s < 3600) return tr('hace {n} min', { n: Math.round(s / 60) }); if (s < 86400) return tr('hace {n} h', { n: Math.round(s / 3600) }); if (s < 86400 * 7) return tr('hace {n} d', { n: Math.round(s / 86400) }); return when(x); };
export const who = (st, email) => (st.S.config.users.find(u => u.email === email) || {}).name || email;
const AV = ['#e5484d', '#f76b15', '#ffc53d', '#30a46c', '#12a594', '#0090ff', '#6e56cf', '#d6409f', '#8e4ec6', '#3e63dd'];
export const avColor = name => AV[[...String(name || '?')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AV.length];
export const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export const Avatar = ({ name, size = 22, title }) => <span class="av" title={title || name} style={{ background: avColor(name), width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.42) + 'px' }}>{initials(name)}</span>;
export const copyText = async (t, st, msg) => { try { if (native) await native.copy(t); else await navigator.clipboard.writeText(t); st && st.toast(msg || tr('Copiado')); } catch { st && st.toast(tr('No se pudo copiar'), 'error'); } };
// Convierte texto pegado al tipo de la columna.
const MES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12 };
export function parseFor(type, txt) {
  txt = String(txt ?? '').trim();
  if (type === 'checkbox') return /^(true|verdadero|s[ií]|1|x|✓|✔)$/i.test(txt);
  if (type === 'date') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;
    let m = txt.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    m = txt.match(/^(\d{1,2})\s+([a-zé]+)\.?\s+(\d{4})$/i); if (m && MES[m[2].toLowerCase().slice(0, 4)] || m && MES[m[2].toLowerCase().slice(0, 3)]) return `${m[3]}-${String(MES[m[2].toLowerCase().slice(0, 4)] || MES[m[2].toLowerCase().slice(0, 3)]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return txt;
  }
  if (type === 'number') { const n = Number(txt.replace(/[^\d.,-]/g, '').replace(',', '.')); return txt === '' || isNaN(n) ? txt : String(n); }
  return txt;
}

// Preferencia personal: un clic en el título abre su página (activado por defecto).
export const clickOpensPage = () => { try { return localStorage.getItem('kuadro-clickopen') !== '0'; } catch { return true; } };
export const setClickOpensPage = on => { try { localStorage.setItem('kuadro-clickopen', on ? '1' : '0'); } catch { } };
