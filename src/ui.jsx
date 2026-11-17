import { useState, useEffect, useRef } from 'preact/hooks';
import { TYPES, COLORS, pickColor } from './store.js';
import { urls, imgSrc, fmtDate } from './util.js';
import { t as tr } from './i18n.js';

// El atributo autofocus solo funciona una vez por documento; se enfoca a mano al montar.
export const af = el => { if (el && !el.dataset.af) { el.dataset.af = '1'; el.focus(); } };
export function useStore(st) { const [, f] = useState(0); useEffect(() => { f(x => x + 1); return st.subscribe(() => f(x => x + 1)); }, [st]); return st.S; }
export const Chip = ({ v, color }) => <span class={'chip c-' + (color || 'gray')}>{v}</span>;
export const splitMulti = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);

export function Pop({ anchor, onClose, children, width = 250 }) {
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); }; const k = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);
  const r = anchor.getBoundingClientRect(); const left = Math.max(8, Math.min(r.left, innerWidth - width - 8)); const below = innerHeight - r.bottom > 260 || r.top < 260;
  const style = below ? { left, top: r.bottom + 4, width, maxHeight: innerHeight - r.bottom - 12 } : { left, bottom: innerHeight - r.top + 4, width, maxHeight: r.top - 12 };
  // Preact 11 ya no agrega «px» a los números: se convierten aquí.
  const css = Object.fromEntries(Object.entries(style).map(([k, v]) => [k, typeof v === 'number' ? v + 'px' : v]));
  return <div ref={ref} class="pop" style={css} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} onCopy={e => e.stopPropagation()} onPaste={e => e.stopPropagation()}>{children}</div>;
}
export function Modal({ title, onClose, children, wide, cls }) {
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  return <div class="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div class={'modal' + (wide ? ' wide' : '') + (cls ? ' ' + cls : '')}><div class="modal-h"><b>{title}</b><button class="icon" onClick={onClose} aria-label={tr("Cerrar")}>✕</button></div><div class="modal-b">{children}</div></div></div>;
}

export const optionsOf = (st, col) => { const sc = st.S.config.schema[col] || {}; return sc.type === 'person' ? st.S.config.users.filter(u => !sc.roleId || u.roleId === sc.roleId).map(u => ({ v: u.name, color: 'blue' })) : (sc.options || []); };
export const colorOf = (st, col, v) => (optionsOf(st, col).find(o => o.v === v) || {}).color || 'gray';

function Options({ st, col, vals, multi, onPick }) {
  const [qy, setQ] = useState(''), [hi, setHi] = useState(0); const sc = st.S.config.schema[col] || {}; const opts = optionsOf(st, col);
  const shown = opts.filter(o => o.v.toLowerCase().includes(qy.toLowerCase())); const canNew = sc.type !== 'person' && st.can('manageOptions') && qy.trim() && !opts.some(o => o.v.toLowerCase() === qy.trim().toLowerCase());
  const create = () => { const v = qy.trim(); sc.options = [...(sc.options || []), { v, color: pickColor(v, (sc.options || []).length) }]; st.saveConfig(); onPick(v); setQ(''); };
  return <div>
    <input class="pop-q" ref={af} placeholder={sc.type === 'person' ? tr('Buscar persona…') : tr('Buscar o crear opción…')} value={qy} onInput={e => { setQ(e.target.value); setHi(0); }}
      onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(hi + 1, shown.length - 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(hi - 1, 0)); } if (e.key === 'Enter') { if (shown[hi]) onPick(shown[hi].v); else if (canNew) create(); } }} />
    {shown.map((o, i) => <div class={'pop-i' + (i === hi ? ' hi' : '')} onMouseEnter={() => setHi(i)} onClick={() => onPick(o.v)}><Chip v={o.v} color={o.color} />{vals.includes(o.v) && <span class="check">✓</span>}</div>)}
    {canNew && <div class="pop-i" onClick={create}>{tr("Crear")}{' '}<Chip v={qy.trim()} color="gray" /></div>}
    {!shown.length && !canNew && <div class="pop-empty">{sc.type === 'person' ? tr('Agrega personas en Ajustes → Usuarios.') : tr('Sin opciones.')}</div>}
    {!multi && vals.length > 0 && <div class="pop-i muted" onClick={() => onPick('')}>{tr("Quitar valor")}</div>}
  </div>;
}

