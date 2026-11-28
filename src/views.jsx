// Kanban (propiedades visibles, columnas plegables, carriles), galería y calendario (mes/semana + sin programar).
import { useState } from 'preact/hooks';
import { Chip, optionsOf, colorOf, splitMulti } from './ui.jsx';
import { dueOf, iso, Avatar, Ic, Empty } from './shared.jsx';
import { imgSrc, fmtDate, isISO, urls, ytId } from './util.js';
import { t as tr, LOCALE, LANG } from './i18n.js';

let dragging = null; // { tab, id } de la tarjeta que se está arrastrando
const startDrag = (e, r) => { dragging = { tab: r.tab, id: r.id }; e.dataTransfer.setData('text/plain', r.tab + '|' + r.id); e.dataTransfer.effectAllowed = 'move'; };

// Propiedades que muestra una tarjeta: las elegidas por la persona o, si no eligió, las de selección/persona más la fecha.
export const defaultCardProps = (st, extraSkip = []) => { const S = st.S, s = S.config.settings; const all = [...new Set(S.order.flatMap(t => S.tabs[t].header))].filter(h => h && h !== 'ID' && h !== s.titleCol && !extraSkip.includes(h) && !st.hiddenCols().includes(h)); return [...all.filter(c => ['select', 'multi'].includes(st.type(c))).slice(0, 3), ...all.filter(c => st.type(c) === 'person'), ...(s.dateCol ? [s.dateCol] : [])]; };
function PropLine({ st, r, props }) {
  return <div class="card-m">{props.map(c => {
    const ty = st.type(c), v = r.v[c]; if (v === '' || v == null || v === false) return null;
    if (ty === 'select' || ty === 'multi') return splitMulti(v).map(x => <Chip v={x} color={colorOf(st, c, x)} />);
    if (ty === 'person') return <span class="pchip" title={c}><Avatar name={v} size={18} />{v}</span>;
    if (ty === 'date') return <span class="muted sm">{fmtDate(v)}</span>;
    if (ty === 'checkbox') return <span class="muted sm vchk"><Ic n="sqcheck" s={12} />{c}</span>;
    if (ty === 'url') return <span class="muted sm">↗ {tr(urls(v).length === 1 ? '1 enlace' : '{n} enlaces', { n: urls(v).length })}</span>;
    if (ty === 'image') return null;
    return <span class="muted sm ptext">{String(v).slice(0, 60)}</span>;
  })}</div>;
}
function Card({ st, r, open, drag, ins, onOver, onDropCard, onMenu, props, icon, here }) {
  const S = st.S, s = S.config.settings, src = props.includes('__img') && s.imageCol && imgSrc(r.v[s.imageCol]);
  return <div class={'card' + (ins ? ' ins-' + ins : '') + (dragging && dragging.id === r.id ? ' dragging' : '')} draggable={drag} onDragStart={e => startDrag(e, r)} onDragEnd={() => { dragging = null; }}
    onDragOver={onOver && (e => onOver(e, r))} onDrop={onDropCard && (e => onDropCard(e, r))} onContextMenu={onMenu && (e => onMenu(e, r))} onClick={() => st.can('openPages') && open(r)}>
    {src && <img src={src} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}<div class="card-t">{icon && <span class="ticon">{icon}</span>}{r.v[s.titleCol] || <span class="ph">{tr("Sin título")}</span>}</div>{(() => { const pg = st.progressOf(r.id); return pg.total ? <span class={'prog sm' + (pg.done === pg.total ? ' full' : '')}><span class="pt"><i style={{ width: Math.round(100 * pg.done / pg.total) + '%' }} /></span><b>{pg.done}/{pg.total}</b></span> : null; })()}
    <PropLine st={st} r={r} props={props.filter(p => p !== '__img')} />
    {here && here.length > 0 && <div class="here">{here.map(p => <Avatar name={p.name} size={18} title={tr('{x} lo tiene abierto', { x: p.name })} />)}</div>}</div>;
}

