// Editor de automatizaciones: CUANDO <algo pasa> · SI <condiciones> · ENTONCES <acciones>.
import { useState } from 'preact/hooks';
import { Modal, optionsOf } from './ui.jsx';
import { newId } from './util.js';
import { t as tr } from './i18n.js';

const COND_OPS = { is: 'es', isnot: 'no es', empty: 'está vacío', full: 'no está vacío', has: 'contiene', tab: 'pestaña es' };
const ACTS_ = { set: tr('Poner un valor'), today: tr('Poner la fecha de hoy'), clear: tr('Vaciar un campo'), move: tr('Mover a otra pestaña'), notify: tr('Avisar a alguien') };
const valsOf = (st, col) => { const ty = st.type(col); if (ty === 'checkbox') return [['true', tr('Marcada')], ['false', tr('Sin marcar')]]; return optionsOf(st, col).map(o => [o.v, o.v]); };

function ValueInput({ st, col, value, onChange, any }) {
  const opts = valsOf(st, col), ty = st.type(col);
  if (opts.length) return <select value={value ?? ''} onChange={e => onChange(e.target.value)}>{any && <option value="*any">{tr('cualquier valor')}</option>}{any && <option value="*empty">{tr('(se vacía)')}</option>}{!any && <option value="">{tr('(elige)')}</option>}{opts.map(([v, l]) => <option value={v}>{l}</option>)}</select>;
  if (ty === 'date') return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} />;
  return <input placeholder={any ? tr('cualquier valor (vacío)') : tr('valor')} value={value === '*any' ? '' : value || ''} onInput={e => onChange(e.target.value || (any ? '*any' : ''))} />;
}
export const describe = (st, a) => {
  const w = a.when || {}, c = a.conds || [], x = a.actions || [];
  const W = w.type === 'create' ? tr('se crea un elemento') : w.type === 'move' ? (w.tab ? tr('un elemento se mueve a «{x}»', { x: w.tab }) : tr('un elemento se mueve de pestaña'))
    : !w.to || w.to === '*any' ? tr('«{c}» cambia', { c: w.col || '?' }) : w.to === '*empty' ? tr('«{c}» se vacía', { c: w.col || '?' }) : tr('«{c}» cambia a «{v}»', { c: w.col || '?', v: w.to });
  const C = c.map(k => k.op === 'tab' ? tr('la pestaña es «{v}»', { v: k.val }) : ['is', 'isnot', 'has'].includes(k.op) ? tr('«{c}» {op} «{v}»', { c: k.col, op: tr(COND_OPS[k.op]), v: k.val || '' }) : tr('«{c}» {op}', { c: k.col, op: tr(COND_OPS[k.op]) })).join(tr(' y '));
  const who = k => k.to === 'me' ? tr('mí') : k.to?.startsWith('col:') ? tr('la persona de «{c}»', { c: k.to.slice(4) }) : (st.S.config.users.find(u => 'user:' + u.email === k.to) || {}).name || '?';
  const A = x.map(k => k.type === 'set' ? tr('poner «{c}» en «{v}»', { c: k.col, v: k.val }) : k.type === 'today' ? tr('poner hoy en «{c}»', { c: k.col }) : k.type === 'clear' ? tr('vaciar «{c}»', { c: k.col }) : k.type === 'move' ? tr('mover a «{v}»', { v: k.tab }) : tr('avisar a {x}', { x: who(k) })).join(', ');
  return C ? tr('Cuando {w}, si {c}, entonces {a}.', { w: W, c: C, a: A || '…' }) : tr('Cuando {w}, entonces {a}.', { w: W, a: A || '…' });
};

