// Editor de automatizaciones: CUANDO <algo pasa> · SI <condiciones> · ENTONCES <acciones>.
import { useState } from 'preact/hooks';
import { Modal, optionsOf } from './ui.jsx';
import { newId } from './util.js';
import { t as tr } from './i18n.js';

const COND_OPS = { is: 'es', isnot: 'no es', empty: 'está vacío', full: 'no está vacío', has: 'contiene' };
const DATE_OPS = { past: 'ya pasó', today: 'es hoy', within: 'es en los próximos N días', future: 'es en el futuro', empty: 'está vacío', full: 'no está vacío' };
const WHEN = { change: 'una columna cambia', create: 'se crea un elemento', move: 'un elemento se mueve de pestaña', folder: 'un elemento entra a una carpeta', checklist: 'se completa la checklist', comment: 'alguien comenta', date: 'llega una fecha' };
const ACTS = {
  set: 'Poner un valor', clear: 'Vaciar un campo', today: 'Poner la fecha de hoy', datePlus: 'Poner una fecha (hoy + N días)', copy: 'Copiar el valor de otra columna',
  folder: 'Mover a una carpeta', color: 'Pintar la fila', checklist: 'Agregar una checklist', checkAll: 'Marcar toda la checklist',
  move: 'Mover a otra pestaña', dup: 'Crear una copia en otra pestaña', top: 'Subir al inicio', bottom: 'Bajar al final', comment: 'Escribir un comentario', notify: 'Avisar a alguien',
};
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray'];
const CNAME = { red: 'Rojo', orange: 'Naranja', yellow: 'Amarillo', green: 'Verde', blue: 'Azul', purple: 'Morado', pink: 'Rosa', gray: 'Gris' };
const valsOf = (st, col) => { const ty = st.type(col); if (ty === 'checkbox') return [['true', tr('Marcada')], ['false', tr('Sin marcar')]]; return optionsOf(st, col).map(o => [o.v, o.v]); };

function ValueInput({ st, col, value, onChange, any }) {
  const opts = valsOf(st, col), ty = st.type(col);
  if (opts.length) return <select value={value ?? ''} onChange={e => onChange(e.target.value)}>{any && <option value="*any">{tr('cualquier valor')}</option>}{any && <option value="*empty">{tr('(se vacía)')}</option>}{!any && <option value="">{tr('(elige)')}</option>}{opts.map(([v, l]) => <option value={v}>{l}</option>)}</select>;
  if (ty === 'date') return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} />;
  return <input placeholder={any ? tr('cualquier valor (vacío)') : tr('valor')} value={value === '*any' ? '' : value || ''} onInput={e => onChange(e.target.value || (any ? '*any' : ''))} />;
}
const folderNames = st => [...new Set(st.S.order.flatMap(t => st.foldersOf(t).map(f => f.name)))];
const colorLabel = k => k ? tr(CNAME[k] || k) : tr('sin color');
const who = (st, k) => k.to === 'me' ? tr('mí') : k.to?.startsWith('col:') ? tr('la persona de «{c}»', { c: k.to.slice(4) }) : (st.S.config.users.find(u => 'user:' + u.email === k.to) || {}).name || '?';
const chkName = (st, id) => (st.checklists().find(c => c.id === id) || st.checklists()[0] || {}).name || '?';

