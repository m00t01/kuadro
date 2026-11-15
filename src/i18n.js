// Idioma de la interfaz: inglés por defecto, español opcional (cada persona elige; se guarda en esta computadora).
// Las cadenas del código están en español y sirven de clave; EN tiene su traducción al inglés.
import EN from './en.json' with { type: 'json' };
const read = () => { try { if (globalThis.KUADRO_LANG) return globalThis.KUADRO_LANG; return localStorage.getItem('kuadro-lang') || ''; } catch { return ''; } };
export const LANG = read() === 'es' ? 'es' : 'en';
export const LOCALE = LANG === 'es' ? 'es' : 'en';
export function t(s, vars) {
  let out = LANG === 'es' ? s : (EN[s] ?? s);
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
}
export function setLang(l) { try { localStorage.setItem('kuadro-lang', l); } catch { } if (typeof location !== 'undefined') location.reload(); }