export function KanbanView({ st, rows, open, onNew, sorted, onMenu, onColMenu, prefs, setPrefs, icons, presence }) {
  const S = st.S, g = S.config.settings.groupCol, [over, setOver] = useState(null), [ins, setIns] = useState(null);
  if (!g) return <Empty ic="grid" title={tr("Falta la columna del kanban")} text={tr("Elige en Ajustes → General la columna por la que se agrupa el kanban.")} />;
  const def = S.config.schema[g]?.default || '', lane = prefs.lane && prefs.lane !== g ? prefs.lane : '';
  const props = prefs.cardProps || ['__img', ...defaultCardProps(st, [g])];
  const collapsed = prefs.collapsed || [], foldedLanes = prefs.foldedLanes || [];
  const opts = optionsOf(st, g).map(o => o.v); rows.forEach(r => { const x = String(r.v[g] || ''); if (x && !opts.includes(x)) opts.push(x); });
  const move = st.can('moveCards') || st.canEditCol(g);
  const half = (e, el) => { const b = el.getBoundingClientRect(); return e.clientY > b.top + b.height / 2; };
  const place = (tab, id, list, p) => {
    if (sorted) return; const same = list.map((r, i) => [r, i]).filter(([r]) => r.tab === tab && r.id !== id);
    const nxt = same.find(([, i]) => i >= p); if (nxt) return st.reorder(tab, id, nxt[0].id, false);
    const prv = same.filter(([, i]) => i < p).pop(); if (prv) st.reorder(tab, id, prv[0].id, true);
  };
  const laneOf = r => lane ? (st.type(lane) === 'multi' ? splitMulti(r.v[lane])[0] || '' : String(r.v[lane] || '')) : '';
  const drop = (e, o, list, target, lv) => {
    e.preventDefault(); e.stopPropagation(); setOver(null); setIns(null);
    const [tab, id] = e.dataTransfer.getData('text/plain').split('|'); dragging = null; if (!id) return;
    const src = S.tabs[tab]?.rows.find(r => r.id === id); if (!src) return;
    if (String(src.v[g] || def) !== o) st.setCell(tab, id, g, o, { move: true });
    if (lane && lv !== undefined && laneOf(src) !== lv && st.canEditCol(lane)) st.setCell(tab, id, lane, lv);
    if (!st.can('moveCards')) return;
    const p = target ? list.indexOf(target) + (half(e, e.currentTarget) ? 1 : 0) : list.length; place(tab, id, list, p);
  };
  const toggleCol = o => setPrefs({ collapsed: collapsed.includes(o) ? collapsed.filter(x => x !== o) : [...collapsed, o] });
  const cols = [...opts, ...(def ? [] : [''])];
  const board = (subset, lv) => <div class="kanban">{cols.map(o => {
    const list = subset.filter(r => String(r.v[g] || def) === o), key = o + '|' + (lv ?? '');
    const opt = optionsOf(st, g).find(x => x.v === o), bg = opt && opt.colBg ? (opt.colBg === 'auto' ? opt.color : opt.colBg) : '';
    const dropProps = { onDragOver: e => { if (move) { e.preventDefault(); setOver(key); } }, onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) { setOver(null); setIns(null); } }, onDrop: e => drop(e, o, list, null, lv) };
    if (collapsed.includes(o)) return <div class={'kcol folded' + (over === key ? ' over' : '') + (bg ? ' kb-' + bg : '')} {...dropProps} onClick={() => toggleCol(o)} title={tr("Desplegar columna")}>
      <span class="fold-n">{list.length}</span><span class="fold-t">{o ? <Chip v={o} color={colorOf(st, g, o)} /> : tr('Sin {x}', { x: g.toLowerCase() })}</span></div>;
    return <div class={'kcol' + (over === key ? ' over' : '') + (bg ? ' kb-' + bg : '')} {...dropProps}>
      <div class="kcol-h" onContextMenu={e => opt && onColMenu(e, opt, toggleCol)}>{o ? <Chip v={o} color={colorOf(st, g, o)} /> : <span class="muted">{tr('Sin {x}', { x: g.toLowerCase() })}</span>}<span class="muted kc-n">{list.length}</span><span class="sp" />
        <button class="icon kc-btn" title={tr("Plegar columna")} onClick={() => toggleCol(o)}>⟨</button>
        {opt && st.can('manageOptions') && <button class="icon kc-btn" title={tr("Color de la columna")} onClick={e => onColMenu(e, opt, toggleCol)}>⋯</button>}</div>
      <div class="kcol-b">{list.map(r => <Card key={r.id} st={st} r={r} open={open} drag={(move || st.can('moveTabs')) && !r.tmp} props={props} icon={icons[r.id]} here={presence.filter(p => p.rowId === r.id)}
        ins={ins && ins.id === r.id ? ins.pos : null} onOver={(e, t) => { if (!move) return; e.preventDefault(); e.stopPropagation(); setOver(key); if (sorted || !dragging || dragging.id === t.id) { setIns(null); return; } const pos = half(e, e.currentTarget) ? 'a' : 'b'; if (!ins || ins.id !== t.id || ins.pos !== pos) setIns({ id: t.id, pos }); }}
        onDropCard={(e, t) => drop(e, o, list, t, lv)} onMenu={(e, t) => onMenu(e, { row: t, list: sorted ? null : list })} />)}
        {st.can('addCards') && <button class="addcard" onClick={() => onNew({ [g]: o, ...(lane && lv ? { [lane]: lv } : {}) }, true)}>{tr("+ Nueva")}</button>}</div></div>;
  })}</div>;
  if (!lane) return board(rows);
  const lv = [...optionsOf(st, lane).map(o => o.v)]; rows.forEach(r => { const x = laneOf(r); if (x && !lv.includes(x)) lv.push(x); }); lv.push('');
  return <div class="lanes">{lv.map(l => { const sub = rows.filter(r => laneOf(r) === l); if (!sub.length && l === '') return null; const folded = foldedLanes.includes(l);
    return <div class="lane"><div class="lane-h" onClick={() => setPrefs({ foldedLanes: folded ? foldedLanes.filter(x => x !== l) : [...foldedLanes, l] })}><span class="caret">{folded ? '▸' : '▾'}</span>
      {l ? (st.type(lane) === 'person' ? <span class="pchip"><Avatar name={l} size={18} />{l}</span> : <Chip v={l} color={colorOf(st, lane, l)} />) : <span class="muted">{tr('Sin {x}', { x: lane.toLowerCase() })}</span>}<span class="muted sm">{sub.length}</span></div>
      {!folded && board(sub, l)}</div>; })}</div>;
}