export const describe = (st, a) => {
  const w = a.when || {}, c = a.conds || [], x = a.actions || [];
  const W = w.type === 'create' ? tr('se crea un elemento') : w.type === 'move' ? (w.tab ? tr('un elemento se mueve a «{x}»', { x: w.tab }) : tr('un elemento se mueve de pestaña'))
    : w.type === 'folder' ? (w.folder ? tr('un elemento entra a la carpeta «{x}»', { x: w.folder }) : tr('un elemento entra a una carpeta'))
    : w.type === 'checklist' ? tr('se completa la checklist') : w.type === 'comment' ? tr('alguien comenta')
    : w.type === 'date' ? (w.dir === 'on' || !+w.n ? tr('llega la fecha de «{c}»', { c: w.col || '?' }) : tr(w.dir === 'before' ? 'faltan {n} días para «{c}»' : 'pasaron {n} días de «{c}»', { n: w.n, c: w.col || '?' }))
    : !w.to || w.to === '*any' ? tr('«{c}» cambia', { c: w.col || '?' }) : w.to === '*empty' ? tr('«{c}» se vacía', { c: w.col || '?' }) : tr('«{c}» cambia a «{v}»', { c: w.col || '?', v: w.to });
  const C = c.map(k => k.op === 'tab' ? tr('la pestaña es «{v}»', { v: k.val }) : k.op === 'folder' ? (k.val === '*none' ? tr('no está en ninguna carpeta') : k.val === '*any' ? tr('está en una carpeta') : tr('está en la carpeta «{v}»', { v: k.val }))
    : k.op === 'color' ? tr('el color es {v}', { v: colorLabel(k.val) }) : k.op === 'chk' ? (k.val === 'done' ? tr('la checklist está completa') : k.val === 'pending' ? tr('la checklist tiene pendientes') : tr('no tiene checklist'))
    : k.op === 'within' ? tr('«{c}» es en los próximos {v} días', { c: k.col, v: k.val || 0 }) : DATE_OPS[k.op] && !COND_OPS[k.op] ? tr('«{c}» {op}', { c: k.col, op: tr(DATE_OPS[k.op]) })
    : ['is', 'isnot', 'has'].includes(k.op) ? tr('«{c}» {op} «{v}»', { c: k.col, op: tr(COND_OPS[k.op]), v: k.val || '' }) : tr('«{c}» {op}', { c: k.col, op: tr(COND_OPS[k.op] || k.op) })).join(tr(' y '));
  const A = x.map(k => k.type === 'set' ? tr('poner «{c}» en «{v}»', { c: k.col, v: k.val }) : k.type === 'today' ? tr('poner hoy en «{c}»', { c: k.col }) : k.type === 'clear' ? tr('vaciar «{c}»', { c: k.col })
    : k.type === 'datePlus' ? tr('poner en «{c}» la fecha de hoy + {n} días', { c: k.col, n: k.n || 0 }) : k.type === 'copy' ? tr('copiar «{f}» en «{c}»', { f: k.from, c: k.col })
    : k.type === 'folder' ? (k.folder ? tr('mover a la carpeta «{v}»', { v: k.folder }) : tr('sacar de su carpeta')) : k.type === 'color' ? tr('pintar la fila de {v}', { v: colorLabel(k.color) })
    : k.type === 'checklist' ? tr('agregar la checklist «{v}»', { v: chkName(st, k.list) }) : k.type === 'checkAll' ? tr('marcar toda la checklist')
    : k.type === 'move' ? tr('mover a «{v}»', { v: k.tab }) : k.type === 'dup' ? tr('crear una copia en «{v}»', { v: k.tab }) : k.type === 'top' ? tr('subirlo al inicio') : k.type === 'bottom' ? tr('bajarlo al final')
    : k.type === 'comment' ? tr('comentar «{v}»', { v: (k.msg || '').slice(0, 40) }) : tr('avisar a {w}', { w: who(st, k) })).join(', ');
  return C ? tr('Cuando {w}, si {c}, entonces {a}.', { w: W, c: C, a: A || '…' }) : tr('Cuando {w}, entonces {a}.', { w: W, a: A || '…' });
};