export function AutomationEditor({ st, initial, onSave, onClose }) {
  const S = st.S, [a, setA] = useState(() => JSON.parse(JSON.stringify(initial || { id: newId(), name: '', enabled: true, when: { type: 'change', col: S.config.settings.groupCol || '', to: '*any' }, conds: [], actions: [] })));
  const up = p => setA({ ...a, ...p }), names = [...new Set(S.order.flatMap(t => S.tabs[t].header))].filter(h => h && h !== 'ID'), editable = names.filter(n => st.type(n) !== 'auto');
  const people = names.filter(n => st.type(n) === 'person'), dates = names.filter(n => st.type(n) === 'date');
  const w = a.when, setW = p => up({ when: { ...w, ...p } });
  const setC = (i, p) => up({ conds: a.conds.map((c, j) => j === i ? { ...c, ...p } : c) }), setX = (i, p) => up({ actions: a.actions.map((c, j) => j === i ? { ...c, ...p } : c) });
  const valid = a.actions.length && a.actions.every(x => (x.type === 'move' ? x.tab : x.type === 'notify' ? x.to : x.col)) && (w.type !== 'change' || w.col);
  return <Modal title={initial ? tr('Editar automatización') : tr('Nueva automatización')} onClose={onClose} wide><div class="autoed">
    <label class="f">{tr("Nombre")}<input value={a.name} placeholder={tr("Ej. Fecha al publicar")} onInput={e => up({ name: e.target.value })} /></label>
    <div class="ablock"><div class="akw">{tr("CUANDO")}</div><div class="arow">
      <select value={w.type} onChange={e => setW({ type: e.target.value })}><option value="change">{tr('una columna cambia')}</option><option value="create">{tr('se crea un elemento')}</option><option value="move">{tr("un elemento se mueve de pestaña")}</option></select>
      {w.type === 'change' && <><select value={w.col} onChange={e => setW({ col: e.target.value, to: '*any' })}><option value="">{tr('(columna)')}</option>{editable.map(n => <option>{n}</option>)}</select><span>{tr('a')}</span>{w.col && <ValueInput st={st} col={w.col} value={w.to} any onChange={v => setW({ to: v })} />}</>}
      {w.type === 'move' && <><span>{tr('a')}</span><select value={w.tab || ''} onChange={e => setW({ tab: e.target.value })}><option value="">{tr("cualquier pestaña")}</option>{S.order.map(t => <option>{t}</option>)}</select></>}</div></div>
    <div class="ablock"><div class="akw">{tr("SI")}{' '}<span class="muted sm">{tr('(opcional: todas deben cumplirse)')}</span></div>
      {a.conds.map((c, i) => <div class="arow"><select value={c.op === 'tab' ? '__tab' : c.col} onChange={e => e.target.value === '__tab' ? setC(i, { op: 'tab', col: '', val: S.order[0] }) : setC(i, { col: e.target.value, op: c.op === 'tab' ? 'is' : c.op, val: '' })}><option value="__tab">{tr("Pestaña")}</option>{names.map(n => <option>{n}</option>)}</select>
        {c.op === 'tab' ? <><span>{tr('es')}</span><select value={c.val} onChange={e => setC(i, { val: e.target.value })}>{S.order.map(t => <option>{t}</option>)}</select></> : <>
          <select value={c.op} onChange={e => setC(i, { op: e.target.value })}>{Object.entries(COND_OPS).filter(([k]) => k !== 'tab').map(([k, l]) => <option value={k}>{tr(l)}</option>)}</select>
          {['is', 'isnot', 'has'].includes(c.op) && <ValueInput st={st} col={c.col} value={c.val} onChange={v => setC(i, { val: v })} />}</>}
        <button class="icon" onClick={() => up({ conds: a.conds.filter((_, j) => j !== i) })}>✕</button></div>)}
      <button class="mini" onClick={() => up({ conds: [...a.conds, { col: names[0], op: 'is', val: '' }] })}>{tr("＋ Condición")}</button></div>
    <div class="ablock"><div class="akw">{tr("ENTONCES")}</div>
      {a.actions.map((x, i) => <div class="arow"><select value={x.type} onChange={e => setX(i, { type: e.target.value })}>{Object.entries(ACTS_).map(([k, l]) => <option value={k}>{tr(l)}</option>)}</select>
        {(x.type === 'set' || x.type === 'clear') && <select value={x.col || ''} onChange={e => setX(i, { col: e.target.value, val: '' })}><option value="">{tr('(columna)')}</option>{editable.map(n => <option>{n}</option>)}</select>}
        {x.type === 'set' && x.col && <><span>=</span><ValueInput st={st} col={x.col} value={x.val} onChange={v => setX(i, { val: v })} /></>}
        {x.type === 'today' && <select value={x.col || ''} onChange={e => setX(i, { col: e.target.value })}><option value="">{tr('(columna de fecha)')}</option>{dates.map(n => <option>{n}</option>)}</select>}
        {x.type === 'move' && <select value={x.tab || ''} onChange={e => setX(i, { tab: e.target.value })}><option value="">{tr('(pestaña)')}</option>{S.order.map(t => <option>{t}</option>)}</select>}
        {x.type === 'notify' && <><select value={x.to || ''} onChange={e => setX(i, { to: e.target.value })}><option value="">{tr('(a quién)')}</option><option value="me">{tr("A mí")}</option>{people.map(p => <option value={'col:' + p}>{tr('A la persona en «{c}»', { c: p })}</option>)}{S.config.users.map(u => <option value={'user:' + u.email}>{u.name}</option>)}</select>
          <input class="grow" placeholder={tr('Mensaje (usa {titulo} y {quien})')} value={x.msg || ''} onInput={e => setX(i, { msg: e.target.value })} /></>}
        <button class="icon" onClick={() => up({ actions: a.actions.filter((_, j) => j !== i) })}>✕</button></div>)}
      <button class="mini" onClick={() => up({ actions: [...a.actions, { type: 'set', col: '', val: '' }] })}>{tr("＋ Acción")}</button></div>
    <div class="info">{describe(st, a)}</div>
    <p class="hint">{tr("Las automatizaciones se ejecutan en la computadora de quien hace el cambio. Los avisos llegan a la bandeja 🔔 y como notificación de escritorio.")}</p>
    <div class="row-end"><button class="btn" onClick={onClose}>{tr("Cancelar")}</button><button class="btn primary" disabled={!valid} onClick={() => onSave({ ...a, name: a.name.trim() || describe(st, a).slice(0, 48) })}>{tr("Guardar")}</button></div>
  </div></Modal>;
}