export function GalleryView({ st, rows, open, onMenu, prefs, icons }) {
  const S = st.S, s = S.config.settings, props = prefs.galleryProps || (s.groupCol ? [s.groupCol] : []), size = prefs.gallerySize || 'm';
  const anyImg = rows.some(r => (s.imageCol && imgSrc(r.v[s.imageCol])) || Object.keys(r.v).some(c => st.type(c) === 'url' && urls(r.v[c]).some(ytId)));
  return <div class={'gallery g-' + size}>{rows.length > 0 && !anyImg && <div class="g-hint"><Ic n="image" s={16} /><span>{tr('Aún no hay miniaturas. Agrega una columna de imagen o pega un enlace de YouTube para ver portadas aquí.')}</span></div>}{rows.map(r => {
    let src = s.imageCol && imgSrc(r.v[s.imageCol]), ref = false;
    if (!src) { const y = Object.keys(r.v).filter(c => st.type(c) === 'url').flatMap(c => urls(r.v[c])).map(ytId).find(Boolean); if (y) { src = `https://i.ytimg.com/vi/${y}/mqdefault.jpg`; ref = true; } }
    return <div class="gcard" key={r.id} onContextMenu={e => onMenu(e, { row: r })} draggable={st.can('moveTabs') && !r.tmp} onDragStart={e => startDrag(e, r)} onClick={() => st.can('openPages') && open(r)}><div class="gimg">{src ? <img src={src} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentNode.classList.add('noimg'); }} /> : null}<span class="gph" title={tr("Sin imagen")}><Ic n="image" s={26} w={1.4} /></span>{ref && <em>{tr("Referencia")}</em>}</div>
      <div class="card-t">{icons[r.id] && <span class="ticon">{icons[r.id]}</span>}{r.v[s.titleCol] || <span class="ph">{tr("Sin título")}</span>}</div>{(() => { const pg = st.progressOf(r.id); return pg.total ? <span class={'prog sm' + (pg.done === pg.total ? ' full' : '')}><span class="pt"><i style={{ width: Math.round(100 * pg.done / pg.total) + '%' }} /></span><b>{pg.done}/{pg.total}</b></span> : null; })()}{(d => d ? <span class={'duebadge ' + (d.late ? 'late' : 'soon')}>{d.late ? tr('Atrasado {n} d', { n: d.n }) : d.n === 0 ? tr('Hoy') : d.n === 1 ? tr('Mañana') : tr('En {n} días', { n: d.n })}</span> : null)(dueOf(st, r))}<PropLine st={st} r={r} props={props} /></div>;
  })}{!rows.length && <Empty ic="image" title={tr("No hay elementos.")} text={tr("Prueba con otra búsqueda o quita algún filtro.")} />}</div>;
}