export function AutomationEditor({ st, initial, onSave, onClose }) {
  const S = st.S, [a, setA] = useState(() => JSON.parse(JSON.stringify(initial || { id: newId(), name: '', enabled: true, when: { type: 'change', col: S.config.settings.groupCol || '', to: '*any' }, conds: [], actions: [] })));
  const up = p => setA({ ...a, ...p }), names = [...new Set(S.order.flatMap(t => S.tabs[t].header))].filter(h => h && h !== 'ID' && h !== st.folderCol() && h !== st.colorCol()), editable = names.filter(n => st.type(n) !== 'auto');
  const people = names.filter(n => st.type(n) === 'person'), dates = names.filter(n => st.type(n) === 'date'), folders = folderNames(st), lists = st.checklists();
  const w = a.when, setW = p => up({ when: { ...w, ...p } });
  const setC = (i, p) => up({ conds: a.conds.map((c, j) => j === i ? { ...c, ...p } : c) }), setX = (i, p) => up({ actions: a.actions.map((c, j) => j === i ? { ...c, ...p } : c) });
  const need = x => x.type === 'move' || x.type === 'dup' ? x.tab : x.type === 'notify' ? x.to : x.type === 'copy' ? x.col && x.from : ['folder', 'color', 'checklist', 'checkAll', 'top', 'bottom'].includes(x.type) ? true : x.type === 'comment' ? x.msg : x.col;
  const valid = a.actions.length && a.actions.every(need) && (w.type !== 'change' || w.col) && (w.type !== 'date' || w.col);
  const condKind = c => ['tab', 'folder', 'color', 'chk'].includes(c.op) ? '__' + c.op : c.col;
  const pickCondCol = (i, v) => v === '__tab' ? setC(i, { op: 'tab', col: '', val: S.order[0] }) : v === '__folder' ? setC(i, { op: 'folder', col: '', val: folders[0] || '*any' }) : v === '__color' ? setC(i, { op: 'color', col: '', val: 'red' }) : v === '__chk' ? setC(i, { op: 'chk', col: '', val: 'done' }) : setC(i, { col: v, op: st.type(v) === 'date' ? 'past' : 'is', val: '' });
  return <Modal title={initial && initial.id && (S.config.automations || []).some(x => x.id === initial.id) ? tr('Editar automatización') : tr('Nueva automatización')} onClose={onClose} wide><div class="autoed">
    <label class="f">{tr("Nombre")}<input value={a.name} placeholder={tr("Ej. Fecha al publicar")} onInput={e => up({ name: e.target.value })} /></label>
    <div class="ablock"><div class="akw">{tr("CUANDO")}</div><div class="arow">
      <select value={w.type} onChange={e => setW({ type: e.target.value, ...(e.target.value === 'date' ? { col: dates[0] || '', dir: 'before', n: 1 } : {}) })}>{Object.entries(WHEN).map(([k, l]) => <option value={k}>{tr(l)}</option>)}</select>
      {w.type === 'change' && <><select value={w.col} onChange={e => setW({ col: e.target.value, to: '*any' })}><option value="">{tr('(columna)')}</option>{editable.map(n => <option>{n}</option>)}</select><span>{tr('a')}</span>{w.col && <ValueInput st={st} col={w.col} value={w.to} any onChange={v => setW({ to: v })} />}</>}
      {w.type === 'move' && <><span>{tr('a')}</span><select value={w.tab || ''} onChange={e => setW({ tab: e.target.value })}><option value="">{tr("cualquier pestaña")}</option>{S.order.map(t => <option>{t}</option>)}</select></>}
      {w.type === 'folder' && <><select value={w.folder || ''} onChange={e => setW({ folder: e.target.value })}><option value="">{tr("cualquier carpeta")}</option>{folders.map(f => <option>{f}</option>)}</select></>}
      {w.type === 'date' && <><input type="number" min="0" style={{ width: '64px' }} value={w.n ?? 1} onInput={e => setW({ n: Math.max(0, +e.target.value || 0) })} /><select value={w.dir || 'before'} onChange={e => setW({ dir: e.target.value })}><option value="before">{tr('días antes de')}</option><option value="on">{tr('(el mismo día de)')}</option><option value="after">{tr('días después de')}</option></select>
        <select value={w.col || ''} onChange={e => setW({ col: e.target.value })}><option value="">{tr('(columna de fecha)')}</option>{dates.map(n => <option>{n}</option>)}</select></>}</div>
      {w.type === 'date' && <p class="hint">{tr("Se revisa al abrir Kuadro y cada 30 minutos. Corre una sola vez por elemento y por fecha (si cambias la fecha, vuelve a correr).")}</p>}
      {w.type === 'checklist' && <p class="hint">{tr("Se dispara cuando se marca la última tarea pendiente de la página.")}</p>}</div>
    <div class="ablock"><div class="akw">{tr("SI")}{' '}<span class="muted sm">{tr('(opcional: todas deben cumplirse)')}</span></div>
      {a.conds.map((c, i) => <div class="arow"><select value={condKind(c)} onChange={e => pickCondCol(i, e.target.value)}>
          <optgroup label={tr('Columnas')}>{names.map(n => <option>{n}</option>)}</optgroup>
          <optgroup label={tr('Otros')}><option value="__tab">{tr('Pestaña')}</option><option value="__folder">{tr('Carpeta')}</option><option value="__color">{tr('Color de fila')}</option><option value="__chk">{tr('Checklist')}</option></optgroup></select>
        {c.op === 'tab' ? <><span>{tr('es')}</span><select value={c.val} onChange={e => setC(i, { val: e.target.value })}>{S.order.map(t => <option>{t}</option>)}</select></>
          : c.op === 'folder' ? <select value={c.val} onChange={e => setC(i, { val: e.target.value })}><option value="*any">{tr('está en alguna carpeta')}</option><option value="*none">{tr('no está en ninguna carpeta')}</option>{folders.map(f => <option value={f}>{tr('es «{v}»', { v: f })}</option>)}</select>
          : c.op === 'color' ? <><span>{tr('es')}</span><select value={c.val} onChange={e => setC(i, { val: e.target.value })}>{COLORS.map(k => <option value={k}>{tr(CNAME[k])}</option>)}<option value="">{tr('sin color')}</option></select></>
          : c.op === 'chk' ? <select value={c.val} onChange={e => setC(i, { val: e.target.value })}><option value="done">{tr('está completa')}</option><option value="pending">{tr('tiene pendientes')}</option><option value="none">{tr('no existe')}</option></select>
          : st.type(c.col) === 'date' ? <><select value={c.op} onChange={e => setC(i, { op: e.target.value })}>{Object.entries(DATE_OPS).map(([k, l]) => <option value={k}>{tr(l)}</option>)}</select>{c.op === 'within' && <input type="number" min="0" style={{ width: '64px' }} value={c.val || 3} onInput={e => setC(i, { val: e.target.value })} />}</>
          : <><select value={c.op} onChange={e => setC(i, { op: e.target.value })}>{Object.entries(COND_OPS).map(([k, l]) => <option value={k}>{tr(l)}</option>)}</select>
            {['is', 'isnot', 'has'].includes(c.op) && <ValueInput st={st} col={c.col} value={c.val} onChange={v => setC(i, { val: v })} />}</>}
        <button class="icon" onClick={() => up({ conds: a.conds.filter((_, j) => j !== i) })}>✕</button></div>)}
      <button class="mini" onClick={() => up({ conds: [...a.conds, { col: names[0], op: 'is', val: '' }] })}>{tr("＋ Condición")}</button></div>
    <div class="ablock"><div class="akw">{tr("ENTONCES")}</div>
      {a.actions.map((x, i) => <div class="arow"><select value={x.type} onChange={e => setX(i, { type: e.target.value })}>{Object.entries(ACTS).map(([k, l]) => <option value={k}>{tr(l)}</option>)}</select>
        {['set', 'clear', 'copy'].includes(x.type) && <select value={x.col || ''} onChange={e => setX(i, { col: e.target.value, val: '' })}><option value="">{tr('(columna)')}</option>{editable.map(n => <option>{n}</option>)}</select>}
        {x.type === 'set' && x.col && <><span>=</span><ValueInput st={st} col={x.col} value={x.val} onChange={v => setX(i, { val: v })} /></>}
        {x.type === 'copy' && <><span>{tr('desde')}</span><select value={x.from || ''} onChange={e => setX(i, { from: e.target.value })}><option value="">{tr('(columna)')}</option>{names.map(n => <option>{n}</option>)}</select></>}
        {(x.type === 'today' || x.type === 'datePlus') && <select value={x.col || ''} onChange={e => setX(i, { col: e.target.value })}><option value="">{tr('(columna de fecha)')}</option>{dates.map(n => <option>{n}</option>)}</select>}
        {x.type === 'datePlus' && <><span>=</span><select value={x.from || ''} onChange={e => setX(i, { from: e.target.value })}><option value="">{tr('hoy')}</option>{dates.map(n => <option value={n}>{n}</option>)}</select><span>+</span><input type="number" style={{ width: '64px' }} value={x.n ?? 7} onInput={e => setX(i, { n: +e.target.value || 0 })} /><span>{tr('días')}</span></>}
        {x.type === 'folder' && <input list="kfolders" placeholder={tr('Nombre de la carpeta (vacío = sacar de la carpeta)')} class="grow" value={x.folder || ''} onInput={e => setX(i, { folder: e.target.value })} />}
        {x.type === 'color' && <select value={x.color || ''} onChange={e => setX(i, { color: e.target.value })}>{COLORS.map(k => <option value={k}>{tr(CNAME[k])}</option>)}<option value="">{tr('Sin color')}</option></select>}
        {x.type === 'checklist' && <select value={x.list || (lists[0] || {}).id} onChange={e => setX(i, { list: e.target.value })}>{lists.map(k => <option value={k.id}>{k.name}</option>)}</select>}
        {(x.type === 'move' || x.type === 'dup') && <select value={x.tab || ''} onChange={e => setX(i, { tab: e.target.value })}><option value="">{tr('(pestaña)')}</option>{S.order.map(t => <option>{t}</option>)}</select>}
        {x.type === 'dup' && <input placeholder={tr('Agregar al título (opcional)')} value={x.suffix || ''} onInput={e => setX(i, { suffix: e.target.value })} />}
        {x.type === 'comment' && <input class="grow" placeholder={tr('Comentario (usa {titulo}, {quien} y {fecha})')} value={x.msg || ''} onInput={e => setX(i, { msg: e.target.value })} />}
        {x.type === 'notify' && <><select value={x.to || ''} onChange={e => setX(i, { to: e.target.value })}><option value="">{tr('(a quién)')}</option><option value="me">{tr("A mí")}</option>{people.map(p => <option value={'col:' + p}>{tr('A la persona en «{c}»', { c: p })}</option>)}{S.config.users.map(u => <option value={'user:' + u.email}>{u.name}</option>)}</select>
          <input class="grow" placeholder={tr('Mensaje (usa {titulo} y {quien})')} value={x.msg || ''} onInput={e => setX(i, { msg: e.target.value })} /></>}
        <button class="icon" onClick={() => up({ actions: a.actions.filter((_, j) => j !== i) })}>✕</button></div>)}
      <datalist id="kfolders">{folders.map(f => <option value={f} />)}</datalist>
      <button class="mini" onClick={() => up({ actions: [...a.actions, { type: 'set', col: '', val: '' }] })}>{tr("＋ Acción")}</button></div>
    <div class="info">{describe(st, a)}</div>
    <p class="hint">{tr("Las automatizaciones se ejecutan en la computadora de quien hace el cambio. Los avisos llegan a la bandeja 🔔 y como notificación de escritorio.")}</p>
    <div class="row-end"><button class="btn" onClick={onClose}>{tr("Cancelar")}</button><button class="btn primary" disabled={!valid} onClick={() => onSave({ ...a, name: a.name.trim() || describe(st, a).slice(0, 48) })}>{tr("Guardar")}</button></div>
  </div></Modal>;
}

