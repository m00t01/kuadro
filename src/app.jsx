import { render } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { createStore, TYPES, PERMS } from './store.js';
import { MockSheets } from './mock.js';
import { GoogleSheets } from './gapi.js';
import { af, useStore, Chip, Pop, Modal, Field, ColumnEditor, RichEditor, splitMulti, optionsOf, colorOf } from './ui.jsx';
import { urls, ytId, imgSrc, fmtDate, norm, newId, isISO } from './util.js';
import { alertPrefs, setAlertPrefs, native, LS, ICON, DONE, iso, Avatar, copyText } from './shared.jsx';
import { TableView, BulkBar } from './table.jsx';
import { KanbanView, GalleryView, CalendarView, defaultCardProps } from './views.jsx';
import { RowPage, HistList } from './page.jsx';
import { AutomationList } from './auto.jsx';
import { Inbox, inboxItems } from './inbox.jsx';
import demoEn from './demo-en.json';
import demoEs from './demo-es.json';
import { t as tr, LOCALE, LANG, setLang } from './i18n.js';

// Apariencia por persona (se guarda en esta computadora).
const BG_PRESETS = [[tr('Grafito'), '#191919'], [tr('Medianoche'), '#0f1420'], [tr('Océano'), '#0c1d2b'], [tr('Bosque'), '#102019'], [tr('Morado'), '#1a1430'], [tr('Vino'), '#24121a'], [tr('Café'), '#221a14'], [tr('Pizarra'), '#1e2329']];
const APPEAR0 = { theme: 'dark', color: '#191919', image: '', dim: 45, blur: 0 };
const LIGHT_BG = '#f7f6f3';
export const isLight = a => a.theme === 'light' || (a.theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches);
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(Math.min(255, Math.max(0, v + (f > 0 ? (255 - v) * f : v * f))))); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); };
function appearStyle(a) {
  if (isLight(a) && !a.image) return { '--bg': LIGHT_BG, '--side': '#efeeeb', '--head': LIGHT_BG, '--panel': '#ffffff', '--app-img': 'none', '--app-dim': '0', '--app-blur': '0px', '--app-color': LIGHT_BG };
  const img = !!a.image, side = shade(a.color, 0.04);
  return { '--bg': img ? 'rgba(18,18,18,.55)' : a.color, '--side': img ? 'rgba(20,20,20,.72)' : side, '--head': img ? 'rgba(22,22,22,.9)' : a.color, '--panel': img ? 'rgba(37,37,37,.92)' : shade(a.color, 0.06),
    '--app-img': img ? `url("${a.image}")` : 'none', '--app-dim': String((a.dim ?? 45) / 100), '--app-blur': (a.blur || 0) + 'px', '--app-color': a.color };
}
// Reduce la imagen elegida a 1920 px en JPEG para que quepa en el almacenamiento local.
const shrinkImage = file => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => { const k = Math.min(1, 1920 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.82)); }; im.src = fr.result; }; fr.readAsDataURL(file); });
function Appearance({ value, onChange }) {
  const a = { ...APPEAR0, ...value }, set = p => onChange({ ...a, ...p }), [err, setErr] = useState('');
  return <div>
    <LangPicker />
    <div class="f">{tr("Tema")}<div class="seg sm-seg">{[['dark', tr('Oscuro')], ['light', tr('Claro')], ['system', tr('Igual que el sistema')]].map(([k, l]) => <button class={a.theme === k ? 'on' : ''} onClick={() => set({ theme: k })}>{l}</button>)}</div></div>
    {isLight(a) && !a.image ? <p class="hint">{tr("En tema claro el color de fondo no aplica; elige una imagen si quieres personalizarlo.")}</p> : null}
    <div class="f">{tr("Color de fondo (tema oscuro)")}<div class="swatches">{BG_PRESETS.map(([n, c]) => <button title={n} class={'sw' + (a.color === c && !a.image ? ' on' : '')} style={{ background: c }} onClick={() => set({ color: c, image: '' })} />)}
      <label class="sw custom" title={tr("Color personalizado")}><input type="color" value={a.color} onInput={e => set({ color: e.target.value, image: '' })} />+</label></div></div>
    <div class="f">{tr("Imagen de fondo")}<div class="lrow"><label class="btn">{tr("Elegir imagen…")}<input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { setErr(''); set({ image: await shrinkImage(f) }); } catch { setErr(tr('No se pudo leer esa imagen.')); } }} /></label>
      {a.image && <button class="btn" onClick={() => set({ image: '' })}>{tr("Quitar imagen")}</button>}{a.image && <img class="bgthumb" src={a.image} />}</div>{err && <p class="hint">{err}</p>}</div>
    {a.image && <label class="f">{tr('Oscurecer la imagen:')} {a.dim}%<input type="range" min="0" max="90" value={a.dim} onInput={e => set({ dim: +e.target.value })} /></label>}
    {a.image && <label class="f">{tr('Desenfoque:')} {a.blur}px<input type="range" min="0" max="24" value={a.blur} onInput={e => set({ blur: +e.target.value })} /></label>}
    <button class="btn" onClick={() => onChange({ ...APPEAR0 })}>{tr("Restablecer")}</button>
    <p class="hint">{tr("La apariencia es personal: solo cambia en esta computadora, no para tu equipo.")}</p>
    {native && native.prefs && <Shortcuts />}
    <DateAlerts />
    {native && native.updateState && <Updates />}
  </div>;
}
// Idioma de la interfaz (cada persona elige; se guarda en esta computadora).
function LangPicker({ compact }) {
  const pick = l => { if (l === LANG) return; if (native && native.setPrefs) native.setPrefs({ lang: l }); setLang(l); };
  const seg = <div class="seg sm-seg"><button class={LANG === 'en' ? 'on' : ''} onClick={() => pick('en')}>English</button><button class={LANG === 'es' ? 'on' : ''} onClick={() => pick('es')}>Español</button></div>;
  return compact ? seg : <div class="f">Language · Idioma{seg}</div>;
}
// Atajo global de captura rápida y comportamiento al cerrar (preferencias de la computadora, en el proceso principal).
const toAccel = e => { const k = e.key; if (['Control', 'Shift', 'Alt', 'Meta'].includes(k)) return null; const mods = [(e.ctrlKey || e.metaKey) && 'CommandOrControl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean); if (!mods.length) return null; const key = k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k; return [...mods, key].join('+'); };
const prettyAccel = a => (a || '').replace('CommandOrControl', navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl').replace(/\+/g, ' + ');
function Shortcuts() {
  const [p, setP] = useState(null), [rec, setRec] = useState(false), [msg, setMsg] = useState('');
  useEffect(() => { native.prefs().then(setP); }, []);
  if (!p) return null;
  const save = async patch => { const r = await native.setPrefs(patch); setP(r.prefs); setMsg(r.error || tr('Guardado.')); };
  return <div class="f" style={{ marginTop: '18px' }}><b class="tx">{tr("Captura rápida de ideas")}</b>
    <p class="hint">{tr("Desde cualquier programa, aunque Kuadro esté minimizado o en la bandeja, el atajo abre una mini ventana para anotar una idea; se guarda como Pendiente en el proyecto abierto.")}</p>
    <div class="lrow0"><span class="kbd big">{rec ? tr('Presiona la combinación…') : prettyAccel(p.shortcut) || tr('(sin atajo)')}</span>
      <button class={'btn' + (rec ? ' on' : '')} onClick={() => setRec(true)} onKeyDown={e => { if (!rec) return; e.preventDefault(); e.stopPropagation(); if (e.key === 'Escape') { setRec(false); return; } const a = toAccel(e); if (a) { setRec(false); save({ shortcut: a }); } }} onBlur={() => setRec(false)}>{rec ? tr('Escuchando… (Esc cancela)') : tr('Cambiar atajo')}</button>
      <button class="btn" onClick={() => save({ shortcut: '' })}>{tr("Desactivar")}</button></div>
    <label class="chk"><input type="checkbox" checked={p.tray} onChange={e => save({ tray: e.target.checked })} />{tr("Al cerrar la ventana, mantener Kuadro en la bandeja (para que el atajo siga funcionando)")}</label>
    <label class="chk"><input type="checkbox" checked={p.autostart} onChange={e => save({ autostart: e.target.checked })} />{tr("Abrir Kuadro al iniciar la computadora (minimizado)")}</label>
    {msg && <p class="hint">{msg}</p>}</div>;
}
// Actualizaciones: estado en vivo desde el proceso principal, botón "Buscar actualizaciones" y aviso cuando hay una lista.
function useUpdate() {
  const [u, setU] = useState(null);
  useEffect(() => { if (!native || !native.updateState) return; native.updateState().then(setU); return native.onUpdate(setU); }, []);
  return u;
}
const isMac = typeof navigator !== 'undefined' && navigator.platform.startsWith('Mac');
function updText(u) {
  if (!u) return '';
  switch (u.state) {
    case 'checking': return tr('Buscando actualizaciones…');
    case 'none': return tr('Tienes la versión más reciente.');
    case 'available': return tr('Hay una versión nueva: {v}.', { v: u.version });
    case 'downloading': return tr('Descargando la versión {v}… {p}%', { v: u.version, p: u.percent || 0 });
    case 'ready': return tr('La versión {v} está lista para instalarse.', { v: u.version });
    case 'error': return tr('No se pudo buscar actualizaciones. Revisa tu conexión e inténtalo de nuevo.');
    case 'dev': return tr('Las actualizaciones solo funcionan en la app instalada.');
    default: return '';
  }
}
function Updates() {
  const u = useUpdate(), [busy, setBusy] = useState(false);
  if (!u) return null;
  const check = async () => { setBusy(true); try { await native.checkUpdates(); } finally { setBusy(false); } };
  const checking = busy || u.state === 'checking';
  return <div class="f" style={{ marginTop: '18px' }}><b class="tx">{tr("Actualizaciones")}</b>
    <p class="hint">{tr("Versión instalada:")} {u.current}. {isMac ? tr("Kuadro revisa si hay versiones nuevas al abrirse y cada 6 horas.") : tr("Kuadro revisa si hay versiones nuevas al abrirse y cada 6 horas, las descarga sola y las instala al cerrarse.")}</p>
    <div class="lrow0">
      {u.state === 'ready' ? <button class="btn primary" onClick={() => native.installUpdate()}>{tr("Reiniciar y actualizar")}</button>
        : u.state === 'available' ? <button class="btn primary" onClick={() => native.installUpdate()}>{tr("Descargar la versión {v}", { v: u.version })}</button>
        : <button class="btn" disabled={checking || u.state === 'downloading' || u.state === 'dev'} onClick={check}>{checking ? tr('Buscando…') : tr('Buscar actualizaciones')}</button>}
      <span class="hint" style={{ margin: 0 }}>{updText(u)}</span></div>
    {u.state === 'error' && u.error && <p class="hint">{u.error}</p>}</div>;
}
// Barra fija cuando una actualización ya está descargada (o, en Mac, disponible).
function UpdateBanner() {
  const u = useUpdate(), [hide, setHide] = useState('');
  if (!u || !(u.state === 'ready' || u.state === 'available') || hide === u.version) return null;
  return <div class="upd-banner"><span>{u.state === 'ready' ? tr('Kuadro {v} está lista.', { v: u.version }) : tr('Hay una versión nueva de Kuadro: {v}.', { v: u.version })}</span>
    <button class="btn primary" onClick={() => native.installUpdate()}>{u.state === 'ready' ? tr('Reiniciar y actualizar') : tr('Descargar')}</button>
    <button class="icon" title={tr("Más tarde")} onClick={() => setHide(u.version)}>✕</button></div>;
}
// Versión y botón compacto para la pantalla de inicio.
function HomeVersion() {
  const u = useUpdate();
  if (!u) return null;
  return <div class="home-ver">Kuadro {u.current} · {u.state === 'ready' || u.state === 'available' ? <a href="#" onClick={e => { e.preventDefault(); native.installUpdate(); }}>{u.state === 'ready' ? tr('Reiniciar y actualizar a {v}', { v: u.version }) : tr('Descargar la versión {v}', { v: u.version })}</a>
    : u.state === 'checking' || u.state === 'downloading' ? <span>{updText(u)}</span>
    : <a href="#" onClick={e => { e.preventDefault(); if (u.state !== 'dev') native.checkUpdates(); }}>{tr('Buscar actualizaciones')}</a>}
    {(u.state === 'none' || u.state === 'error' || u.state === 'dev') && <span> · {updText(u)}</span>}</div>;
}
// Campo en línea para nombrar o renombrar una pestaña (Enter guarda, Esc cancela).
function TabNameInput({ initial = '', placeholder, onSave, onCancel }) {
  const [v, setV] = useState(initial), ref = useRef(), busy = useRef(false), born = useRef(Date.now());
  useEffect(() => { const go = () => { const el = ref.current; if (el) { el.focus(); el.select(); } }; go(); const t = setTimeout(go, 60); return () => clearTimeout(t); }, []);
  const save = async () => { if (busy.current) return; busy.current = true; const ok = await onSave(v); busy.current = false; if (ok === false && ref.current) ref.current.focus(); };
  return <input class="nav-in" ref={ref} value={v} placeholder={placeholder} maxLength={90} onInput={e => setV(e.target.value)}
    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); if (v.trim()) save(); else onCancel(); } if (e.key === 'Escape') onCancel(); }}
    onBlur={() => { if (busy.current) return; if (Date.now() - born.current < 400) { setTimeout(() => ref.current && ref.current.focus(), 0); return; } if (v.trim() && v.trim() !== initial) save(); else onCancel(); }} />;
}
// Historial del proyecto, con filtro para encontrar rápido lo que se borró.
function HistSection({ st }) {
  const [only, setOnly] = useState(false), S = st.S;
  const all = [...S.history].filter(h => h.kind !== 'notify').reverse();
  const list = (only ? all.filter(h => h.kind === 'delete' || h.kind === 'tabdel') : all).slice(0, 300);
  return <div><p class="hint">{tr("Si borraste algo por accidente, búscalo aquí y toca «Restaurar». Cada cambio también se puede deshacer.")}</p>
    <div class="seg sm-seg" style={{ marginBottom: '10px' }}><button class={!only ? 'on' : ''} onClick={() => setOnly(false)}>{tr("Todo")}</button><button class={only ? 'on' : ''} onClick={() => setOnly(true)}>{tr("Solo lo eliminado")}</button></div>
    <HistList st={st} list={list} /></div>;
}
// Formulario para crear una carpeta (y meter en ella las filas elegidas).
function FolderForm({ st, ask, onDone }) {
  const [v, setV] = useState(ask.name || ''), ref = useRef(), err = v.trim() ? st.folderNameError(ask.tab, v.trim()) : '';
  useEffect(() => { ref.current && ref.current.focus(); }, []);
  const go = () => { if (!v.trim() || err) return; st.addFolder(ask.tab, v.trim(), ask.ids || []); onDone(); };
  return <div><p class="hint">{ask.ids && ask.ids.length ? tr(ask.ids.length === 1 ? 'La fila se moverá dentro de la carpeta, en la pestaña «{t}».' : 'Las {n} filas se moverán dentro de la carpeta, en la pestaña «{t}».', { n: ask.ids.length, t: ask.tab }) : tr('La carpeta se crea en la pestaña «{t}». Luego mete filas con clic derecho → Mover a carpeta, o arrastrándolas a la carpeta.', { t: ask.tab })}</p>
    <input ref={ref} class="grow" style={{ width: '100%' }} placeholder={tr("Nombre de la carpeta…")} value={v} maxLength={80} onInput={e => setV(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') go(); if (e.key === 'Escape') onDone(); }} />
    {err && <p class="hint" style={{ color: '#ff8f87' }}>{err}</p>}
    <div class="lrow0" style={{ marginTop: '12px', justifyContent: 'flex-end' }}><button class="btn" onClick={onDone}>{tr("Cancelar")}</button><button class="btn primary" disabled={!v.trim() || !!err} onClick={go}>{tr("Crear carpeta")}</button></div></div>;
}
// Íconos de la barra superior (trazos de 24×24).
const TICON = {
  filter: 'M3 5h18l-7 8.5V19l-4 2v-7.5L3 5z',
  columns: 'M4 4h16v16H4zM9.5 4v16M14.5 4v16',
  props: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
  tasks: 'M9 11l2.5 2.5L16 9M4 4h16v16H4z',
};
const TI = ({ d }) => <svg class="ti" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d={d} /></svg>;
// Ajustes de YouTube: qué funciona sin clave, cómo obtener la clave y botón para probarla.
function YTSettings({ st }) {
  const c = st.S.config, [key, setKey] = useState(c.settings.ytKey || ''), [show, setShow] = useState(false), [res, setRes] = useState(null);
  const save = v => { c.settings.ytKey = v.trim(); st.saveConfig(); };
  const test = async () => {
    const k = key.trim(); if (!k) { setRes({ ok: false, msg: tr('Pega primero tu clave.') }); return; }
    setRes({ busy: true });
    try { const get = u => native ? native.json(u) : fetch(u).then(async r => { const d = await r.json(); if (!r.ok) throw new Error((d.error && d.error.message) || ('HTTP ' + r.status)); return d; });
      const d = await get('https://www.googleapis.com/youtube/v3/videos?part=statistics&id=dQw4w9WgXcQ&key=' + encodeURIComponent(k));
      const v = d.items && d.items[0] && d.items[0].statistics; if (!v) throw new Error(tr('La respuesta no trae estadísticas.'));
      setRes({ ok: true, msg: tr('¡Funciona! Video de prueba: {n} vistas.', { n: Number(v.viewCount).toLocaleString(LOCALE) }) }); if (k !== (c.settings.ytKey || '')) save(k);
    } catch (e) { const m = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); setRes({ ok: false, msg: /API key not valid|keyInvalid|400/i.test(m) ? tr('Google dice que la clave no es válida. Revisa que la copiaste completa.') : /has not been used|disabled|accessNotConfigured|403/i.test(m) ? tr('La clave existe, pero falta habilitar «YouTube Data API v3» en tu proyecto de Google Cloud (paso 2).') : m }); }
  };
  return <div>
    <p class="hint">{tr("Cuando una fila tiene un enlace de YouTube, su página muestra el título y la miniatura de ese video en «Referencias», con botones para usarlos. Esto funciona sin configurar nada.")}</p>
    <p class="hint">{tr("Con una clave de la API de YouTube (gratis) también se muestran las vistas públicas de esos videos.")}</p>
    <ol class="steps"><li>{tr("Entra a console.cloud.google.com (puedes usar el mismo proyecto de tu credencial de Google).")}</li><li>{tr("En «APIs y servicios → Biblioteca» busca y habilita")}{' '}<b>YouTube Data API v3</b>.</li><li>{tr("En «Credenciales → Crear credenciales → Clave de API», copia la clave y pégala aquí.")}</li></ol>
    <label class="f">{tr("Clave de API de YouTube")}<div class="lrow0"><input class="grow" type={show ? 'text' : 'password'} placeholder="AIza…" value={key} onInput={e => { setKey(e.target.value); setRes(null); }} onBlur={() => key.trim() !== (c.settings.ytKey || '') && save(key)} />
      <button class="btn" onClick={() => setShow(!show)}>{show ? tr('Ocultar') : tr('Mostrar')}</button><button class="btn primary" disabled={res && res.busy} onClick={test}>{res && res.busy ? tr('Probando…') : tr('Probar clave')}</button>
      {c.settings.ytKey && <button class="btn" onClick={() => { setKey(''); save(''); setRes(null); }}>{tr('Quitar')}</button>}</div></label>
    {res && !res.busy && <p class="hint" style={{ color: res.ok ? '#7fd1a5' : '#ff8f87' }}>{res.msg}</p>}
    <p class="hint">{tr("La clave se guarda en la configuración del proyecto (en una pestaña oculta de tu Sheet), así que la usan todos en tu equipo. Quien tenga acceso de edición al Sheet podría verla; si te preocupa, en Google Cloud puedes limitarla solo a «YouTube Data API v3».")}</p>
  </div>;
}
// Colores de fila (clave guardada en el Sheet → color).
const ROWC = {
  red: { hex: '#e5484d', label: () => tr('Rojo') }, orange: { hex: '#f08c2e', label: () => tr('Naranja') }, yellow: { hex: '#e8c419', label: () => tr('Amarillo') }, green: { hex: '#30a46c', label: () => tr('Verde') },
  blue: { hex: '#3e8ef7', label: () => tr('Azul') }, purple: { hex: '#8e4ec6', label: () => tr('Morado') }, pink: { hex: '#e93d82', label: () => tr('Rosa') }, gray: { hex: '#8b8d98', label: () => tr('Gris') },
};
// Checklists predefinidas que se agregan a las páginas (y que usan las automatizaciones).
function ChecklistSettings({ st }) {
  const c = st.S.config, [list, setList] = useState(() => JSON.parse(JSON.stringify(st.checklists())));
  const save = l => { setList(l); c.checklists = l; st.saveConfig(); };
  return <div><p class="hint">{tr("Listas de tareas que puedes agregar a la página de cada video con «＋ Checklist» o con clic derecho. El progreso (por ejemplo 3/6) se ve en la tabla y en las tarjetas, y las automatizaciones pueden agregarlas o reaccionar cuando se completan.")}</p>
    {list.map((k, i) => <div class="chk-ed"><input class="grow" value={k.name} onBlur={e => save(list.map((x, j) => j === i ? { ...x, name: e.target.value.trim() || x.name } : x))} />
      <textarea rows={Math.max(3, k.items.length)} value={k.items.join('\n')} onBlur={e => save(list.map((x, j) => j === i ? { ...x, items: e.target.value.split('\n').map(t => t.trim()).filter(Boolean) } : x))} />
      <button class="icon" title={tr("Eliminar")} onClick={() => confirm(tr('¿Eliminar la checklist «{n}»?', { n: k.name })) && save(list.filter((_, j) => j !== i))}>✕</button></div>)}
    <div class="lrow0"><button class="btn" onClick={() => save([...list, { id: newId(), name: tr('Nueva checklist'), items: [tr('Primera tarea')] }])}>{tr("＋ Nueva checklist")}</button>
      <button class="btn" onClick={() => confirm(tr('¿Volver a las checklists de ejemplo?')) && save(st.defaultChecklists())}>{tr("Restablecer ejemplos")}</button></div>
    <p class="hint">{tr("Una tarea por línea.")}</p></div>;
}
// Avisos de fechas: preferencia personal.
function DateAlerts() {
  const [p, setP] = useState(alertPrefs()), up = x => { setAlertPrefs(x); setP(alertPrefs()); };
  return <div class="f" style={{ marginTop: '18px' }}><b class="tx">{tr("Avisos de fechas")}</b>
    <label class="chkrow"><input type="checkbox" checked={p.on} onChange={e => up({ on: e.target.checked })} />{tr("Avisarme de videos atrasados o por vencer (bandeja 🔔 y una notificación al día)")}</label>
    {p.on && <div class="lrow0"><span>{tr("Avisar desde")}</span><input type="number" min="0" max="30" style={{ width: '64px' }} value={p.days} onInput={e => up({ days: Math.max(0, Math.min(30, +e.target.value || 0)) })} /><span>{tr("días antes")}</span>
      <select value={p.scope} onChange={e => up({ scope: e.target.value })}><option value="mine">{tr("de lo que tengo asignado")}</option><option value="all">{tr("de todo el proyecto")}</option></select></div>}
    <p class="hint">{tr("Usa la columna de fecha del calendario. Lo atrasado se ve en rojo y lo que vence pronto en naranja. Lo publicado o descartado no cuenta.")}</p></div>;
}
// Color de fondo de una columna del kanban.
const COLBG = ['', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
const COLBG_NAME = { '': tr('Sin color'), gray: tr('Gris'), brown: tr('Café'), orange: tr('Naranja'), yellow: tr('Amarillo'), green: tr('Verde'), blue: tr('Azul'), purple: tr('Morado'), pink: tr('Rosa'), red: tr('Rojo') };

// Menú de clic derecho: items = [{ label, onClick, sub, danger, disabled, hint }] o 'sep'.
function ContextMenu({ menu, onClose }) {

  const ref = useRef(), [pos, setPos] = useState({ x: menu.x, y: menu.y }), [subOpen, setSubOpen] = useState(-1);
  useEffect(() => { const el = ref.current; if (!el) return; const b = el.getBoundingClientRect(); setPos({ x: Math.max(4, Math.min(menu.x, innerWidth - b.width - 4)), y: Math.max(4, Math.min(menu.y, innerHeight - b.height - 4)) }); }, [menu]);
  useEffect(() => { const c = e => { if (!ref.current || !ref.current.contains(e.target)) onClose(); }, k = e => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', c, true); document.addEventListener('keydown', k); window.addEventListener('blur', onClose); window.addEventListener('resize', onClose); document.addEventListener('wheel', onClose, true);
    return () => { document.removeEventListener('mousedown', c, true); document.removeEventListener('keydown', k); window.removeEventListener('blur', onClose); window.removeEventListener('resize', onClose); document.removeEventListener('wheel', onClose, true); }; }, []);
  const items = menu.items.filter(Boolean).filter((it, i, a) => it !== 'sep' || (i > 0 && a[i - 1] !== 'sep' && i < a.length - 1));
  return <div ref={ref} class={'ctx' + (pos.x > innerWidth - 470 ? ' flip' : '')} style={{ left: pos.x + 'px', top: pos.y + 'px' }} onContextMenu={e => e.preventDefault()}>
    {menu.title && <div class="ctx-t">{menu.title}</div>}
    {items.map((it, i) => it === 'sep' ? <div class="ctx-sep" /> :
      <div class={'ctx-i' + (it.danger ? ' danger' : '') + (it.disabled ? ' off' : '') + (it.sub ? ' has-sub' : '')} onMouseEnter={() => setSubOpen(it.sub ? i : -1)}
        onClick={() => { if (it.disabled || it.sub) return; onClose(); it.onClick(); }}>
        <span>{it.label}</span>{it.check && <span class="ctx-h">✓</span>}{it.hint && <span class="ctx-h">{it.hint}</span>}{it.sub && <span class="ctx-h">›</span>}
        {it.sub && subOpen === i && <div class="ctx sub">{it.sub.length ? it.sub.map(x => <div class={'ctx-i' + (x.disabled ? ' off' : '')} onClick={e => { e.stopPropagation(); if (x.disabled) return; onClose(); x.onClick(); }}><span>{x.dot !== undefined && <i class={'dot kb-dot ' + (x.dot ? 'kb-' + x.dot : 'kb-none')} />}{x.label}</span>{x.check && <span class="ctx-h">✓</span>}</div>) : <div class="ctx-i off">{tr("Sin opciones")}</div>}</div>}
      </div>)}
  </div>;
}

const VIEWS = [['table', tr('Tabla')], ['kanban', 'Kanban'], ['gallery', tr('Galería')], ['calendar', tr('Calendario')], ['dash', tr('Panel')]];
const OPS = { is: tr('es'), has: tr('contiene'), empty: tr('está vacío'), full: tr('no está vacío') };
const match = (r, f) => { const val = String(r.v[f.col] ?? ''); if (f.op === 'empty') return !val || val === 'false'; if (f.op === 'full') return !!val && val !== 'false'; if (f.op === 'has') return val.toLowerCase().includes(String(f.val || '').toLowerCase()); return !f.val || splitMulti(val).includes(f.val) || val === f.val; };
function Bars({ title, data, color }) {
  const max = Math.max(1, ...data.map(d => d[1]));
  return <div class="panel"><h4>{title}</h4>{data.map(([l, n, c]) => <div class="bar"><span class="bar-l" title={l}>{l}</span><span class="bar-t"><i class={'c-' + (c || color || 'blue')} style={{ width: (100 * n / max) + '%' }} /></span><b>{n}</b></div>)}{!data.length && <p class="muted">{tr("Sin datos.")}</p>}</div>;
}
// Meta semanal: cuántos videos se publicaron esta semana (lunes a domingo) contra la meta, y las últimas 8 semanas.
function WeeklyGoal({ st, rows }) {
  const S = st.S, s = S.config.settings, goal = +(s.weeklyGoal || 0), [ed, setEd] = useState(false), [v, setV] = useState(goal || 3);
  if (!s.dateCol) return null;
  const monday = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }, iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const done = r => s.groupCol ? DONE.test(String(r.v[s.groupCol] || '')) && !/descart|discard|cancel/i.test(String(r.v[s.groupCol] || '')) : String(r.v[s.dateCol] || '').slice(0, 10) <= iso(new Date());
  const weeks = [...Array(8)].map((_, i) => { const a = monday(new Date()); a.setDate(a.getDate() - 7 * (7 - i)); const b = new Date(a); b.setDate(b.getDate() + 6); return { a: iso(a), b: iso(b), n: rows.filter(r => { const d = String(r.v[s.dateCol] || '').slice(0, 10); return d >= iso(a) && d <= iso(b) && done(r); }).length }; });
  const cur = weeks[7], planned = rows.filter(r => { const d = String(r.v[s.dateCol] || '').slice(0, 10); return d >= cur.a && d <= cur.b && !done(r); }).length, max = Math.max(goal, ...weeks.map(w => w.n), 1);
  const save = () => { s.weeklyGoal = Math.max(0, +v || 0); st.saveConfig(); setEd(false); };
  return <div class="panel goal"><div class="goal-h"><h4>{tr("Meta semanal")}</h4>{st.can('admin') && !ed && <button class="mini" onClick={() => { setV(goal || 3); setEd(true); }}>{goal ? tr('Cambiar meta') : tr('Poner una meta')}</button>}
      {ed && <span class="lrow0"><input type="number" min="0" style={{ width: '64px' }} value={v} onInput={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} /><span>{tr("videos por semana")}</span><button class="mini primary" onClick={save}>{tr("Guardar")}</button></span>}</div>
    {goal ? <><div class="goal-big"><b>{cur.n}</b> / {goal} <span class="muted">{tr("publicados esta semana")}</span>{cur.n >= goal && <span class="goal-ok">🎉 {tr("¡Meta cumplida!")}</span>}</div>
      <div class="goal-bar"><i style={{ width: Math.min(100, 100 * cur.n / goal) + '%' }} class={cur.n >= goal ? 'ok' : ''} /></div>
      <p class="muted sm">{planned ? tr('{n} más programados para esta semana.', { n: planned }) : cur.n < goal ? tr('No hay más videos programados esta semana.') : ''}</p></>
      : <p class="muted">{tr("Ponte una meta de videos por semana y aquí verás tu avance.")}</p>}
    <div class="goal-weeks">{weeks.map((w, i) => <div class="gw" title={tr('Semana del {d}: {n}', { d: fmtDate(w.a), n: w.n })}><span class="gw-b"><i style={{ height: (100 * w.n / max) + '%' }} class={goal && w.n >= goal ? 'ok' : ''} />{goal > 0 && <em style={{ bottom: (100 * goal / max) + '%' }} />}</span><small>{i === 7 ? tr('Esta') : fmtDate(w.a).replace(/,? \d{4}$/, '')}</small></div>)}</div></div>;
}
function DashView({ st, rows, dups, open }) {
  const S = st.S, s = S.config.settings, name = st.myName(); const count = f => { const m = new Map(); rows.forEach(r => f(r).forEach(k => m.set(k, (m.get(k) || 0) + 1))); return [...m]; };
  const people = [...new Set(S.order.flatMap(t => S.tabs[t].header.filter(h => st.type(h) === 'person')))];
  const mine = rows.filter(r => people.some(c => r.v[c] === name) && !DONE.test(r.v[s.groupCol] || ''));
  const g = s.groupCol ? [...optionsOf(st, s.groupCol).map(o => [o.v, rows.filter(r => r.v[s.groupCol] === o.v).length, o.color]), [tr('Sin {x}', { x: s.groupCol.toLowerCase() }), rows.filter(r => !r.v[s.groupCol]).length, 'gray']] : [];
  const months = s.dateCol ? count(r => isISO(r.v[s.dateCol]) ? [r.v[s.dateCol].slice(0, 7)] : []).sort() : [];
  const dupRows = rows.filter(r => dups.has(r.id));
  return <div class="dash"><WeeklyGoal st={st} rows={rows} /><div class="tiles"><div class="tile"><b>{rows.length}</b><span>{tr("Elementos")}</span></div>
    {s.imageCol && <div class="tile"><b>{rows.filter(r => !r.v[s.imageCol]).length}</b><span>{tr("Sin imagen")}</span></div>}
    <div class="tile"><b>{mine.length}</b><span>{tr("Mis pendientes")}</span></div><div class="tile"><b>{dupRows.length}</b><span>{tr("Títulos duplicados")}</span></div></div>
    <div class="panels">{s.groupCol && <Bars title={tr('Por ') + s.groupCol.toLowerCase()} data={g} />}
      <Bars title={tr("Por pestaña")} data={count(r => [r.tab])} color="purple" />
      {people.map(c => <Bars title={tr('Por ') + c.toLowerCase()} data={count(r => r.v[c] ? [r.v[c]] : [tr('Sin asignar')])} color="green" />)}
      {s.dateCol && <Bars title={tr('Por mes · ') + s.dateCol} data={months.map(([k, n]) => [fmtDate(k + '-01').slice(2), n])} color="orange" />}
      <div class="panel"><h4>{tr("Títulos duplicados")}</h4>{dupRows.map(r => <div class="link" onClick={() => open(r)}>{r.v[s.titleCol]} <span class="muted">· {r.tab}</span></div>)}{!dupRows.length && <p class="muted">{tr("Ninguno.")}</p>}</div></div></div>;
}
function Skeleton() { return <div class="app"><aside class="sidebar sk">{[70, 50, 60, 55, 65, 45].map(w => <div class="skl" style={{ width: w + '%' }} />)}</aside><main><div class="topbar"><div class="skl" style={{ width: '320px', height: '30px' }} /></div><div class="body pad">{Array.from({ length: 12 }, (_, i) => <div class="skrow"><div class="skl" style={{ width: (30 + (i * 37) % 50) + '%' }} /><div class="skl" style={{ width: '12%' }} /><div class="skl" style={{ width: '10%' }} /></div>)}<p class="muted center-t">{tr("Cargando el Sheet…")}</p></div></main></div>; }

function ColList({ label, all, value, onChange, hint }) {
  const v = value || [];
  return <div class="f">{label}<div class="checks">{all.map(c => <label><input type="checkbox" checked={v.includes(c)} onChange={e => onChange(e.target.checked ? [...v, c] : v.filter(x => x !== c))} />{c}</label>)}</div>{hint && <p class="hint">{hint}</p>}</div>;
}
function Settings({ st, onClose, onCol, onAddCol, start }) {
  const S = st.S, c = S.config, [sec, setSec] = useState(start || 'general'), [rid, setRid] = useState(c.roles[0]?.id), [uopen, setUopen] = useState(null), [nu, setNu] = useState({ email: '', name: '' }), [tid, setTid] = useState(0);
  const admin = st.can('admin'), save = () => st.saveConfig(); const names = [...new Set(S.order.flatMap(t => S.tabs[t].header))].filter(h => h && h !== 'ID');
  const secs = [['general', tr('General'), admin], ['cols', tr('Columnas'), true], ['roles', tr('Roles'), admin], ['users', tr('Usuarios'), admin], ['tpl', tr('Plantillas'), admin], ['auto', tr('Automatizaciones'), admin], ['chk', tr('Checklists'), admin], ['yt', 'YouTube', admin], ['look', tr('Apariencia y atajos'), true], ['hist', tr('Historial'), st.can('viewHistory')]].filter(x => x[2]);
  const role = c.roles.find(r => r.id === rid), sel = (k, label, types) => <label class="f">{label}<select value={c.settings[k]} onChange={e => { c.settings[k] = e.target.value; save(); }}><option value="">{tr("(ninguna)")}</option>{names.filter(n => !types || types.includes(st.type(n))).map(n => <option>{n}</option>)}</select></label>;
  const tpl = c.templates[tid];
  return <Modal title={tr("Ajustes del proyecto")} onClose={onClose} wide><div class="set"><nav>{secs.map(([k, l]) => <button class={sec === k ? 'on' : ''} onClick={() => setSec(k)}>{l}</button>)}</nav><div class="set-b">
    {sec === 'general' && <div>{sel('titleCol', tr('Columna de título (la que se abre como página)'))}{sel('groupCol', tr('Columna que agrupa el kanban'), ['select', 'person'])}{sel('dateCol', tr('Columna de fecha del calendario'), ['date'])}{sel('imageCol', tr('Columna de imagen de la galería'), ['image', 'url'])}
      <label class="f">{tr("Rol para quien no está en la lista de usuarios")}<select value={c.defaultRoleId} onChange={e => { c.defaultRoleId = e.target.value; save(); }}>{c.roles.map(r => <option value={r.id}>{r.name}</option>)}</select></label>
      <p class="hint">{tr('Dueño del proyecto:')} {c.owner}. {tr('El dueño siempre tiene todos los permisos.')}</p></div>}
    {sec === 'yt' && <YTSettings st={st} />}
    {sec === 'chk' && <ChecklistSettings st={st} />}
    {sec === 'cols' && <div>{names.map(n => <div class="lrow click" onClick={() => onCol(n)}><span class="tyi">{ICON[st.type(n)]}</span><b>{n}</b><span class="muted">{TYPES[st.type(n)]}{(c.schema[n]?.options || []).length ? ` · ${c.schema[n].options.length} opciones` : ''}</span></div>)}
      {st.can('manageColumns') && <button class="btn" onClick={onAddCol}>{tr("+ Agregar columna")}</button>}</div>}
    {sec === 'roles' && <div class="two"><div class="side">{c.roles.map(r => <button class={r.id === rid ? 'on' : ''} onClick={() => setRid(r.id)}>{r.name}</button>)}
      <button onClick={() => { const r = { id: newId(), name: tr('Nuevo rol'), perms: { openPages: true } }; c.roles.push(r); setRid(r.id); save(); }}>{tr("+ Nuevo rol")}</button></div>
      {role && <div class="grow"><label class="f">{tr("Nombre del rol")}<input value={role.name} onInput={e => { role.name = e.target.value; }} onBlur={save} /></label>
        <div class="f">{tr("Permisos")}<div class="checks one">{PERMS.map(([k, l]) => <label><input type="checkbox" checked={!!role.perms[k] || !!role.perms.admin} disabled={(role.perms.admin && k !== 'admin') || (role.id === 'admin' && k === 'admin')} onChange={e => { role.perms[k] = e.target.checked; save(); }} />{l}</label>)}</div></div>
        {!role.perms.admin && <div><ColList label={tr("Columnas que puede editar")} all={names} value={role.perms.editableCols} onChange={v => { role.perms.editableCols = v; save(); }} hint={tr("Sin ninguna marcada puede editar todas (si tiene «Editar celdas»).")} />
          <ColList label={tr("Columnas ocultas para este rol")} all={names} value={role.perms.hiddenCols} onChange={v => { role.perms.hiddenCols = v; save(); }} />
          <ColList label={tr("Pestañas ocultas para este rol")} all={S.order} value={role.perms.hiddenTabs} onChange={v => { role.perms.hiddenTabs = v; save(); }} /></div>}
        {role.id !== 'admin' && <button class="btn danger" onClick={() => { if (confirm(tr('¿Eliminar este rol?'))) { c.roles = c.roles.filter(r => r !== role); setRid(c.roles[0]?.id); save(); } }}>{tr("Eliminar rol")}</button>}</div>}</div>}
    {sec === 'users' && <div>{c.users.map(u => <div class="ucard"><div class="lrow"><input class="grow" value={u.name} onInput={e => { u.name = e.target.value; }} onBlur={save} /><span class="muted grow">{u.email}</span>
      <select value={u.roleId} onChange={e => { u.roleId = e.target.value; save(); }}>{c.roles.map(r => <option value={r.id}>{r.name}</option>)}</select>
      <button class="mini" onClick={() => setUopen(uopen === u.email ? null : u.email)}>{tr('Ajustes individuales')}{Object.keys(u.overrides || {}).length ? ` (${Object.keys(u.overrides).length})` : ''}</button>
      {u.email !== c.owner && <button class="icon" title={tr("Quitar")} onClick={() => { c.users = c.users.filter(x => x !== u); save(); }}>✕</button>}</div>
      {uopen === u.email && <div class="checks one ov">{PERMS.map(([k, l]) => <label>{l}<select value={u.overrides?.[k] === true ? 'y' : u.overrides?.[k] === false ? 'n' : ''} onChange={e => { u.overrides = { ...(u.overrides || {}) }; if (!e.target.value) delete u.overrides[k]; else u.overrides[k] = e.target.value === 'y'; save(); }}><option value="">{tr("Según su rol")}</option><option value="y">{tr("Permitir")}</option><option value="n">{tr("Negar")}</option></select></label>)}</div>}</div>)}
      <div class="lrow"><input class="grow" placeholder={tr("Nombre")} value={nu.name} onInput={e => setNu({ ...nu, name: e.target.value })} /><input class="grow" placeholder="correo@gmail.com" value={nu.email} onInput={e => setNu({ ...nu, email: e.target.value })} />
        <button class="btn" onClick={() => { const email = nu.email.trim().toLowerCase(); if (!/.+@.+\..+/.test(email) || c.users.some(u => u.email.toLowerCase() === email)) return; c.users.push({ email, name: nu.name.trim() || email, roleId: c.defaultRoleId, overrides: {} }); setNu({ email: '', name: '' }); save(); }}>{tr("Agregar persona")}</button></div>
      <p class="hint">{tr("Cada persona debe tener además acceso al Sheet en Google (editor para quien modifica, lector para visitantes). Los permisos de esta lista se aplican dentro de la app.")}</p></div>}
    {sec === 'tpl' && <div class="two"><div class="side">{c.templates.map((t, i) => <button class={i === tid ? 'on' : ''} onClick={() => setTid(i)}>{t.name}</button>)}<button onClick={() => { c.templates.push({ name: tr('Nueva plantilla'), content: '# Guion\n\n## Idea\n\n## Escenas\n\n- [ ] Intro\n- [ ] Desarrollo\n- [ ] Cierre\n' }); setTid(c.templates.length - 1); save(); }}>{tr("+ Nueva plantilla")}</button></div>
      {tpl ? <div class="grow"><label class="f">{tr("Nombre")}<input value={tpl.name} onInput={e => { tpl.name = e.target.value; }} onBlur={save} /></label><RichEditor key={tid} value={tpl.content} editable onChange={md => { tpl.content = md; save(); }} />
        <button class="btn danger" onClick={() => { c.templates = c.templates.filter(t => t !== tpl); setTid(0); save(); }}>{tr("Eliminar plantilla")}</button></div> : <p class="muted grow">{tr("Una plantilla es el contenido inicial de la página al crear un elemento.")}</p>}</div>}
    {sec === 'auto' && <AutomationList st={st} />}
    {sec === 'look' && <Appearance value={st.ui.appear()} onChange={st.ui.setAppear} />}
    {sec === 'hist' && <HistSection st={st} />}
  </div></div></Modal>;
}

function Workspace({ st, name, onHome }) {
  const S = useStore(st), pk = 'ui:' + name + ':' + S.me.email; const saved0 = useMemo(() => LS.get(pk, {}), []);
  const [view, setView] = useState(saved0.view || 'table'), [tab, setTab] = useState(saved0.tab || '*'), [search, setSearch] = useState(''), [filters, setFilters] = useState([]), [sort, setSort] = useState({ col: '', dir: 1 }), [mine, setMine] = useState(false);
  const [prefs, setPrefsS] = useState(saved0.prefs || {}), setPrefs = p => setPrefsS(x => ({ ...x, ...p }));
  const [menu, setMenu] = useState(null), [dropTab, setDropTab] = useState(null), [openId, setOpenId] = useState(null), [settings, setSettings] = useState(null), [colEdit, setColEdit] = useState(null), [addCol, setAddCol] = useState(null), [pal, setPal] = useState(false), [pq, setPq] = useState(''), [phi, setPhi] = useState(0), [fpop, setFpop] = useState(false), [tplAsk, setTplAsk] = useState(null), [views, setViews] = useState(saved0.views || []), [vname, setVname] = useState(null), [newTab, setNewTab] = useState(null), [renTab, setRenTab] = useState(null), [folderAsk, setFolderAsk] = useState(null);
  const [sel, setSel] = useState(new Set()), [colsPop, setColsPop] = useState(false), [inbox, setInbox] = useState(false), [seen, setSeen] = useState(LS.get('seen:' + pk, Date.now() - 864e5 * 3));
  const fref = useRef(), cref = useRef();
  useEffect(() => { const t = setTimeout(() => { const ap = alertPrefs(); if (!ap.on || !native || !native.notify) return; const today = new Date().toDateString(); try { if (localStorage.getItem('kuadro-due-day:' + name) === today) return; } catch { }
    const due = inboxItems(st).filter(x => x.due); if (!due.length) return; const late = due.filter(x => x.due.late).length, soon = due.length - late;
    native.notify(tr('Fechas en {p}', { p: name }), [late && tr(late === 1 ? '1 video atrasado' : '{n} videos atrasados', { n: late }), soon && tr(soon === 1 ? '1 por vencer' : '{n} por vencer', { n: soon })].filter(Boolean).join(' · ')); try { localStorage.setItem('kuadro-due-day:' + name, today); } catch { } }, 6000); return () => clearTimeout(t); }, []);
  useEffect(() => { const t0 = setTimeout(() => st.runDateAutomations(), 4000), iv = setInterval(() => st.runDateAutomations(), 30 * 60 * 1000); return () => { clearTimeout(t0); clearInterval(iv); }; }, []);
  useEffect(() => { LS.set(pk, { view, tab, views, prefs }); }, [view, tab, views, prefs]);
  useEffect(() => { setSel(new Set()); }, [tab, view]);
  // Atajos globales: Ctrl+K buscar, Ctrl+Z / Ctrl+Y deshacer y rehacer, Esc cerrar página.
  useEffect(() => {
    const k = e => {
      const mod = e.ctrlKey || e.metaKey, typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"], .ProseMirror');
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal(true); setPq(''); setPhi(0); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); if (!st.undoLast()) st.toast(tr('Nada que deshacer')); else st.toast(tr('Deshecho (Ctrl+Y para rehacer)')); }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); if (st.redoLast()) st.toast(tr('Rehecho')); }
    };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);
  // Captura rápida: la mini ventana manda la idea aquí; avisamos al proceso principal qué pestañas hay.
  useEffect(() => { if (!native || !native.onCapture) return; return native.onCapture(c => { const t = S.tabs[c.tab] ? c.tab : S.order[0]; if (!t) return; const v = { [S.config.settings.titleCol]: c.title }; st.addRow(t, v, { system: !st.can('addRows') && st.can('addCards'), page: c.note || '' }); st.toast(tr('💡 Idea guardada en ') + t); }); }, [st]);
  useEffect(() => { if (native && native.captureContext && S.status === 'ready') native.captureContext({ project: S.title, tabs: S.order.filter(t => S.tabs[t].idCol >= 0), def: tab !== '*' && S.tabs[tab] ? tab : S.order[0] }); }, [S.status, S.order.join('|'), tab, S.title]);
  if (S.status === 'loading') return <Skeleton />;
  if (S.status === 'error') return <div class="center"><p>{tr("No se pudo abrir el proyecto.")}</p><p class="muted">{S.error}</p>{S.authExpired && <button class="btn primary" onClick={() => st.ui.relogin()}>{tr("Volver a iniciar sesión con Google")}</button>}<button class="btn" onClick={onHome}>{tr("Volver")}</button></div>;
  const tabs = S.order.filter(t => !st.hiddenTabs().includes(t)), cur = tab !== '*' && tabs.includes(tab) ? tab : '*', s = S.config.settings, name_ = st.myName();
  const people = [...new Set(S.order.flatMap(t => S.tabs[t].header.filter(h => st.type(h) === 'person')))];
  const baseCols = [...new Set((cur === '*' ? tabs : [cur]).flatMap(t => S.tabs[t].header))].filter(h => h && h !== 'ID' && h !== st.folderCol() && h !== st.colorCol() && !st.hiddenCols().includes(h));
  const ordered = [s.titleCol, ...baseCols.filter(c => c !== s.titleCol)].filter(c => baseCols.includes(c));
  const po = (prefs.order || []).filter(c => ordered.includes(c)); const tableCols = [...po, ...ordered.filter(c => !po.includes(c))].filter(c => !(prefs.hidden || []).includes(c));
  let rows = st.allRows(cur === '*' ? null : cur).filter(r => (!search || Object.values(r.v).some(x => String(x).toLowerCase().includes(search.toLowerCase())) || norm((S.pages[r.id] || {}).md || '').includes(norm(search))) && (!mine || (people.some(c => r.v[c] === name_) && !DONE.test(r.v[s.groupCol] || ''))) && filters.every(f => match(r, f)));
  const hiddenRows = new Set(prefs.hiddenRows || []), hiddenHere = hiddenRows.size ? rows.filter(r => hiddenRows.has(r.id)).length : 0;
  if (hiddenHere && !prefs.showHidden) rows = rows.filter(r => !hiddenRows.has(r.id));
  const hideRows = ids => { setPrefs({ hiddenRows: [...new Set([...(prefs.hiddenRows || []), ...ids])] }); setSel(new Set()); st.toast(ids.length === 1 ? tr('Fila oculta en tu vista. Puedes mostrarla desde la barra de arriba.') : tr('{n} filas ocultas en tu vista. Puedes mostrarlas desde la barra de arriba.', { n: ids.length })); };
  const unhideRows = ids => setPrefs({ hiddenRows: (prefs.hiddenRows || []).filter(x => !ids.includes(x)) });
  if (sort.col) rows = [...rows].sort((a, b) => sort.dir * String(a.v[sort.col] ?? '').localeCompare(String(b.v[sort.col] ?? ''), tr('es'), { numeric: true }));
  // Carpetas: las filas de cada carpeta se muestran juntas, debajo de su encabezado, en la posición de su primera fila.
  const fc = st.folderCol(), folded = new Set(prefs.folded || []);
  let fold = null;
  const gcol = view === 'table' && prefs.groupBy && (st.S.tabs[cur === '*' ? tabs[0] : cur] || {}).header && [...new Set((cur === '*' ? tabs : [cur]).flatMap(t => S.tabs[t].header))].includes(prefs.groupBy) ? prefs.groupBy : null;
  if (gcol) {
    // Agrupar por columna: un encabezado por valor (orden de las opciones, luego el resto, vacío al final).
    const gval = r => { const v = String(r.v[gcol] ?? '').trim(); return st.type(gcol) === 'multi' ? (v.split(',')[0] || '').trim() : st.type(gcol) === 'checkbox' ? (v === 'true' ? '✓' : '') : v; };
    const opts = optionsOf(st, gcol), present = [...new Set(rows.map(gval))];
    const order = [...opts.map(o => o.v).filter(v => present.includes(v)), ...present.filter(v => v && !opts.some(o => o.v === v)).sort((a, b) => a.localeCompare(b)), ...(present.includes('') ? [''] : [])];
    const gfold = new Set(prefs.gfolded || []), out = [], heads = [], info = new Map();
    for (const v of order) { const k = 'g|' + gcol + '|' + v, members = rows.filter(r => gval(r) === v), closed = gfold.has(k), o = opts.find(x => x.v === v);
      heads.push({ key: k, name: v, group: true, col: gcol, color: o ? o.color || 'gray' : null, count: members.length, closed, at: out.length });
      if (!closed) members.forEach((m, i) => { out.push(m); info.set(m.id, { key: k, first: i === 0, last: i === members.length - 1 }); }); }
    rows = out; fold = { heads, info, group: true };
  }
  if (view === 'table' && !gcol) {
    const defs = (cur === '*' ? tabs : [cur]).flatMap(t => st.foldersOf(t));
    if (defs.length) {
      const keyOf = r => { const n = fc ? String(r.v[fc] || '').trim() : ''; return n ? r.tab + '|' + n : null; };
      const out = [], heads = [], info = new Map(), seen = new Set();
      for (const r of rows) {
        const k = keyOf(r); if (!k) { out.push(r); continue; } if (seen.has(k)) continue; seen.add(k);
        const members = rows.filter(x => keyOf(x) === k), closed = folded.has(k), name = k.slice(r.tab.length + 1);
        heads.push({ key: k, tab: r.tab, name, count: members.length, closed, at: out.length });
        if (!closed) members.forEach((m, i) => { out.push(m); info.set(m.id, { key: k, first: i === 0, last: i === members.length - 1 }); });
      }
      if (!search && !filters.length && !mine) defs.forEach(d => { const k = d.tab + '|' + d.name; if (!seen.has(k)) heads.push({ key: k, tab: d.tab, name: d.name, count: 0, closed: folded.has(k), at: out.length }); });
      rows = out; fold = { heads, info };
    }
  }
  const dups = st.duplicates(); let openRow = null; if (openId) openRow = S.tabs[openId.tab]?.rows.find(r => r.id === openId.id) || null;
  const icons = Object.fromEntries(Object.entries(S.pageMeta).filter(([, m]) => m.icon).map(([k, m]) => [k, m.icon]));
  const open = r => setOpenId({ tab: r.tab, id: r.id });
  const create = (values, card, t) => { const target = cur === '*' ? tabs[0] : cur; const id = st.addRow(target, values, { card, page: t ? t.content : '' }); if (id && st.can('openPages')) setOpenId({ tab: target, id }); };
  const onNew = (values = {}, card) => S.config.templates.length ? setTplAsk({ values, card }) : create(values, card);
  const pTitles = pq.trim() ? st.allRows().filter(r => norm(r.v[s.titleCol]).includes(norm(pq))).slice(0, 10) : [];
  const pBody = pq.trim() ? st.searchPages(pq, st.allRows()).filter(x => !pTitles.includes(x.row)).slice(0, 8) : [];
  const pAll = [...pTitles.map(r => ({ row: r })), ...pBody];
  const applyView = v => { setView(v.view); setTab(v.tab); setSearch(v.search || ''); setFilters(v.filters || []); setSort(v.sort || { col: '', dir: 1 }); setMine(!!v.mine); if (v.prefs) setPrefs(v.prefs); };
  const items = inboxItems(st), unread = items.filter(i => Date.parse(i.at) > seen).length;
  const markSeen = () => { const t = Date.now(); setSeen(t); LS.set('seen:' + pk, t); };
  const sel_ = (col, row) => optionsOf(st, col).map(o => ({ label: o.v, check: String(row.v[col] || '') === o.v, onClick: () => st.setCell(row.tab, row.id, col, o.v, { move: col === s.groupCol }) }));
  const rowMenu = ({ row: r, col, list, table: ctxTable }) => {
    const T = S.tabs[r.tab], title = r.v[s.titleCol] || '', ok = !r.tmp, pcols = T.header.filter(h => st.type(h) === 'person' && !st.hiddenCols().includes(h));
    const sameTab = (list || T.rows).filter(x => x.tab === r.tab && x.id !== r.id), link = Object.keys(r.v).filter(c => st.type(c) === 'url').flatMap(c => urls(r.v[c]))[0];
    const others = tabs.filter(t => t !== r.tab && S.tabs[t].idCol >= 0), ct = col && st.type(col);
    return { title: title.slice(0, 48) || tr('Sin título'), items: [
      st.can('openPages') && { label: tr('Abrir'), hint: 'Ctrl+Enter', onClick: () => open(r) },
      'sep',
      ok && s.groupCol && T.header.includes(s.groupCol) && (st.canEditCol(s.groupCol) || st.can('moveCards')) && { label: tr('Cambiar ') + s.groupCol.toLowerCase(), sub: sel_(s.groupCol, r) },
      ...pcols.filter(c => ok && st.canEditCol(c)).map(c => ({ label: tr('Asignar ') + c.toLowerCase(), sub: [...optionsOf(st, c).map(o => ({ label: o.v, check: r.v[c] === o.v, onClick: () => st.setCell(r.tab, r.id, c, o.v) })), ...(r.v[c] ? [{ label: tr('Quitar asignación'), onClick: () => st.setCell(r.tab, r.id, c, '') }] : [])] })),
      ok && st.can('moveTabs') && others.length && { label: tr('Mover a pestaña'), sub: others.map(t => ({ label: t, onClick: () => st.moveRow(r.tab, r.id, t) })) },
      ok && st.can('editCells') && { label: tr('Color de fila'), sub: colorItems([{ tab: r.tab, id: r.id }], cc ? r.v[cc] : '') },
      ok && st.can('editPages') && { label: tr('Agregar checklist'), sub: st.checklists().map(c => ({ label: c.name, onClick: () => st.addChecklist(r.id, c.name, c.items) })) },
      ok && st.can('moveCards') && view === 'table' && { label: tr('Mover a carpeta'), sub: folderItems(r.tab, [r.id], st.folderCol() ? String(r.v[st.folderCol()] || '') : '') },
      ok && st.can('moveCards') && !sort.col && sameTab.length && { label: list && !ctxTable ? tr('Subir al inicio de la columna') : tr('Subir al inicio'), onClick: () => st.reorder(r.tab, r.id, sameTab[0].id, false) },
      ok && st.can('moveCards') && !sort.col && sameTab.length && { label: list && !ctxTable ? tr('Bajar al final de la columna') : tr('Bajar al final'), onClick: () => st.reorder(r.tab, r.id, sameTab[sameTab.length - 1].id, true) },
      'sep',
      hiddenRows.has(r.id) ? { label: tr('Volver a mostrar esta fila'), onClick: () => unhideRows([r.id]) } : { label: tr('Ocultar fila'), hint: tr('solo en tu vista'), onClick: () => hideRows([r.id]) },
      view === 'table' && { label: tr('Alto de filas'), sub: rowHItems() },
      'sep',
      ok && st.can('addRows') && { label: tr('Duplicar'), onClick: () => { const v = {}; T.header.forEach(h => { if (h && h !== 'ID' && st.type(h) !== 'auto' && r.v[h] !== '' && r.v[h] !== false) v[h] = r.v[h]; }); v[s.titleCol] = title + tr(' (copia)'); st.addRow(r.tab, v, { page: (S.pages[r.id] || {}).md || '' }); } },
      { label: tr('Copiar título'), onClick: () => copyText(title, st) },
      col && col !== s.titleCol && r.v[col] !== '' && r.v[col] !== false && { label: tr('Copiar «') + col + '»', onClick: () => copyText(ct === 'date' ? fmtDate(r.v[col]) : String(r.v[col]), st) },
      link && { label: tr('Abrir enlace'), hint: link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 22), onClick: () => st.ui.open(link) },
      ok && col && col !== s.titleCol && ct !== 'auto' && st.canEditCol(col) && r.v[col] !== '' && r.v[col] !== false && { label: tr('Vaciar «') + col + '»', onClick: () => st.setCell(r.tab, r.id, col, ct === 'checkbox' ? false : '') },
      'sep',
      ok && st.can('deleteRows') && { label: tr('Eliminar'), hint: '', danger: true, onClick: () => { if (confirm(tr('¿Eliminar «{x}» del Sheet?', { x: title || tr('este elemento') }))) st.deleteRow(r.tab, r.id); } },
    ] };
  };
  const colMenu = ({ col }) => ({ title: col, items: [
    (st.can('manageColumns') || st.can('manageOptions')) && { label: tr('Editar columna…'), onClick: () => setColEdit(col) },
    { label: tr('Ordenar A → Z'), check: sort.col === col && sort.dir > 0, onClick: () => setSort({ col, dir: 1 }) },
    { label: tr('Ordenar Z → A'), check: sort.col === col && sort.dir < 0, onClick: () => setSort({ col, dir: -1 }) },
    sort.col && { label: tr('Quitar orden'), onClick: () => setSort({ col: '', dir: 1 }) },
    { label: tr('Filtrar por esta columna'), onClick: () => { setFilters([...filters, { col, op: optionsOf(st, col).length ? 'is' : 'has', val: '' }]); setFpop(true); } },
    col !== s.titleCol && { label: tr('Ocultar en esta vista'), onClick: () => setPrefs({ hidden: [...(prefs.hidden || []), col] }) },
    view === 'table' && (prefs.groupBy === col ? { label: tr('Quitar agrupación'), onClick: () => setPrefs({ groupBy: '' }) } : { label: tr('Agrupar por esta columna'), onClick: () => setPrefs({ groupBy: col }) }),
    view === 'table' && (prefs.freezeTo === col ? { label: tr('Quitar columnas fijas'), onClick: () => setPrefs({ freezeTo: '' }) } : { label: tr('Fijar columnas hasta aquí'), hint: tr('al desplazar de lado'), onClick: () => setPrefs({ freezeTo: col }) }),
    view === 'table' && prefs.freezeTo && prefs.freezeTo !== col && { label: tr('Quitar columnas fijas'), onClick: () => setPrefs({ freezeTo: '' }) },
    { label: tr('Alto de filas'), sub: rowHItems() },
    (prefs.widths || {})[col] && { label: tr('Restablecer ancho'), onClick: () => { const w = { ...prefs.widths }; delete w[col]; setPrefs({ widths: w }); } },
    'sep',
    st.can('manageColumns') && { label: tr('Insertar columna'), onClick: () => setAddCol({ name: '', type: 'text', all: true }) },
    st.can('manageColumns') && col !== s.titleCol && { label: tr('Eliminar columna del Sheet'), danger: true, onClick: () => { if (confirm(tr('¿Eliminar la columna «{x}» y todos sus datos del Sheet?', { x: col }))) st.deleteColumn(col); } },
  ] });
  const kcolMenu = (e, opt, fold) => { e.preventDefault(); e.stopPropagation();
    const setBg = v => { opt.colBg = v; st.saveConfig(); };
    setMenu({ x: e.clientX, y: e.clientY, title: tr('Columna «') + opt.v + '»', items: [
      { label: tr('Plegar columna'), onClick: () => fold(opt.v) },
      st.can('manageOptions') && 'sep',
      st.can('manageOptions') && { label: tr('Usar el color de la etiqueta'), check: opt.colBg === 'auto', onClick: () => setBg('auto') },
      st.can('manageOptions') && { label: tr('Color de la columna'), sub: COLBG.map(c => ({ label: COLBG_NAME[c], dot: c, check: (opt.colBg || '') === c, onClick: () => setBg(c) })) },
      st.can('manageOptions') && 'sep', st.can('manageOptions') && { label: tr('Aplicar el color de su etiqueta a todas las columnas'), onClick: () => { optionsOf(st, s.groupCol).forEach(o => { o.colBg = 'auto'; }); st.saveConfig(); } },
      st.can('manageOptions') && { label: tr('Quitar color a todas las columnas'), onClick: () => { optionsOf(st, s.groupCol).forEach(o => { o.colBg = ''; }); st.saveConfig(); } },
    ] }); };
  const [askFolder, setAskFolder] = [folderAsk, setFolderAsk];
  const gfolded = new Set(prefs.gfolded || []);
  const toggleFold = k => k.startsWith('g|') ? setPrefs({ gfolded: gfolded.has(k) ? [...gfolded].filter(x => x !== k) : [...gfolded, k] }) : setPrefs({ folded: folded.has(k) ? [...folded].filter(x => x !== k) : [...folded, k] });
  const folderItems = (tab, ids, curName) => { const fs = st.foldersOf(tab); return [...fs.map(f => ({ label: '📁 ' + f.name, check: curName === f.name, onClick: () => { if (curName !== f.name) st.moveToFolder(tab, ids, f.name); setSel(new Set()); } })), fs.length && 'sep', { label: tr('Nueva carpeta…'), onClick: () => setAskFolder({ tab, ids, name: '' }) }, curName !== undefined && curName !== null && curName !== '' && { label: tr('Sacar de la carpeta'), onClick: () => { st.moveToFolder(tab, ids, ''); setSel(new Set()); } }].filter(Boolean); };
  const pinned = new Set(prefs.pinFolders || []);
  const folderOps = { toggle: toggleFold, can: st.can('moveCards'), isPinned: k => pinned.has(k), newFolder: view === 'table' ? () => setAskFolder({ tab: cur === '*' ? tabs[0] : cur, ids: [], name: '' }) : null,
    drop: (h, from, id) => { if (h.group) { if (!st.canEditCol(h.col)) return; const r = st.allRows().find(x => x.id === id); if (r && S.tabs[r.tab].header.includes(h.col)) st.setCell(r.tab, id, h.col, st.type(h.col) === 'checkbox' ? h.name === '✓' : h.name, { move: h.col === s.groupCol }); return; } if (from !== h.tab) { st.toast(tr('Solo puedes meter en esta carpeta filas de la pestaña «{t}».', { t: h.tab }), 'error'); return; } st.moveToFolder(h.tab, [id], h.name); },
    rename: (h, v) => st.renameFolder(h.tab, h.name, v).then(n => { if (n && n !== h.name) { const nk = h.tab + '|' + n; if (folded.has(h.key)) setPrefs({ folded: [...folded].filter(x => x !== h.key).concat(nk) }); } return n; }),
    menu: (e, h, startRename) => { e.preventDefault(); e.stopPropagation(); const keys = (fold ? fold.heads : []).map(x => x.key);
      if (h.group) { setMenu({ x: e.clientX, y: e.clientY, title: (h.name || tr('(vacío)')) + ' · ' + h.col, items: [
        { label: h.closed ? tr('Expandir') : tr('Colapsar'), onClick: () => toggleFold(h.key) },
        { label: tr('Fijar nombre al desplazar'), check: pinned.has(h.key), onClick: () => setPrefs({ pinFolders: pinned.has(h.key) ? [...pinned].filter(k => k !== h.key) : [...pinned, h.key] }) }, 'sep',
        { label: tr('Colapsar todas'), onClick: () => setPrefs({ gfolded: [...new Set([...gfolded, ...keys])] }) },
        { label: tr('Expandir todas'), onClick: () => setPrefs({ gfolded: [...gfolded].filter(k => !keys.includes(k)) }) }, 'sep',
        { label: tr('Quitar agrupación'), onClick: () => setPrefs({ groupBy: '' }) }] }); return; }
      setMenu({ x: e.clientX, y: e.clientY, title: '📁 ' + h.name, items: [
        { label: h.closed ? tr('Expandir') : tr('Colapsar'), onClick: () => toggleFold(h.key) },
        { label: tr('Fijar nombre al desplazar'), hint: tr('solo esta carpeta'), check: pinned.has(h.key), onClick: () => setPrefs({ pinFolders: pinned.has(h.key) ? [...pinned].filter(k => k !== h.key) : [...pinned, h.key] }) },
        'sep',
        { label: tr('Colapsar todas'), onClick: () => setPrefs({ folded: [...new Set([...folded, ...keys])] }) },
        { label: tr('Expandir todas'), onClick: () => setPrefs({ folded: [...folded].filter(k => !keys.includes(k)) }) },
        st.can('moveCards') && 'sep',
        st.can('moveCards') && { label: tr('Renombrar carpeta'), hint: tr('Doble clic'), onClick: startRename },
        st.can('moveCards') && st.can('addRows') && h.tab && { label: tr('Nueva fila en esta carpeta'), onClick: () => { const id = st.addRow(h.tab, { [st.folderCol()]: h.name }); if (id) { if (folded.has(h.key)) toggleFold(h.key); st.moveToFolder(h.tab, [id], h.name); if (st.can('openPages')) setOpenId({ tab: h.tab, id }); } } },
        st.can('moveCards') && 'sep',
        st.can('moveCards') && { label: tr('Eliminar carpeta'), hint: tr('las filas se quedan'), danger: true, onClick: () => { if (confirm(tr('¿Eliminar la carpeta «{n}»?\n\nSus {c} filas NO se borran: se quedan en la pestaña, fuera de la carpeta.', { n: h.name, c: h.count }))) st.deleteFolder(h.tab, h.name); } },
      ] }); } };
  const cc = st.colorCol(), rowColorOf = cc ? r => ROWC[r.v[cc]] ? r.v[cc] : '' : null;
  const colorItems = (items, curC) => [...Object.keys(ROWC).map(k => ({ label: ROWC[k].label(), dot: k, check: curC === k, onClick: () => { st.setRowColor(items, k); setSel(new Set()); } })), 'sep', { label: tr('Sin color'), onClick: () => { st.setRowColor(items, ''); setSel(new Set()); } }];
  const onRowDrop = (d, target, after) => {
    if (gcol) { const h = fold.heads.find(x => x.key === (fold.info.get(target.id) || {}).key); if (h) folderOps.drop(h, d.tab, d.id); if (h && !sort.col && d.tab === target.tab) st.reorder(target.tab, d.id, target.id, after); return; }
    if (sort.col) { st.toast(tr('Para reacomodar arrastrando, quita el orden (Sin ordenar).'), 'error'); return; }
    if (d.tab !== target.tab) { if (st.can('moveTabs')) st.moveRow(d.tab, d.id, target.tab); return; }
    const info = fold && fold.info.get(target.id), name = info ? info.key.slice(target.tab.length + 1) : '';
    st.dropRow(target.tab, d.id, target.id, after, st.folderCol() ? name : undefined);
  };
  const rowHItems = () => [{ label: tr('Ajustar al contenido'), check: prefs.rowH !== 'compact', onClick: () => setPrefs({ rowH: '' }) }, { label: tr('Una sola línea (compacto)'), check: prefs.rowH === 'compact', onClick: () => setPrefs({ rowH: 'compact' }) }];
  const setAllOf = list => (col, val) => { st.setMany(list.filter(r => !r.tmp && S.tabs[r.tab].header.includes(col)).map(r => ({ tab: r.tab, id: r.id, col, val })), { move: col === s.groupCol }); };
  const valuesOf = (col, setAll) => { const ty = st.type(col); if (ty === 'checkbox') return [{ label: tr('Marcar'), onClick: () => setAll(col, true) }, { label: tr('Desmarcar'), onClick: () => setAll(col, false) }]; return [...optionsOf(st, col).map(o => ({ label: o.v, onClick: () => setAll(col, o.v) })), { label: tr('Vaciar'), onClick: () => setAll(col, '') }]; };
  // Menú para varias celdas o filas seleccionadas.
  const multiMenu = ({ rows: rs, cols: cs, cells, copy, clear, fromSel }) => {
    const list = rs.filter(r => !r.tmp), n = list.length, setAll = setAllOf(list), ids = list.map(r => r.id);
    const optCols = cs.filter(c => ['select', 'multi', 'person', 'checkbox'].includes(st.type(c)) && st.canEditCol(c));
    const anyHidden = ids.some(id => hiddenRows.has(id));
    return { title: cells ? tr('{c} celdas · {n} filas', { c: cells, n }) : tr('{n} filas seleccionadas', { n }), items: [
      copy && { label: tr('Copiar celdas'), hint: 'Ctrl+C', onClick: copy },
      clear && { label: tr('Vaciar celdas'), hint: tr('Supr'), onClick: clear },
      'sep',
      ...optCols.map(c => ({ label: tr('Cambiar «{c}» en todas', { c }), sub: valuesOf(c, setAll) })),
      st.can('editCells') && n > 0 && { label: tr('Color de fila'), sub: colorItems(list.map(r => ({ tab: r.tab, id: r.id })), null) },
      st.can('editPages') && n > 0 && { label: tr('Agregar checklist'), sub: st.checklists().map(c => ({ label: c.name, onClick: () => list.forEach(r => st.addChecklist(r.id, c.name, c.items)) })) },
      st.can('moveCards') && view === 'table' && new Set(list.map(r => r.tab)).size === 1 && n > 0 && { label: tr('Mover a carpeta'), sub: folderItems(list[0].tab, ids, (() => { const f = st.folderCol(); const v = new Set(list.map(r => f ? String(r.v[f] || '') : '')); return v.size === 1 ? [...v][0] : null; })()) },
      st.can('moveTabs') && { label: tr('Mover a pestaña'), sub: tabs.filter(t => S.tabs[t].idCol >= 0).map(t => ({ label: t, onClick: () => { list.forEach(r => r.tab !== t && st.moveRow(r.tab, r.id, t)); setSel(new Set()); } })) },
      'sep',
      anyHidden ? { label: tr('Volver a mostrar estas filas'), onClick: () => unhideRows(ids) } : { label: n === 1 ? tr('Ocultar fila') : tr('Ocultar {n} filas', { n }), hint: tr('solo en tu vista'), onClick: () => hideRows(ids) },
      !fromSel && n > 0 && { label: tr('Seleccionar estas filas'), onClick: () => setSel(new Set(ids)) },
      st.can('addRows') && { label: n === 1 ? tr('Duplicar') : tr('Duplicar {n} filas', { n }), onClick: () => { list.forEach(r => { const v = {}; Object.entries(r.v).forEach(([k, x]) => { if (st.type(k) !== 'auto' && x !== '' && x !== false) v[k] = x; }); v[s.titleCol] = (r.v[s.titleCol] || '') + tr(' (copia)'); st.addRow(r.tab, v, { page: (S.pages[r.id] || {}).md || '' }); }); setSel(new Set()); } },
      view === 'table' && { label: tr('Alto de filas'), sub: rowHItems() },
      'sep',
      st.can('deleteRows') && { label: n === 1 ? tr('Eliminar') : tr('Eliminar {n} filas', { n }), danger: true, onClick: () => { if (confirm(tr(n === 1 ? '¿Eliminar 1 elemento del Sheet?' : '¿Eliminar {n} elementos del Sheet?', { n }))) { list.forEach(r => st.deleteRow(r.tab, r.id)); setSel(new Set()); } } },
    ] };
  };
  const onMenu = (e, ctx) => { e.preventDefault(); e.stopPropagation(); const m = ctx.nums ? { title: tr('Números de fila'), items: [{ label: prefs.hideNums ? tr('Mostrar números de fila') : tr('Ocultar números de fila'), onClick: () => setPrefs({ hideNums: !prefs.hideNums }) }, { label: tr('Alto de filas'), sub: rowHItems() }] } : ctx.multi ? multiMenu(ctx) : ctx.row ? rowMenu(ctx) : colMenu(ctx); setMenu({ x: e.clientX, y: e.clientY, ...m }); };
  // Edición masiva desde la barra de selección
  const bulkMenu = (e, kind, list) => {
    const b = e.currentTarget.getBoundingClientRect(), at = { x: b.left, y: b.top - 8 };
    const setAll = (col, val) => { st.setMany(list.filter(r => S.tabs[r.tab].header.includes(col)).map(r => ({ tab: r.tab, id: r.id, col, val })), { move: col === s.groupCol }); };
    const valuesFor = col => { const ty = st.type(col); if (ty === 'checkbox') return [{ label: tr('Marcar'), onClick: () => setAll(col, true) }, { label: tr('Desmarcar'), onClick: () => setAll(col, false) }]; return [...optionsOf(st, col).map(o => ({ label: o.v, onClick: () => setAll(col, o.v) })), { label: tr('Vaciar'), onClick: () => setAll(col, '') }]; };
    let items;
    if (kind === 'group') items = valuesFor(s.groupCol);
    if (kind === 'set') items = baseCols.filter(c => ['select', 'multi', 'person', 'checkbox'].includes(st.type(c)) && st.canEditCol(c)).map(c => ({ label: c, sub: valuesFor(c) }));
    if (kind === 'move') items = tabs.filter(t => S.tabs[t].idCol >= 0).map(t => ({ label: t, onClick: () => { list.forEach(r => r.tab !== t && st.moveRow(r.tab, r.id, t)); setSel(new Set()); } }));
    setMenu({ x: at.x, y: Math.max(8, at.y - 32 * Math.min(10, items.length)), title: tr('{n} elementos', { n: list.length }), items });
  };
  const P = { st, rows, open, onNew, dups, onMenu, prefs, setPrefs, icons, presence: S.presence };
  const allProps = [...new Set(S.order.flatMap(t => S.tabs[t].header))].filter(h => h && h !== 'ID' && h !== s.titleCol && h !== st.folderCol() && h !== st.colorCol() && !st.hiddenCols().includes(h));
  const cardProps = view === 'gallery' ? (prefs.galleryProps || (s.groupCol ? [s.groupCol] : [])) : (prefs.cardProps || ['__img', ...defaultCardProps(st, [s.groupCol])]);
  const setCardProps = v => setPrefs(view === 'gallery' ? { galleryProps: v } : { cardProps: v });
  const doAddTab = async v => { const like = newTab && newTab.like ? newTab.like : cur !== '*' ? cur : undefined; if (st.tabNameError(v.trim())) { st.toast(st.tabNameError(v.trim()), 'error'); return false; } setNewTab(null); const n = await st.addTab(v, like); if (n) setTab(n); return true; };
  const doDeleteTab = async t => { const n = S.tabs[t].rows.length; if (!confirm(tr('¿Eliminar la pestaña «{t}» y sus {n} elementos?\n\nNo se borra nada de tu Google Sheet: la pestaña se oculta y puedes restaurarla cuando quieras desde Ajustes → Historial (o con Ctrl+Z).', { t, n }))) return; if (tab === t) setTab('*'); await st.deleteTab(t); };
  const doRename = async (old, v) => { v = v.trim(); if (!v || v === old) { setRenTab(null); return true; } const e = st.tabNameError(v, old); if (e) { st.toast(e, 'error'); return false; } setRenTab(null); const n = await st.renameTab(old, v); if (n && n !== old) { if (tab === old) setTab(n); setViews(views.map(x => x.tab === old ? { ...x, tab: n } : x)); } return true; };
  return <div class="app"><aside class="sidebar"><div class="proj click" onClick={onHome} title={tr("Cambiar de proyecto")}><span class="logo-row"><img src="icon.png" alt="" class="logo" /><span class="sm muted">Kuadro</span></span><b>{S.title || name}</b><span class="muted sm">{tr("Cambiar de proyecto")}</span></div>
    <button class={'nav' + (inbox ? ' on' : '')} onClick={() => setInbox(!inbox)}>🔔 {tr('Bandeja')}{unread > 0 ? <span class="badge">{unread}</span> : <span />}</button>
    <div class="nav-h">{tr("Pestañas")}</div><button class={'nav' + (cur === '*' ? ' on' : '')} onClick={() => setTab('*')}>{tr("Todos")}<span>{st.allRows().length}</span></button>
    {tabs.map(t => renTab && renTab.tab === t ? <TabNameInput key={'r' + t} initial={t} onCancel={() => setRenTab(null)} onSave={v => doRename(t, v)} />
      : <button class={'nav' + (cur === t ? ' on' : '') + (dropTab === t ? ' drop' : '')} onClick={() => setTab(t)} onDblClick={() => st.can('manageTabs') && setRenTab({ tab: t })}
      onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, title: t, items: [{ label: tr('Abrir'), onClick: () => setTab(t) }, st.can('manageTabs') && { label: tr('Renombrar pestaña'), hint: tr('Doble clic'), onClick: () => setRenTab({ tab: t }) }, st.can('manageTabs') && { label: tr('Nueva pestaña con estas columnas'), onClick: () => setNewTab({ like: t }) }, st.can('manageTabs') && 'sep', st.can('manageTabs') && { label: tr('Eliminar pestaña'), danger: true, disabled: tabs.length <= 1, onClick: () => doDeleteTab(t) }] }); }}
      onDragOver={e => { if (st.can('moveTabs') && e.dataTransfer.types.includes('text/plain')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dropTab !== t) setDropTab(t); } }} onDragLeave={() => setDropTab(null)}
      onDrop={e => { e.preventDefault(); setDropTab(null); const [from, id] = e.dataTransfer.getData('text/plain').split('|'); if (id && from !== t) { st.moveRow(from, id, t); if (openId && openId.id === id) setOpenId({ tab: t, id }); } }}>{t}<span>{S.tabs[t].rows.length}</span></button>)}
    {newTab !== null ? <TabNameInput placeholder={tr("Nombre de la pestaña…")} onCancel={() => setNewTab(null)} onSave={doAddTab} /> : st.can('manageTabs') && <button class="nav muted" onClick={() => setNewTab('')}>{tr("+ Nueva pestaña")}</button>}
    <div class="nav-h">{tr("Vistas guardadas")}</div>{views.map(v => <button class="nav" onClick={() => applyView(v)}>{v.name}<span class="x" title={tr("Quitar")} onClick={e => { e.stopPropagation(); setViews(views.filter(x => x !== v)); }}>✕</span></button>)}
    {vname === null ? <button class="nav muted" onClick={() => setVname('')}>{tr("+ Guardar vista actual")}</button> : <input class="nav-in" ref={af} placeholder={tr("Nombre de la vista…")} value={vname} onInput={e => setVname(e.target.value)} onBlur={() => setVname(null)} onKeyDown={e => { if (e.key === 'Enter' && vname.trim()) { setViews([...views, { name: vname.trim(), view, tab: cur, search, filters, sort, mine, prefs }]); setVname(null); } if (e.key === 'Escape') setVname(null); }} />}
    <span class="sp" /><button class="nav" onClick={() => { setPal(true); setPq(''); }}>{tr("Buscar")}<span>Ctrl K</span></button><button class="nav" onClick={() => setSettings('general')}>{tr("Ajustes")}</button>
    <div class="status"><i class={'dot ' + (S.authExpired ? 'c-red' : S.pending ? 'c-yellow' : 'c-green')} />{S.authExpired ? tr('Sesión caducada') : S.pending ? tr('Guardando…') : tr('Sincronizado ') + new Date(S.lastSync).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}<button class="icon" title={tr("Sincronizar ahora")} onClick={() => st.refresh()}>↻</button></div>
    <div class="me muted sm"><Avatar name={name_} size={18} /> {name_} · {(S.config.roles.find(r => r.id === (S.config.users.find(u => u.email.toLowerCase() === S.me.email.toLowerCase())?.roleId || S.config.defaultRoleId)) || {}).name || ''}{S.config.owner === S.me.email ? tr(' (dueño)') : ''}</div></aside>
    <main><div class="topbar"><div class="seg">{VIEWS.map(([k, l]) => <button class={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}</div>
      <input class="search" placeholder={tr("Buscar (también dentro de los guiones)…")} value={search} onInput={e => setSearch(e.target.value)} />
      <button class={'btn ib' + (filters.length ? ' on' : '')} data-k="filters" ref={fref} title={tr('Filtros')} aria-label={tr('Filtros')} onClick={() => setFpop(true)}><TI d={TICON.filter} />{filters.length ? <span class="ib-n">{filters.length}</span> : null}</button>
      <select class="btn" value={sort.col} onChange={e => setSort({ ...sort, col: e.target.value })}><option value="">{tr("Sin ordenar")}</option>{baseCols.map(c => <option value={c}>{tr('Ordenar:')} {c}</option>)}</select>
      {sort.col && <button class="btn" onClick={() => setSort({ ...sort, dir: -sort.dir })}>{sort.dir > 0 ? tr('A→Z') : tr('Z→A')}</button>}
      {view === 'table' && <button class={'btn ib' + ((prefs.hidden || []).length ? ' on' : '')} data-k="columns" ref={cref} title={(prefs.hidden || []).length ? tr('Columnas ({n} ocultas)', { n: (prefs.hidden || []).length }) : tr('Columnas')} aria-label={tr('Columnas')} onClick={() => setColsPop(true)}><TI d={TICON.columns} />{(prefs.hidden || []).length ? <span class="ib-n">({(prefs.hidden || []).length})</span> : null}</button>}
      {(view === 'kanban' || view === 'gallery') && <button class="btn ib" data-k="props" ref={cref} title={tr("Propiedades")} aria-label={tr("Propiedades")} onClick={() => setColsPop(true)}><TI d={TICON.props} /></button>}
      {people.length > 0 && <button class={'btn ib' + (mine ? ' on' : '')} data-k="mine" title={tr("Mostrar solo lo que tienes asignado y aún no está terminado")} onClick={() => setMine(!mine)}><TI d={TICON.tasks} /><span>{tr("Mis tareas")}</span></button>}<span class="sp" />
      {(st.can('addRows') || st.can('addCards')) && <button class="btn primary" onClick={() => onNew({}, !st.can('addRows'))}>{tr("+ Nuevo")}</button>}</div>
      {fpop && <Pop anchor={fref.current} onClose={() => setFpop(false)} width={460}><div class="filters">{filters.map((f, i) => { const up = p => setFilters(filters.map((x, j) => j === i ? { ...x, ...p } : x)); const o = optionsOf(st, f.col);
        return <div class="frow"><select value={f.col} onChange={e => up({ col: e.target.value, val: '' })}>{baseCols.map(c => <option>{c}</option>)}</select><select value={f.op} onChange={e => up({ op: e.target.value })}>{Object.entries(OPS).map(([k, l]) => <option value={k}>{l}</option>)}</select>
          {(f.op === 'is' || f.op === 'has') && (o.length && f.op === 'is' ? <select value={f.val} onChange={e => up({ val: e.target.value })}><option value="">(cualquiera)</option>{o.map(x => <option>{x.v}</option>)}</select> : <input value={f.val} placeholder="valor" onInput={e => up({ val: e.target.value })} />)}
          <button class="icon" onClick={() => setFilters(filters.filter((_, j) => j !== i))}>✕</button></div>; })}
        <button class="btn" onClick={() => setFilters([...filters, { col: s.groupCol || baseCols[0], op: 'is', val: '' }])}>{tr("+ Agregar filtro")}</button></div></Pop>}
      {colsPop && view === 'table' && <Pop anchor={cref.current} onClose={() => setColsPop(false)} width={300}><div class="ctx-t">{tr("Columnas visibles en esta vista")}</div>
        {ordered.map(c => <label class="pop-i chkrow"><input type="checkbox" disabled={c === s.titleCol} checked={!(prefs.hidden || []).includes(c)} onChange={e => setPrefs({ hidden: e.target.checked ? (prefs.hidden || []).filter(x => x !== c) : [...(prefs.hidden || []), c] })} /><span class="tyi">{ICON[st.type(c)]}</span>{c}</label>)}
        <div class="ctx-t">{tr("Agrupar por")}</div><div class="pad"><select style={{ width: '100%' }} value={prefs.groupBy || ''} onChange={e => setPrefs({ groupBy: e.target.value })}><option value="">{tr("(sin agrupar)")}</option>{baseCols.filter(c => ['select', 'multi', 'person', 'checkbox', 'text', 'date'].includes(st.type(c))).map(c => <option>{c}</option>)}</select></div>
        {prefs.freezeTo && <div class="pop-i" onClick={() => setPrefs({ freezeTo: '' })}>{tr("Quitar columnas fijas (hasta «{c}»)", { c: prefs.freezeTo })}</div>}
        <label class="pop-i chkrow"><input type="checkbox" checked={!prefs.hideNums} onChange={e => setPrefs({ hideNums: !e.target.checked })} />{tr("Mostrar números de fila")}</label>
        <div class="ctx-t">{tr("Alto de filas")}</div><div class="pad"><div class="seg sm-seg"><button class={prefs.rowH !== 'compact' ? 'on' : ''} onClick={() => setPrefs({ rowH: '' })}>{tr("Ajustar al contenido")}</button><button class={prefs.rowH === 'compact' ? 'on' : ''} onClick={() => setPrefs({ rowH: 'compact' })}>{tr("Una sola línea")}</button></div></div>
        <div class="pop-i muted" onClick={() => setPrefs({ hidden: [], order: [], widths: {} })}>{tr("Restablecer columnas (orden, ancho y visibles)")}</div>
        <p class="hint pad">{tr("Arrastra los encabezados para reordenar y su borde derecho para cambiar el ancho.")}</p></Pop>}
      {colsPop && (view === 'kanban' || view === 'gallery') && <Pop anchor={cref.current} onClose={() => setColsPop(false)} width={300}><div class="ctx-t">{view === 'kanban' ? tr('Qué muestran las tarjetas') : tr('Qué muestran las fichas')}</div>
        {view === 'kanban' && s.imageCol && <label class="pop-i chkrow"><input type="checkbox" checked={cardProps.includes('__img')} onChange={e => setCardProps(e.target.checked ? ['__img', ...cardProps] : cardProps.filter(x => x !== '__img'))} />{tr('Imagen')} ({s.imageCol})</label>}
        {allProps.filter(c => !(view === 'kanban' && c === s.groupCol) && st.type(c) !== 'image').map(c => <label class="pop-i chkrow"><input type="checkbox" checked={cardProps.includes(c)} onChange={e => setCardProps(e.target.checked ? [...cardProps, c] : cardProps.filter(x => x !== c))} /><span class="tyi">{ICON[st.type(c)]}</span>{c}</label>)}
        {view === 'kanban' && <><div class="ctx-t">{tr("Carriles (filas del tablero)")}</div><div class="pad"><select value={prefs.lane || ''} onChange={e => setPrefs({ lane: e.target.value })}><option value="">{tr("Sin carriles")}</option>{allProps.filter(c => ['select', 'person', 'multi'].includes(st.type(c)) && c !== s.groupCol).map(c => <option>{c}</option>)}</select></div>
          {(prefs.collapsed || []).length > 0 && <div class="pop-i muted" onClick={() => setPrefs({ collapsed: [] })}>{tr("Desplegar todas las columnas")}</div>}</>}
        {view === 'gallery' && <><div class="ctx-t">{tr("Tamaño de las fichas")}</div><div class="pad seg sm-seg">{[['s', tr('Chico')], ['m', tr('Mediano')], ['l', tr('Grande')]].map(([k, l]) => <button class={(prefs.gallerySize || 'm') === k ? 'on' : ''} onClick={() => setPrefs({ gallerySize: k })}>{l}</button>)}</div></>}</Pop>}
      {!S.prepared && <div class="banner">{tr("Este Sheet aún no está preparado para la app: falta la columna ID y las pestañas ocultas de configuración. Mientras tanto es de solo lectura.")}{' '}<button class="btn primary" onClick={() => st.prepare()}>{tr("Preparar este Sheet")}</button></div>}
      {S.authExpired && <div class="banner">{tr("Tu sesión de Google caducó; tus cambios no se guardarán hasta que vuelvas a entrar. ")}<button class="btn primary" onClick={() => st.ui.relogin()}>{tr("Volver a iniciar sesión")}</button></div>}
      {S.readOnly && <div class="banner">{tr("Tu cuenta de Google solo tiene permiso de lectura en este Sheet.")}</div>}
      {hiddenHere > 0 && <div class="hidbar">{prefs.showHidden ? tr('Mostrando {n} filas ocultas (en gris).', { n: hiddenHere }) : tr(hiddenHere === 1 ? '1 fila oculta en tu vista.' : '{n} filas ocultas en tu vista.', { n: hiddenHere })}
        <button class="mini" onClick={() => setPrefs({ showHidden: !prefs.showHidden })}>{prefs.showHidden ? tr('Volver a ocultarlas') : tr('Ver')}</button>
        <button class="mini" onClick={() => setPrefs({ hiddenRows: (prefs.hiddenRows || []).filter(id => !st.allRows(cur === '*' ? null : cur).some(r => r.id === id)), showHidden: false })}>{tr('Mostrar todas de nuevo')}</button></div>}
      <div class="body">{view === 'table' && <TableView {...P} rows={rows} fold={fold} folderOps={folderOps} onRowDrop={onRowDrop} colorOf={rowColorOf} hiddenRows={prefs.showHidden ? hiddenRows : null} cols={tableCols} onCol={setColEdit} onAddCol={() => setAddCol({ name: '', type: 'text', all: true })} sel={sel} setSel={setSel} />}{view === 'kanban' && <KanbanView {...P} sorted={!!sort.col} onColMenu={kcolMenu} />}{view === 'gallery' && <GalleryView {...P} />}{view === 'calendar' && <CalendarView {...P} />}{view === 'dash' && <DashView {...P} />}</div>
      {view === 'table' && <BulkBar st={st} rows={rows} sel={sel} setSel={setSel} onMenuAt={bulkMenu} />}</main>
    {inbox && <Inbox st={st} items={items} seen={seen} open={open} onClose={() => { setInbox(false); markSeen(); }} onSeen={markSeen} />}
    {openRow && <RowPage key={openRow.id} st={st} row={openRow} dup={dups.has(openRow.id)} onClose={() => setOpenId(null)} onMoved={to => setOpenId({ tab: to, id: openRow.id })} />}
    {settings && <Settings st={st} start={settings} onClose={() => setSettings(null)} onCol={setColEdit} onAddCol={() => setAddCol({ name: '', type: 'text', all: true })} />}
    {colEdit && <ColumnEditor st={st} col={colEdit} onClose={() => setColEdit(null)} />}
    {addCol && <Modal title={tr("Nueva columna")} onClose={() => setAddCol(null)}><label class="f">{tr("Nombre")}<input ref={af} value={addCol.name} onInput={e => setAddCol({ ...addCol, name: e.target.value })} /></label>
      <label class="f">{tr("Tipo")}<select value={addCol.type} onChange={e => setAddCol({ ...addCol, type: e.target.value })}>{Object.entries(TYPES).map(([k, l]) => <option value={k}>{l}</option>)}</select></label>
      {cur !== '*' && tabs.length > 1 && <label class="chk"><input type="checkbox" checked={addCol.all} onChange={e => setAddCol({ ...addCol, all: e.target.checked })} />{tr("Agregar en todas las pestañas")}</label>}
      <div class="row-end"><button class="btn primary" onClick={() => { if (addCol.name.trim()) { st.addColumn(addCol.name, addCol.type, addCol.all || cur === '*' ? S.order : [cur]); setAddCol(null); } }}>{tr("Crear columna")}</button></div></Modal>}
    {folderAsk && <Modal title={tr("Nueva carpeta")} onClose={() => setFolderAsk(null)}><FolderForm st={st} ask={folderAsk} onDone={() => { setFolderAsk(null); if (folderAsk.ids && folderAsk.ids.length) setSel(new Set()); }} /></Modal>}
      {tplAsk && <Modal title={tr("Nuevo elemento")} onClose={() => setTplAsk(null)}><div class="lrow click" onClick={() => { create(tplAsk.values, tplAsk.card); setTplAsk(null); }}><b>{tr("En blanco")}</b></div>{S.config.templates.map(t => <div class="lrow click" onClick={() => { create(tplAsk.values, tplAsk.card, t); setTplAsk(null); }}><b>{t.name}</b><span class="muted">{tr("Plantilla")}</span></div>)}</Modal>}
    {pal && <div class="overlay top" onMouseDown={e => { if (e.target === e.currentTarget) setPal(false); }}><div class="palette"><input ref={af} placeholder={tr("Buscar en títulos y guiones de todas las pestañas…")} value={pq} onInput={e => { setPq(e.target.value); setPhi(0); }}
      onKeyDown={e => { if (e.key === 'Escape') setPal(false); if (e.key === 'ArrowDown') { e.preventDefault(); setPhi(Math.min(phi + 1, pAll.length - 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setPhi(Math.max(phi - 1, 0)); } if (e.key === 'Enter' && pAll[phi]) { open(pAll[phi].row); setPal(false); } }} />
      {pAll.map((x, i) => <div class={'pop-i pal-i' + (i === phi ? ' hi' : '')} onMouseEnter={() => setPhi(i)} onClick={() => { open(x.row); setPal(false); }}><div class="grow"><div>{icons[x.row.id] && <span class="ticon">{icons[x.row.id]}</span>}{x.row.v[s.titleCol] || tr('Sin título')}</div>{x.snippet && <div class="muted sm">…{x.snippet}…</div>}</div><span class="muted sm">{x.row.tab}{s.groupCol && x.row.v[s.groupCol] ? ' · ' + x.row.v[s.groupCol] : ''}</span></div>)}
      {!pq.trim() && VIEWS.map(([k, l]) => <div class="pop-i" onClick={() => { setView(k); setPal(false); }}>{tr('Ir a {x}', { x: l })}</div>)}{pq.trim() && !pAll.length && <div class="pop-empty">{tr("Sin resultados.")}</div>}</div></div>}
    {S.conflicts[0] && <Modal title={tr("Cambio en conflicto")} onClose={() => st.resolveConflict(S.conflicts[0], false)}><p>{tr('Alguien cambió «{c}» de «{x}» en el Sheet mientras lo editabas.', { c: S.conflicts[0].col, x: S.conflicts[0].title })}</p>
      <p>{tr("En el Sheet:")}{' '}<b>{String(S.conflicts[0].theirs) || tr('(vacío)')}</b><br />{tr("Tu cambio:")}{' '}<b>{String(S.conflicts[0].mine) || tr('(vacío)')}</b></p>
      <div class="row-end"><button class="btn" onClick={() => st.resolveConflict(S.conflicts[0], false)}>{tr("Conservar el del Sheet")}</button><button class="btn primary" onClick={() => st.resolveConflict(S.conflicts[0], true)}>{tr("Usar mi cambio")}</button></div></Modal>}
    {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    <div class="toasts">{S.toasts.map(t => <div class={'toast ' + t.kind}>{t.msg}</div>)}</div></div>;
}

const sheetIdOf = u => { const m = String(u).match(/\/spreadsheets\/d\/([\w-]{20,})/); return m ? m[1] : (/^[\w-]{30,}$/.test(String(u).trim()) ? String(u).trim() : null); };
function Home({ user, setUser, projects, setProjects, onOpen }) {
  const [creds, setCreds] = useState({ clientId: '', clientSecret: '' }), [has, setHas] = useState(false), [url, setUrl] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [help, setHelp] = useState(false);
  useEffect(() => { native && native.creds().then(c => { setHas(c.has); setCreds({ clientId: c.clientId || '', clientSecret: '' }); }); }, []);
  const login = async () => { setErr(''); setBusy(true); try { setUser(await native.login(has && !creds.clientSecret ? null : creds)); setHas(true); } catch (e) { setErr(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); } setBusy(false); };
  const add = () => { const id = sheetIdOf(url); if (!id) { setErr(tr('Ese enlace no parece de Google Sheets.')); return; } if (!projects.some(p => p.sheetId === id)) setProjects([...projects, { id: newId(), sheetId: id, name: tr('Proyecto') + ' ' + (projects.length + 1) }]); setUrl(''); setErr(''); };
  return <div class="home"><div class="home-top"><LangPicker compact /></div><div class="brand"><img src="icon.png" alt="" /><h1>Kuadro</h1></div><p class="muted">{tr("Tablas, kanban, galería, calendario y páginas sobre tus Google Sheets.")}</p>
    {native && !user && <div class="box"><h3>{tr("Conecta tu cuenta de Google")}</h3><p class="hint">{tr("La primera vez necesitas una credencial gratuita de Google Cloud (tipo «App de escritorio»).")}{' '}<a href="#" onClick={e => { e.preventDefault(); setHelp(true); }}>{tr("Cómo obtenerla")}</a></p>
      <label class="f">{tr("ID de cliente")}<input value={creds.clientId} onInput={e => setCreds({ ...creds, clientId: e.target.value.trim() })} placeholder="…apps.googleusercontent.com" /></label>
      <label class="f">{tr("Secreto de cliente")}<input type="password" value={creds.clientSecret} onInput={e => setCreds({ ...creds, clientSecret: e.target.value.trim() })} placeholder={has ? '(guardado)' : 'GOCSPX-…'} /></label>
      <button class="btn primary" disabled={busy || !creds.clientId || (!has && !creds.clientSecret)} onClick={login}>{busy ? tr('Esperando a Google en tu navegador…') : tr('Iniciar sesión con Google')}</button></div>}
    {user && <div class="box"><h3>{tr("Tus proyectos")}</h3><p class="hint">{tr('Sesión:')} {user.name} ({user.email}) · <a href="#" onClick={e => { e.preventDefault(); native.logout().then(() => setUser(null)); }}>{tr("Cerrar sesión")}</a></p>
      {projects.map(p => <div class="lrow"><b class="grow click" onClick={() => onOpen(p.id)}>{p.name}</b><span class="muted sm">{p.sheetId.slice(0, 10)}…</span><button class="btn primary" onClick={() => onOpen(p.id)}>{tr("Abrir")}</button><button class="icon" title={tr("Quitar de la lista (no borra el Sheet)")} onClick={() => setProjects(projects.filter(x => x !== p))}>✕</button></div>)}
      {!projects.length && <p class="muted">{tr("Aún no agregas ningún Sheet.")}</p>}
      <div class="lrow"><input class="grow" placeholder={tr("Pega el enlace de un Google Sheet…")} value={url} onInput={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} /><button class="btn" onClick={add}>{tr("Agregar proyecto")}</button></div></div>}
    {err && <div class="warn">{err}</div>}
    <div class="box"><h3>{tr("Proyecto de demostración")}</h3><p class="hint">{tr("Datos de ejemplo guardados solo en esta computadora; no toca ningún Sheet.")}</p><button class="btn" onClick={() => onOpen('demo')}>{tr("Abrir demostración")}</button> <button class="btn" onClick={() => { localStorage.removeItem('demo-data-' + LANG); }}>{tr("Restablecer datos de demo")}</button></div>
    {native && native.updateState && <HomeVersion />}
    {help && <Modal title={tr("Credencial de Google (una sola vez)")} onClose={() => setHelp(false)}><ol class="steps"><li>{tr("Entra a console.cloud.google.com y crea un proyecto.")}</li><li>{tr("En «APIs y servicios → Biblioteca» habilita")}{' '}<b>{tr("Google Sheets API")}</b> y <b>{tr("Google Drive API")}</b>.</li>
      <li>{tr("En «Pantalla de consentimiento de OAuth» elige tipo Externo, pon un nombre y tu correo, y luego publica la app («En producción») para que las sesiones no caduquen cada semana.")}</li>
      <li>{tr("En «Credenciales → Crear credenciales → ID de cliente de OAuth» elige")}{' '}<b>{tr("App de escritorio")}</b>.</li><li>{tr("Copia el ID de cliente y el secreto aquí. Tu equipo usa los mismos dos datos.")}</li></ol>
      <p class="hint">{tr("Google mostrará un aviso de «app no verificada» al iniciar sesión; se continúa desde «Configuración avanzada».")}</p></Modal>}</div>;
}

function App() {
  const [appear, setAppearS] = useState(() => ({ ...APPEAR0, ...LS.get('appearance', {}) })); const setAppear = v => { setAppearS(v); try { localStorage.setItem('appearance', JSON.stringify(v)); } catch { alert(tr('La imagen es demasiado grande para guardarse; prueba con otra más pequeña.')); } };
  useEffect(() => { const ap = () => { const r = document.documentElement; Object.entries(appearStyle(appear)).forEach(([k, v]) => r.style.setProperty(k, v)); document.body.classList.toggle('has-img', !!appear.image); document.body.classList.toggle('light', isLight(appear) && !appear.image); }; ap(); const mq = matchMedia('(prefers-color-scheme: light)'); mq.addEventListener('change', ap); return () => mq.removeEventListener('change', ap); }, [appear]);
  const [user, setUser] = useState(null), [projects, setP] = useState(LS.get('projects', [])), [cur, setCur] = useState(LS.get('current', null)), [st, setSt] = useState(null), [boot, setBoot] = useState(!!native);
  const appearRef = useRef(appear), appearSet = useRef(setAppear); appearRef.current = appear; appearSet.current = setAppear;
  const setProjects = p => { setP(p); LS.set('projects', p); };
  useEffect(() => { if (native) native.status().then(u => { setUser(u); setBoot(false); }).catch(() => setBoot(false)); }, []);
  useEffect(() => {
    LS.set('current', cur); if (!cur || boot) { setSt(null); return; }
    let api, me; const demo = cur === 'demo';
    if (demo) { api = new MockSheets(LS.get('demo-data-' + LANG, null) || JSON.parse(JSON.stringify(LANG === 'es' ? demoEs : demoEn)), d => LS.set('demo-data-' + LANG, d)); me = { email: 'demo@hojabase.app', name: tr('Tú') }; }
    else { const p = projects.find(p => p.id === cur); if (!p || !user) { setCur(null); return; } api = new GoogleSheets(p.sheetId, force => native.token(!!force), async (url, o) => { const r = await native.fetch(url, o); return { ...r, json: async () => JSON.parse(r.text || '{}') }; }); me = user; }
    const s = createStore(api, me, { notify: (t, b) => native ? native.notify(t, b) : null });
    const toBytes = async f => new Uint8Array(await f.arrayBuffer());
    const folderFor = async () => { const k = 'folder:' + me.email + ':' + cur; let folder = LS.get(k, null); if (!folder) { folder = await api.ensureFolder(tr('Imágenes · ') + (s.S.title || 'Kuadro')); LS.set(k, folder); } return folder; };
    s.ui = { appear: () => appearRef.current, setAppear: v => appearSet.current(v),
      uploadFile: async f => { try { s.toast(tr('Subiendo imagen…')); return await api.uploadImage(await toBytes(f), f.name || 'imagen.png', f.type || 'image/png', await folderFor()); } catch (e) { s.toast(tr('No se pudo subir la imagen: ') + e.message, 'error'); return null; } },
      uploadPick: async () => { const f = await native.pickImage(); if (!f) return null; try { s.toast(tr('Subiendo imagen…')); return await api.uploadImage(f.bytes, f.name, f.mime, await folderFor()); } catch (e) { s.toast(tr('No se pudo subir la imagen: ') + e.message, 'error'); return null; } },
      relogin: async () => { try { const u = await native.login(null); if (u) { s.S.authExpired = false; s.S.readOnly = false; s.emit(); s.toast(tr('Sesión renovada')); if (s.S.status === 'error') s.init(); else s.refresh(); } } catch (e) { s.toast(tr('No se pudo iniciar sesión: ') + String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'error'); } },
      open: u => { if (/^https?:\/\//.test(u || '')) native ? native.open(u) : window.open(u, '_blank'); }, canUpload: !!native && !demo,
      upload: async (row, col) => { const u = await s.ui.uploadPick(); if (u) s.setCell(row.tab, row.id, col, u); },
      yt: async (u, key) => { try { const get = x => native ? native.json(x) : fetch(x).then(r => r.json()); const d = await get('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u)); const out = { title: d.title, author: d.author_name }; if (key) { try { const v = await get(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ytId(u)}&key=${encodeURIComponent(key)}`); out.views = v.items?.[0]?.statistics?.viewCount; } catch { } } return out; } catch { return {}; } },
    };
    s.init().then(() => { if (!demo && s.S.title) { const p = projects.find(p => p.id === cur); if (p && p.name !== s.S.title) setProjects(projects.map(x => x === p ? { ...x, name: s.S.title } : x)); } if (demo && !s.S.prepared) s.prepare(); });
    setSt(s); const iv = setInterval(() => { if (!document.hidden && s.S.status === 'ready' && !s.S.pending) s.refresh(); }, demo ? 60000 : 15000);
    return () => clearInterval(iv);
  }, [cur, boot, user && user.email]);
  if (boot) return <div class="center">{tr("Cargando…")}</div>;
  const banner = native && native.updateState ? <UpdateBanner /> : null;
  if (!cur || !st) return <>{banner}<Home user={user} setUser={setUser} projects={projects} setProjects={setProjects} onOpen={setCur} /></>;
  return <>{banner}<Workspace key={cur} st={st} name={cur} onHome={() => setCur(null)} /></>;
}
document.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea, .prose, [contenteditable]')) e.preventDefault(); });
render(<App />, document.getElementById('root'));
if (!native) window.__LS = LS;