// Celda editable. En la tabla (props «table»): un clic selecciona, la celda activa se edita con clic, Enter o tecleando.
// «signal» = { n, text } pide empezar a editar (text: lo tecleado, que reemplaza el contenido).
export function Field({ st, row, col, big, table, active, signal, onDone, guard, onConsumed }) {
  const ty = st.type(col), v = row.v[col], ed = !row.tmp && st.canEditCol(col);
  const [open, setOpen] = useState(false), [editing, setEditing] = useState(false), [draft, setDraft] = useState(''); const ref = useRef(), fresh = useRef(false);
  const set = val => st.setCell(row.tab, row.id, col, val);
  const done = dir => { onDone && onDone(dir); };
  const start = text => {
    if (!ed) return;
    if (ty === 'checkbox') { set(!v); return; }
    if (ty === 'select' || ty === 'multi' || ty === 'person') { setOpen(true); return; }
    setDraft(text != null ? text : String(v ?? '')); fresh.current = text != null; setEditing(true);
  };
  useEffect(() => { if (signal && signal.n) { onConsumed && onConsumed(); start(signal.text); } }, [signal && signal.n]);
  const canClickNow = () => !table || (active && !(guard && guard()));
  if (ty === 'checkbox') return <input type="checkbox" checked={!!v} disabled={!ed} onChange={e => set(e.target.checked)} />;
  if (ty === 'auto') return <span class="muted">{v}</span>;
  if (ty === 'select' || ty === 'multi' || ty === 'person') {
    const vals = ty === 'multi' ? splitMulti(v) : (v ? [String(v)] : []);
    const pick = x => { if (ty === 'multi') set((vals.includes(x) ? vals.filter(y => y !== x) : [...vals, x]).join(', ')); else { set(x === v ? '' : x); setOpen(false); done(table ? 'stay' : null); } };
    return <div class={'cellbtn' + (ed ? ' ed' : '')} ref={ref} onClick={() => ed && canClickNow() && setOpen(true)}>
      {vals.map(x => <Chip v={x} color={colorOf(st, col, x)} />)}{!vals.length && <span class="ph">{big && ed ? tr('Vacío') : ''}</span>}
      {open && <Pop anchor={ref.current} onClose={() => { setOpen(false); done('stay'); }}><Options st={st} col={col} vals={vals} multi={ty === 'multi'} onPick={pick} /></Pop>}
    </div>;
  }
  const keys = (e, commit) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); done('down'); }
    else if (e.key === 'Tab') { e.preventDefault(); commit(); done(e.shiftKey ? 'left' : 'right'); }
    else if (e.key === 'Escape') { setEditing(false); done('stay'); }
    e.stopPropagation();
  };
  if (ty === 'date') return editing ? <input type="date" class="date" ref={af} value={v || ''} onChange={e => set(e.target.value)} onBlur={() => setEditing(false)} onKeyDown={e => keys(e, () => setEditing(false))} />
    : <div class={'cellbtn' + (ed ? ' ed' : '')} onClick={() => ed && canClickNow() && start()}>{v ? fmtDate(v) : <span class="ph">{big && ed ? tr('Vacío') : ''}</span>}</div>;
  const commit = () => { setEditing(false); if (draft !== String(v ?? '')) set(ty === 'text' ? draft : draft.trim()); };
  if (editing) return <textarea class="edit" ref={af} rows={big || ty !== 'number' ? Math.min(6, Math.max(1, Math.ceil(draft.length / 60))) : 1} value={draft} onInput={e => setDraft(e.target.value)} onBlur={commit}
    onFocus={e => { if (fresh.current) { const n = e.target.value.length; e.target.setSelectionRange(n, n); } else e.target.select(); }} onKeyDown={e => keys(e, commit)} onCopy={e => e.stopPropagation()} onPaste={e => e.stopPropagation()} />;
  if (ty === 'image') {
    const src = imgSrc(v);
    return <div class="imgcell">{src ? <img src={src} loading="lazy" onClick={() => st.ui.open(urls(v)[0])} /> : <span class="ph">{big && ed ? tr('Sin imagen') : ''}</span>}
      {ed && <span class="imgbtns">{st.can('upload') && st.ui.canUpload && <button class="mini" onClick={() => st.ui.upload(row, col)}>{tr("Subir")}</button>}<button class="mini" onClick={() => start()}>{v ? tr('Cambiar enlace') : tr('Pegar enlace')}</button></span>}</div>;
  }
  if (ty === 'url' && v) return <div class="urls">{urls(v).map(u => <a href={u} onClick={e => { e.preventDefault(); st.ui.open(u); }}>{u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 44)}</a>)}{!urls(v).length && <span>{v}</span>}{ed && <button class="mini" onClick={() => start()}>{tr("Editar")}</button>}</div>;
  return <div class={'cellbtn txt' + (ed ? ' ed' : '')} onClick={() => canClickNow() && start()}>{v !== '' && v != null ? String(v) : <span class="ph">{big && ed ? tr('Vacío') : ''}</span>}</div>;
}