// Plantillas pensadas para creadores de contenido; cada una se arma con las columnas de este proyecto y solo aparece si tiene sentido.
export function templates(st) {
  const S = st.S, sch = S.config.schema, s = S.config.settings, g = s.groupCol, opts = g ? optionsOf(st, g).map(o => o.v) : [];
  const opt = re => opts.find(v => re.test(v)), pub = opt(/publicad|published|subid|uploaded|live|listo para ver/i), rec = opt(/grab|record|film/i), edit = opt(/edit/i), disc = opt(/descart|discard|cancel|archiv/i), ready = opt(/^listo|ready|program|scheduled/i), pend = opt(/pend|idea|backlog|to ?do/i);
  const names = [...new Set(S.order.flatMap(t => S.tabs[t].header))].filter(Boolean), people = names.filter(n => st.type(n) === 'person');
  const date = s.dateCol || names.find(n => st.type(n) === 'date' && /publica|publish|release|fecha/i.test(n)) || names.find(n => st.type(n) === 'date');
  const editor = people.find(n => /editor/i.test(n)), writer = people.find(n => /gui[oó]n|script|writer/i.test(n)), thumbP = people.find(n => /miniatur|thumb/i.test(n)), anyP = people[0];
  const shorts = S.order.find(t => /short/i.test(t)), L = id => (st.checklists().find(c => c.id === id) || {}).id;
  const F = n => tr(n), mk = (name, when, conds, actions) => ({ id: newId(), name, enabled: true, when, conds, actions });
  const notTo = p => p ? { type: 'notify', to: 'col:' + p } : { type: 'notify', to: 'me' };
  const T = [];
  const add = (key, ok, cat, name, desc, build) => ok && T.push({ key, cat, name, desc, build });
  add('pubFolder', g && pub, 'org', tr('Publicado → carpeta «{f}» en verde', { f: F('Publicados') }), tr('Al marcar un video como «{v}», se guarda en la carpeta y se pinta de verde para que tu lista de pendientes quede limpia.', { v: pub }),
    () => mk(tr('Publicado → carpeta y verde'), { type: 'change', col: g, to: pub }, [], [{ type: 'folder', folder: F('Publicados') }, { type: 'color', color: 'green' }]));
  add('pubDate', g && pub && date, 'org', tr('Fecha de publicación automática'), tr('Al marcar «{v}», pone la fecha de hoy en «{d}» si estaba vacía.', { v: pub, d: date }),
    () => mk(tr('Fecha al publicar'), { type: 'change', col: g, to: pub }, [{ col: date, op: 'empty' }], [{ type: 'today', col: date }]));
  add('remind', date, 'dates', tr('Recordatorio 1 día antes de publicar'), tr('Un día antes de «{d}», avisa a {w} si el video aún no está publicado.', { d: date, w: anyP ? tr('la persona de «{c}»', { c: anyP }) : tr('ti') }),
    () => mk(tr('Recordatorio: se publica mañana'), { type: 'date', col: date, dir: 'before', n: 1 }, pub ? [{ col: g, op: 'isnot', val: pub }] : [], [{ ...notTo(anyP), msg: tr('Mañana se publica «{titulo}»') }]));
  add('late', date && g && pub, 'dates', tr('Video atrasado → rojo y aviso'), tr('Si pasa un día de «{d}» y no está publicado, la fila se pone roja y avisa.', { d: date }),
    () => mk(tr('Video atrasado'), { type: 'date', col: date, dir: 'after', n: 1 }, [{ col: g, op: 'isnot', val: pub }], [{ type: 'color', color: 'red' }, { ...notTo(anyP), msg: tr('«{titulo}» se atrasó: ya pasó su fecha') }]));
  add('recList', g && rec && L('rec'), 'chk', tr('Al grabar → checklist de grabación'), tr('Cuando pasa a «{v}», agrega la checklist «{c}» a la página.', { v: rec, c: tr('Grabación') }),
    () => mk(tr('Checklist de grabación'), { type: 'change', col: g, to: rec }, [], [{ type: 'checklist', list: 'rec' }]));
  add('editList', g && edit && L('edit'), 'chk', tr('Al editar → checklist de edición y aviso al editor'), tr('Cuando pasa a «{v}», agrega la checklist de edición{e}.', { v: edit, e: editor ? tr(' y avisa a la persona de «{c}»', { c: editor }) : '' }),
    () => mk(tr('Checklist de edición'), { type: 'change', col: g, to: edit }, [], [{ type: 'checklist', list: 'edit' }, ...(editor ? [{ type: 'notify', to: 'col:' + editor, msg: tr('«{titulo}» está listo para editar') }] : [])]));
  add('recDone', g && rec && edit, 'chk', tr('Grabación completa → {v}', { v: edit }), tr('Cuando se completa la checklist de un video en «{a}», pasa solo a «{b}».', { a: rec, b: edit }),
    () => mk(tr('Grabación completa → edición'), { type: 'checklist' }, [{ col: g, op: 'is', val: rec }], [{ type: 'set', col: g, val: edit }]));
  add('editDone', g && edit && (ready || pub), 'chk', tr('Edición completa → {v}', { v: ready || pub }), tr('Cuando se completa la checklist de un video en «{a}», pasa a «{b}» y agrega la checklist de publicación.', { a: edit, b: ready || pub }),
    () => mk(tr('Edición completa'), { type: 'checklist' }, [{ col: g, op: 'is', val: edit }], [{ type: 'set', col: g, val: ready || pub }, ...(L('pub') ? [{ type: 'checklist', list: 'pub' }] : [])]));
  add('short', g && pub && shorts, 'org', tr('Publicado → crear su Short'), tr('Cuando un video se publica, crea una copia en «{t}» para hacer su versión corta.', { t: shorts }),
    () => mk(tr('Crear Short del video'), { type: 'change', col: g, to: pub }, [{ op: 'tab', col: '', val: S.order.find(t => t !== shorts) || S.order[0] }], [{ type: 'dup', tab: shorts, suffix: '(Short)', ...(pend ? { col: g, val: pend } : {}) }]));
  add('shortList', shorts && L('short'), 'chk', tr('Al llegar a {t} → checklist de Short', { t: shorts }), tr('Cada elemento que entra a «{t}» recibe la checklist de Short.', { t: shorts }),
    () => mk(tr('Checklist de Short'), { type: 'move', tab: shorts }, [], [{ type: 'checklist', list: 'short' }]));
  add('discard', g && disc, 'org', tr('Descartado → gris, al final y a «{f}»', { f: F('Descartados') }), tr('Cuando marcas «{v}», la fila se pinta de gris, baja al final y se guarda en una carpeta.', { v: disc }),
    () => mk(tr('Descartar ideas'), { type: 'change', col: g, to: disc }, [], [{ type: 'color', color: 'gray' }, { type: 'folder', folder: F('Descartados') }, { type: 'bottom' }]));
  add('newIdea', true, 'org', tr('Nueva idea → carpeta «{f}»', { f: F('Ideas nuevas') }), tr('Todo lo que se crea entra a una carpeta de ideas nuevas para revisarlas juntas.'),
    () => mk(tr('Ideas nuevas a su carpeta'), { type: 'create' }, [], [{ type: 'folder', folder: F('Ideas nuevas') }, { type: 'color', color: 'yellow' }]));
  [writer, editor, thumbP].filter(Boolean).forEach(p => add('assign:' + p, true, 'team', tr('Al asignar «{c}» → avisarle', { c: p }), tr('Cuando alguien queda asignado en «{c}», le llega un aviso.', { c: p }),
    () => mk(tr('Aviso al asignar «{c}»', { c: p }), { type: 'change', col: p, to: '*any' }, [{ col: p, op: 'full' }], [{ type: 'notify', to: 'col:' + p, msg: tr('Te asignaron «{titulo}»') }])));
  add('comment', anyP, 'team', tr('Comentario nuevo → avisar al responsable'), tr('Cuando alguien comenta en un video, avisa a la persona de «{c}».', { c: anyP }),
    () => mk(tr('Aviso de comentarios'), { type: 'comment' }, [], [{ type: 'notify', to: 'col:' + anyP, msg: tr('{quien} comentó en «{titulo}»') }]));
  add('pubComment', g && pub, 'team', tr('Al publicar → dejar constancia'), tr('Escribe un comentario automático con la fecha cuando el video se publica.'),
    () => mk(tr('Constancia de publicación'), { type: 'change', col: g, to: pub }, [], [{ type: 'comment', msg: tr('Publicado el {fecha} por {quien}') }]));
  add('schedule', g && rec && date, 'dates', tr('Al grabar → fecha de publicación en 7 días'), tr('Cuando pasa a «{v}» y «{d}» está vacía, la programa para dentro de una semana.', { v: rec, d: date }),
    () => mk(tr('Programar publicación'), { type: 'change', col: g, to: rec }, [{ col: date, op: 'empty' }], [{ type: 'datePlus', col: date, n: 7 }]));
  return T;
}