const DOW = LANG === 'es' ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function CalendarView({ st, rows, open, onNew, onMenu, prefs, setPrefs, icons }) {
  const S = st.S, s = S.config.settings, d = s.dateCol, mode = prefs.calMode || 'month', side = prefs.calSide !== false;
  const [m, setM] = useState(() => { const n = new Date(); n.setHours(0, 0, 0, 0); return n; }), [overDay, setOverDay] = useState(null), [overSide, setOverSide] = useState(false);
  if (!d) return <Empty ic="cal" title={tr("Falta la columna de fecha")} text={tr("Elige en Ajustes → General la columna de fecha que usa el calendario.")} />;
  let days;
  if (mode === 'week') { const f = new Date(m); f.setDate(f.getDate() - (f.getDay() + 6) % 7); days = Array.from({ length: 7 }, (_, i) => { const x = new Date(f); x.setDate(f.getDate() + i); return x; }); }
  else { const f = new Date(m.getFullYear(), m.getMonth(), 1); f.setDate(1 - (f.getDay() + 6) % 7); days = Array.from({ length: 42 }, (_, i) => { const x = new Date(f); x.setDate(f.getDate() + i); return x; }); }
  const by = {}; rows.forEach(r => { if (isISO(r.v[d])) (by[r.v[d]] = by[r.v[d]] || []).push(r); }); const today = iso(new Date()), can = st.canEditCol(d);
  const unsched = rows.filter(r => !isISO(r.v[d]) && !r.tmp);
  const go = n => { const x = new Date(m); if (mode === 'week') x.setDate(x.getDate() + 7 * n); else x.setMonth(x.getMonth() + n, 1); setM(x); };
  const label = mode === 'week' ? `${days[0].toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}` : m.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  const dropOn = (e, k) => { e.preventDefault(); setOverDay(null); setOverSide(false); const [tab, id] = e.dataTransfer.getData('text/plain').split('|'); if (id && can) st.setCell(tab, id, d, k); };
  const item = r => <div class="cal-i" onContextMenu={e => onMenu(e, { row: r })} draggable={(can || st.can('moveTabs')) && !r.tmp} onDragStart={e => startDrag(e, r)} onClick={() => st.can('openPages') && open(r)}>
    {s.groupCol && r.v[s.groupCol] && <i class={'dot c-' + colorOf(st, s.groupCol, r.v[s.groupCol])} />}{icons[r.id] && <span class="ticon">{icons[r.id]}</span>}{r.v[s.titleCol] || tr('Sin título')}</div>;
  return <div class={'calwrap' + (side ? ' with-side' : '')}><div class={'cal ' + mode}><div class="cal-h"><button class="btn" onClick={() => go(-1)}>‹</button><b>{label}</b><button class="btn" onClick={() => go(1)}>›</button>
    <button class="btn" onClick={() => { const n = new Date(); n.setHours(0, 0, 0, 0); setM(n); }}>{tr("Hoy")}</button>
    <div class="seg sm-seg"><button class={mode === 'month' ? 'on' : ''} onClick={() => setPrefs({ calMode: 'month' })}>{tr("Mes")}</button><button class={mode === 'week' ? 'on' : ''} onClick={() => setPrefs({ calMode: 'week' })}>{tr("Semana")}</button></div>
    <span class="sp" /><button class={'btn' + (side ? ' on' : '')} onClick={() => setPrefs({ calSide: !side })}>{tr('Sin programar')} ({unsched.length})</button></div>
    <div class="cal-g">{DOW.map((x, i) => <div class="cal-d">{mode === 'week' ? `${x} ${days[i].getDate()}` : x}</div>)}
      {days.map(x => { const k = iso(x); return <div class={'cal-c' + (mode === 'month' && x.getMonth() !== m.getMonth() ? ' out' : '') + (k === today ? ' today' : '') + (overDay === k ? ' over' : '')} onDragOver={e => { if (can) { e.preventDefault(); if (overDay !== k) setOverDay(k); } }} onDragLeave={() => setOverDay(null)} onDrop={e => dropOn(e, k)}>
        {mode === 'month' && <div class="cal-n">{x.getDate()}{st.can('addRows') && <button class="mini plus" title={tr("Agregar en este día")} onClick={() => onNew({ [d]: k })}>+</button>}</div>}
        {mode === 'week' && st.can('addRows') && <button class="mini plus wk" title={tr("Agregar en este día")} onClick={() => onNew({ [d]: k })}>+</button>}
        {(by[k] || []).map(item)}</div>; })}</div></div>
    {side && <aside class={'unsched' + (overSide ? ' over' : '')} onDragOver={e => { if (can) { e.preventDefault(); setOverSide(true); } }} onDragLeave={() => setOverSide(false)} onDrop={e => dropOn(e, '')}>
      <div class="us-h"><b>{tr("Sin programar")}</b><span class="muted sm">{unsched.length}</span></div>
      <p class="hint">{tr("Arrastra una idea a un día para programarla. Suelta aquí para quitarle la fecha.")}</p>
      {unsched.map(item)}{!unsched.length && <p class="muted sm">{tr("Todo está programado.")}</p>}</aside>}</div>;
}