export function AutomationList({ st }) {
  const S = st.S, list = S.config.automations || [], [ed, setEd] = useState(null), save = () => st.saveConfig();
  const put = a => { const i = list.findIndex(x => x.id === a.id); S.config.automations = i >= 0 ? list.map(x => x.id === a.id ? a : x) : [...list, a]; save(); setEd(null); };
  return <div>{list.map(a => <div class="auto-i"><label class="switch" title={a.enabled !== false ? tr('Activa') : tr('Pausada')}><input type="checkbox" checked={a.enabled !== false} onChange={e => { a.enabled = e.target.checked; save(); }} /><span /></label>
    <div class="grow"><b>⚡ {a.name}</b><div class="muted sm">{describe(st, a)}</div></div><button class="mini" onClick={() => setEd(a)}>{tr("Editar")}</button><button class="icon" title={tr("Eliminar")} onClick={() => { if (confirm(tr('¿Eliminar esta automatización?'))) { S.config.automations = list.filter(x => x !== a); save(); } }}>✕</button></div>)}
    {!list.length && <p class="muted">{tr("Aún no hay automatizaciones.")}</p>}
    <button class="btn primary" onClick={() => setEd('new')}>{tr("＋ Nueva automatización")}</button>
    {ed && <AutomationEditor st={st} initial={ed === 'new' ? null : ed} onSave={put} onClose={() => setEd(null)} />}</div>;
}