export function ColumnEditor({ st, col, onClose }) {
  const S = st.S, sc = S.config.schema[col] || (S.config.schema[col] = { type: 'text' });
  const [name, setName] = useState(col), [nu, setNu] = useState(''), [, tick] = useState(0); const re = () => tick(x => x + 1);
  const hasOpts = sc.type === 'select' || sc.type === 'multi';
  const setType = t => {
    sc.type = t;
    if ((t === 'select' || t === 'multi') && !(sc.options || []).length) { const seen = []; st.allRows().forEach(r => (t === 'multi' ? splitMulti(r.v[col]) : [String(r.v[col] ?? '')]).forEach(x => { if (x && x !== 'false' && !seen.includes(x)) seen.push(x); })); sc.options = seen.slice(0, 60).map((v, i) => ({ v, color: pickColor(v, i) })); }
    st.saveConfig().then(() => st.refresh()); re();
  };
  const addOpt = () => { const v = nu.trim(); if (!v || (sc.options || []).some(o => o.v === v)) return; sc.options = [...(sc.options || []), { v, color: pickColor(v, (sc.options || []).length) }]; setNu(''); st.saveConfig(); };
  const canCols = st.can('manageColumns'), canOpts = st.can('manageOptions');
  return <Modal title={tr('Columna:') + ' ' + col} onClose={onClose}>
    <label class="f">{tr("Nombre")}<input value={name} disabled={!canCols} onInput={e => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== col) { st.renameColumn(col, name); onClose(); } }} /></label>
    <label class="f">{tr("Tipo")}<select value={sc.type} disabled={!canCols} onChange={e => setType(e.target.value)}>{Object.entries(TYPES).map(([k, l]) => <option value={k}>{l}</option>)}</select></label>
    {sc.type === 'person' && <label class="f">{tr("Solo personas con el rol")}<select value={sc.roleId || ''} disabled={!canCols} onChange={e => { sc.roleId = e.target.value; st.saveConfig(); re(); }}><option value="">{tr("Cualquiera")}</option>{S.config.roles.map(r => <option value={r.id}>{r.name}</option>)}</select></label>}
    {hasOpts && <label class="f">{tr("Valor por defecto")}<select value={sc.default || ''} disabled={!canOpts} onChange={e => { sc.default = e.target.value; st.saveConfig().then(() => st.autoFill()); re(); }}><option value="">(ninguno)</option>{(sc.options || []).map(o => <option>{o.v}</option>)}</select>
      <span class="hint">{tr("Las filas nuevas y las que estén vacías en esta columna toman este valor automáticamente.")}</span></label>}
    {hasOpts && <div class="f">Opciones
      {(sc.options || []).map((o, i) => <div class="optrow" key={i + o.v}>
        <button class={'dot c-' + o.color} disabled={!canOpts} title={tr("Cambiar color")} onClick={() => { o.color = COLORS[(COLORS.indexOf(o.color) + 1) % COLORS.length]; st.saveConfig(); }} />
        <input value={o.v} disabled={!canOpts} onBlur={e => { if (e.target.value.trim() && e.target.value !== o.v) st.renameOption(col, o.v, e.target.value); }} onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
        <button class="icon" disabled={!canOpts || i === 0} title={tr("Subir")} onClick={() => { const a = sc.options; [a[i - 1], a[i]] = [a[i], a[i - 1]]; st.saveConfig(); }}>↑</button>
        <button class="icon" disabled={!canOpts} title={tr("Quitar opción")} onClick={() => { sc.options = sc.options.filter(x => x !== o); st.saveConfig(); }}>✕</button></div>)}
      {canOpts && <div class="optrow"><input placeholder={tr("Nueva opción…")} value={nu} onInput={e => setNu(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOpt()} /><button class="btn" onClick={addOpt}>{tr("Agregar")}</button></div>}
      <p class="hint">{tr("Renombrar una opción la cambia también en todas las filas que la usan. Quitarla no borra el valor de las celdas.")}</p></div>}
    {canCols && <div class="row-end"><button class="btn danger" onClick={() => { if (confirm(tr('¿Eliminar la columna «{x}» y todos sus datos del Sheet?', { x: col }))) { st.deleteColumn(col); onClose(); } }}>{tr("Eliminar columna")}</button></div>}
  </Modal>;
}

export { RichEditor } from './editor.jsx';
