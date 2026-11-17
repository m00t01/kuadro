import { t as tr, LOCALE } from './i18n.js';
// Utilidades compartidas por las vistas.
export const native = typeof window !== 'undefined' ? window.native : null;
export const LS = { get: (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };
export const ICON = { text: tr('Aa'), number: '#', select: '◉', multi: '☰', date: '▦', checkbox: '☑', url: '↗', person: '☺', image: '▣', auto: '№' };
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