export function AutomationList({ st }) {
  const S = st.S, list = S.config.automations || [], [ed, setEd] = useState(null), [gal, setGal] = useState(false), save = () => st.saveConfig();
  const put = a => { const i = list.findIndex(x => x.id === a.id); S.config.automations = i >= 0 ? list.map(x => x.id === a.id ? a : x) : [...list, a]; save(); setEd(null); };
  const tpls = gal ? templates(st) : [], CATS = { org: tr('Organización'), dates: tr('Fechas'), chk: tr('Checklists'), team: tr('Equipo') };
  return <div>{list.map(a => <div class="auto-i"><label class="switch" title={a.enabled !== false ? tr('Activa') : tr('Pausada')}><input type="checkbox" checked={a.enabled !== false} onChange={e => { a.enabled = e.target.checked; save(); }} /><span /></label>
    <div class="grow"><b>⚡ {a.name}</b><div class="muted sm">{describe(st, a)}</div></div><button class="mini" onClick={() => setEd(a)}>{tr("Editar")}</button><button class="icon" title={tr("Eliminar")} onClick={() => { if (confirm(tr('¿Eliminar esta automatización?'))) { S.config.automations = list.filter(x => x !== a); save(); } }}>✕</button></div>)}
    {!list.length && <p class="muted">{tr("Aún no hay automatizaciones.")}</p>}
    <div class="lrow0"><button class="btn primary" onClick={() => setGal(true)}>{tr("✨ Agregar desde plantilla")}</button><button class="btn" onClick={() => setEd('new')}>{tr("＋ Crear desde cero")}</button></div>
    {gal && <Modal title={tr("Plantillas de automatización")} onClose={() => setGal(false)} wide><div class="tpl-gal">
      <p class="hint">{tr("Pensadas para creadores de contenido y armadas con las columnas de tu proyecto. Al elegir una puedes revisarla y ajustarla antes de guardarla.")}</p>
      {Object.entries(CATS).map(([k, l]) => { const xs = tpls.filter(t => t.cat === k); return xs.length ? <div><div class="ctx-t">{l}</div>{xs.map(t => { const used = list.some(a => a.tpl === t.key); return <div class="tpl-i"><div class="grow"><b>{t.name}</b><div class="muted sm">{t.desc}</div></div>
        <button class={'mini' + (used ? '' : ' primary')} onClick={() => { setGal(false); setEd({ ...t.build(), tpl: t.key }); }}>{used ? tr('Agregar otra vez') : tr('Usar')}</button></div>; })}</div> : null; })}
      {!tpls.length && <p class="muted">{tr("No hay plantillas que encajen con las columnas de este proyecto todavía.")}</p>}</div></Modal>}
    {ed && <AutomationEditor st={st} initial={ed === 'new' ? null : ed} onSave={put} onClose={() => setEd(null)} />}</div>;
}
