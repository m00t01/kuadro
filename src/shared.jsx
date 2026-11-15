import { t as tr, LOCALE } from './i18n.js';
// Utilidades compartidas por las vistas.
export const native = typeof window !== 'undefined' ? window.native : null;
export const LS = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };
export const ICON = { text: tr('Aa'), number: '#', select: '◉', multi: '☰', date: '▦', checkbox: '☑', url: '↗', person: '☺', image: '▣', auto: '№' };
export const DONE = /publicad|descartad|finalizad|hecho|complet|cancel/i;
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const when = x => { const d = new Date(x); return isNaN(d) ? String(x || '') : d.toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
export const ago = x => { const s = (Date.now() - Date.parse(x)) / 1000; if (isNaN(s)) return ''; if (s < 60) return tr('hace un momento'); if (s < 3600) return tr('hace {n} min', { n: Math.round(s / 60) }); if (s < 86400) return tr('hace {n} h', { n: Math.round(s / 3600) }); if (s < 86400 * 7) return tr('hace {n} d', { n: Math.round(s / 86400) }); return when(x); };
export const who = (st, email) => (st.S.config.users.find(u => u.email === email) || {}).name || email;
const AV = ['#e5484d', '#f76b15', '#ffc53d', '#30a46c', '#12a594', '#0090ff', '#6e56cf', '#d6409f', '#8e4ec6', '#3e63dd'];
export const avColor = name => AV[[...String(name || '?')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AV.length];
export const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export const Avatar = ({ name, size = 22, title }) => <span class="av" title={title || name} style={{ background: avColor(name), width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.42) + 'px' }}>{initials(name)}</span>;
export const copyText = async (t, st) => { try { if (native) await native.copy(t); else await navigator.clipboard.writeText(t); st && st.toast(tr('Copiado')); } catch { st && st.toast(tr('No se pudo copiar'), 'error'); } };
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
