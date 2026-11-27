// Tabla con teclado: flechas, Enter/F2, escribir para reemplazar, Tab, Supr, Ctrl+C/V, Ctrl+A, Shift para rangos.
// Además: columnas con ancho ajustable, reordenables y ocultables (por persona), título fijo y selección de filas.
import { useState, useEffect, useRef } from 'preact/hooks';
import { Field } from './ui.jsx';
import { ICON, parseFor, copyText, dueOf, clickOpensPage } from './shared.jsx';
import { fmtDate, urls } from './util.js';
import { t as tr } from './i18n.js';

const DEFAULT_W = (st, c, tc) => c === tc ? 380 : ({ checkbox: 110, auto: 70, date: 130, number: 110 }[st.type(c)] || 160);
const cellText = (st, r, c) => { const ty = st.type(c), v = r.v[c]; if (ty === 'checkbox') return v ? 'TRUE' : 'FALSE'; if (ty === 'date') return v ? fmtDate(v) : ''; return String(v ?? ''); };

export function TableView({ st, rows, cols, open, onCol, onAddCol, onNew, dups, onMenu, prefs, setPrefs, sel, setSel, icons, hiddenRows, fold, folderOps, onRowDrop, colorOf, onPasteList }) {
  const S = st.S, tc = S.config.settings.titleCol, canCol = st.can('manageColumns') || st.can('manageOptions');
  const [act, setAct] = useState(null), [anchor, setAnchor] = useState(null), [signal, setSignal] = useState({ n: 0 }), [dragCol, setDragCol] = useState(null), [overCol, setOverCol] = useState(null);
  const box = useRef(), lastRow = useRef(null), guard = useRef(null), dragFrom = useRef(null), dragRow = useRef(null), [dropAt, setDropAt] = useState(null), clickT = useRef(null), clickOpen = clickOpensPage();
  // Arrastrar con el mouse para seleccionar un rango de celdas.
  useEffect(() => { const up = () => { dragFrom.current = null; }; document.addEventListener('mouseup', up); return () => document.removeEventListener('mouseup', up); }, []);
  const W = c => (prefs.widths || {})[c] || DEFAULT_W(st, c, tc);
  const titleFirst = cols[0] === tc;
  // Mantener la celda activa dentro de los límites cuando cambian filas/columnas.
  useEffect(() => { if (act && (act.r >= rows.length || act.c >= cols.length)) setAct(rows.length && cols.length ? { r: Math.min(act.r, rows.length - 1), c: Math.min(act.c, cols.length - 1) } : null); }, [rows.length, cols.length]);
  const range = () => { if (!act) return null; const a = anchor || act; return { r0: Math.min(a.r, act.r), r1: Math.max(a.r, act.r), c0: Math.min(a.c, act.c), c1: Math.max(a.c, act.c) }; };
  const rg = range();
  const inRange = (r, c) => rg && r >= rg.r0 && r <= rg.r1 && c >= rg.c0 && c <= rg.c1;
  const focusBox = () => { const b = box.current; if (b && document.activeElement !== b && !b.contains(document.activeElement)) b.focus({ preventScroll: true }); else if (b && document.activeElement && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') b.focus({ preventScroll: true }); };
  const go = (r, c, extend) => {
    r = Math.max(0, Math.min(rows.length - 1, r)); c = Math.max(0, Math.min(cols.length - 1, c));
    if (extend) { if (!anchor) setAnchor(act); } else setAnchor(null);
    setAct({ r, c });
    requestAnimationFrame(() => { const td = box.current && box.current.querySelector(`td[data-rc="${r}:${c}"]`); td && td.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  };
  const onDone = dir => {
    requestAnimationFrame(() => box.current && box.current.focus({ preventScroll: true }));
    if (!act || !dir || dir === 'stay') return;
    if (dir === 'down') go(act.r + 1, act.c); if (dir === 'right') go(act.r, act.c + 1); if (dir === 'left') go(act.r, act.c - 1);
  };
  const edits = (fn) => { const list = []; if (!rg) return list; for (let r = rg.r0; r <= rg.r1; r++) for (let c = rg.c0; c <= rg.c1; c++) { const row = rows[r], col = cols[c]; if (!row || row.tmp || !(col in row.v) || !st.canEditCol(col)) continue; const val = fn(row, col, r - rg.r0, c - rg.c0); if (val !== undefined) list.push({ tab: row.tab, id: row.id, col, val }); } return list; };
  const onKey = e => {
    if (e.target !== box.current) return; if (!act) { if (rows.length && cols.length && /^(Arrow|Tab|Enter)/.test(e.key)) { e.preventDefault(); go(0, 0); } return; }
    const k = e.key, mod = e.ctrlKey || e.metaKey;
    if (k === 'ArrowDown') { e.preventDefault(); go(mod ? rows.length - 1 : act.r + 1, act.c, e.shiftKey); }
    else if (k === 'ArrowUp') { e.preventDefault(); go(mod ? 0 : act.r - 1, act.c, e.shiftKey); }
    else if (k === 'ArrowRight') { e.preventDefault(); go(act.r, mod ? cols.length - 1 : act.c + 1, e.shiftKey); }
    else if (k === 'ArrowLeft') { e.preventDefault(); go(act.r, mod ? 0 : act.c - 1, e.shiftKey); }
    else if (k === 'Tab') { e.preventDefault(); go(act.r, act.c + (e.shiftKey ? -1 : 1)); }
    else if (k === 'Home') { e.preventDefault(); go(act.r, 0); } else if (k === 'End') { e.preventDefault(); go(act.r, cols.length - 1); }
    else if (k === 'PageDown') { e.preventDefault(); go(act.r + 15, act.c); } else if (k === 'PageUp') { e.preventDefault(); go(act.r - 15, act.c); }
    else if (k === 'Enter' || k === 'F2') { e.preventDefault(); if (k === 'Enter' && e.shiftKey) return; if (k === 'Enter' && mod && cols[act.c] === tc) { open(rows[act.r]); return; } setAnchor(null); setSignal({ n: signal.n + 1, text: null, key: act.r + ':' + act.c }); }
    else if (k === ' ' && st.type(cols[act.c]) === 'checkbox') { e.preventDefault(); const l = edits(row => !row.v[cols[act.c]]); st.setMany(l); }
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); st.setMany(edits((row, col) => st.type(col) === 'auto' ? undefined : st.type(col) === 'checkbox' ? false : '')); }
    else if (k === 'Escape') { setAnchor(null); setSel(new Set()); }
    else if (mod && k.toLowerCase() === 'a') { e.preventDefault(); setAnchor({ r: 0, c: 0 }); setAct({ r: rows.length - 1, c: cols.length - 1 }); }
    else if (!mod && !e.altKey && k.length === 1) { const ty = st.type(cols[act.c]); if (['text', 'number', 'url', 'image', 'date'].includes(ty)) { e.preventDefault(); setAnchor(null); setSignal({ n: signal.n + 1, text: ty === 'date' ? null : k, key: act.r + ':' + act.c }); } else if (['select', 'multi', 'person'].includes(ty)) { setSignal({ n: signal.n + 1, text: null, key: act.r + ':' + act.c }); } }
  };
  const onCopy = e => { if (e.target !== box.current || !rg) return; const lines = []; for (let r = rg.r0; r <= rg.r1; r++) { const cells = []; for (let c = rg.c0; c <= rg.c1; c++) cells.push(cellText(st, rows[r], cols[c]).replace(/[\t\n]/g, ' ')); lines.push(cells.join('\t')); } e.clipboardData.setData('text/plain', lines.join('\n')); e.preventDefault(); st.toast(tr('Copiado: {n} celdas', { n: (rg.r1 - rg.r0 + 1) * (rg.c1 - rg.c0 + 1) })); };
  const onPaste = e => {
    if (e.target !== box.current) return;
    const raw = e.clipboardData.getData('text/plain').replace(/\r/g, '').replace(/\n+$/, ''), many = raw.includes('\n') && !raw.includes('\t');
    // Una lista de varias líneas sin celdas elegidas (o pegada en la columna de título) se ofrece como filas nuevas.
    if (many && onPasteList && st.can('addRows') && (!act || (cols[act.c] === tc && !(rg && rg.r1 > rg.r0)))) { e.preventDefault(); if (!act || confirm(tr('¿Crear filas nuevas con estas {n} líneas?\n\nAceptar: una fila por línea. Cancelar: pegar en las celdas de abajo.', { n: raw.split('\n').filter(l => l.trim()).length }))) { onPasteList(raw); return; } }
    if (!act) return; e.preventDefault();
    const grid = e.clipboardData.getData('text/plain').replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
    const single = grid.length === 1 && grid[0].length === 1, list = [];
    const r0 = rg ? rg.r0 : act.r, c0 = rg ? rg.c0 : act.c, rN = single && rg ? rg.r1 - rg.r0 + 1 : grid.length, cN = single && rg ? rg.c1 - rg.c0 + 1 : grid[0].length;
    for (let i = 0; i < rN; i++) for (let j = 0; j < cN; j++) {
      const row = rows[r0 + i], col = cols[c0 + j]; if (!row || !col || row.tmp || !(col in row.v) || !st.canEditCol(col)) continue;
      const txt = single ? grid[0][0] : (grid[i] || [])[j]; if (txt === undefined) continue; list.push({ tab: row.tab, id: row.id, col, val: parseFor(st.type(col), txt) });
    }
    if (list.length) { st.setMany(list); st.toast(tr(list.length === 1 ? 'Pegado en 1 celda' : 'Pegado en {n} celdas', { n: list.length })); }
    setAnchor({ r: r0, c: c0 }); setAct({ r: Math.min(rows.length - 1, r0 + rN - 1), c: Math.min(cols.length - 1, c0 + cN - 1) });
  };
  // Ajustar ancho
  const startResize = (e, c) => { e.preventDefault(); e.stopPropagation(); const x0 = e.clientX, w0 = W(c); const mv = ev => setPrefs({ widths: { ...(prefs.widths || {}), [c]: Math.max(60, Math.round(w0 + ev.clientX - x0)) } }); const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); document.body.classList.remove('resizing'); }; document.body.classList.add('resizing'); document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); };
  // Selección de filas desde el número
  const clickNum = (e, i) => { const id = rows[i].id; const n = new Set(e.ctrlKey || e.metaKey ? sel : []); if (e.shiftKey && lastRow.current != null) { const [a, b] = [lastRow.current, i].sort((x, y) => x - y); for (let k = a; k <= b; k++) n.add(rows[k].id); } else if ((e.ctrlKey || e.metaKey) && sel.has(id)) n.delete(id); else n.add(id); lastRow.current = i; setSel(n); };
  const allSel = rows.length > 0 && rows.every(r => sel.has(r.id));
  // Cada carpeta abierta va en su propio <tbody>: así su encabezado fijo solo se queda arriba mientras se ven sus filas.
  const headEl = h => <FolderHead key={'f:' + h.key} h={h} span={cols.length + (st.can('manageColumns') ? 1 : 0)} ops={folderOps} pin={!!(folderOps && folderOps.isPinned(h.key))} />;
  const segments = trs => {
    if (!fold) return <tbody>{trs}</tbody>;
    const out = []; let cur = null; const flush = () => { if (cur) { out.push(<tbody key={cur.key} class={cur.f ? 'fseg' : ''}>{cur.items}</tbody>); cur = null; } };
    for (let i = 0; i < rows.length; i++) {
      for (const h of fold.heads.filter(x => x.at === i)) { flush(); if (h.closed || !h.count) out.push(<tbody key={'h:' + h.key}>{headEl(h)}</tbody>); else cur = { key: 'f:' + h.key, f: h.key, items: [headEl(h)] }; }
      const info = fold.info.get(rows[i].id);
      if (cur && cur.f && info && info.key === cur.f) cur.items.push(trs[i]); else { if (!cur || cur.f) { flush(); cur = { key: 'p:' + i, items: [] }; } cur.items.push(trs[i]); }
    }
    flush(); fold.heads.filter(h => h.at >= rows.length).forEach(h => out.push(<tbody key={'h:' + h.key}>{headEl(h)}</tbody>));
    return out;
  };
  const NW = prefs.hideNums ? 26 : 44;
  useEffect(() => { const b = box.current, th = b && b.querySelector('thead'); if (th) b.style.setProperty('--thh', th.offsetHeight + 'px'); });
  // El encabezado fijo de una carpeta se empuja hacia arriba cuando su última fila sale de la vista.
  useEffect(() => {
    const b = box.current, sc = b && b.closest('.body'); if (!sc) return;
    const run = () => { const thh = (b.querySelector('thead') || {}).offsetHeight || 35, top = sc.getBoundingClientRect().top;
      b.querySelectorAll('tbody.fseg > tr.fhead.pin').forEach(tr => { const tb = tr.parentElement.getBoundingClientRect(), hh = tr.offsetHeight; const pt = Math.min(thh, tb.bottom - top - hh); tr.style.setProperty('--pt', pt + 'px'); }); };
    run(); sc.addEventListener('scroll', run, { passive: true }); return () => sc.removeEventListener('scroll', run);
  });
  const tsv = () => { const lines = []; for (let r = rg.r0; r <= rg.r1; r++) { const cells = []; for (let c = rg.c0; c <= rg.c1; c++) cells.push(cellText(st, rows[r], cols[c]).replace(/[\t\n]/g, ' ')); lines.push(cells.join('\t')); } return lines.join('\n'); };
  // Clic derecho: si cae dentro de un rango de varias celdas (o de varias filas marcadas) el menú actúa sobre todas.
  const ctxMenu = (e, r, i) => {
    const td = e.target.closest('td[data-rc]'), j = td ? +td.dataset.rc.split(':')[1] : -1, col = td && td.dataset.col;
    const multiCells = rg && (rg.r0 !== rg.r1 || rg.c0 !== rg.c1) && j >= 0 && inRange(i, j);
    if (multiCells) { const cells = (rg.r1 - rg.r0 + 1) * (rg.c1 - rg.c0 + 1); onMenu(e, { multi: true, rows: rows.slice(rg.r0, rg.r1 + 1), cols: cols.slice(rg.c0, rg.c1 + 1), cells, copy: () => copyText(tsv(), st, tr('Copiado: {n} celdas', { n: cells })), clear: () => st.setMany(edits((row, c) => st.type(c) === 'auto' ? undefined : st.type(c) === 'checkbox' ? false : '')) }); return; }
    if (sel.size > 1 && sel.has(r.id)) { onMenu(e, { multi: true, rows: rows.filter(x => sel.has(x.id)), cols, fromSel: true }); return; }
    if (j >= 0) { setAnchor(null); setAct({ r: i, c: j }); }
    onMenu(e, { row: r, col, table: true });
  };
  // Columnas fijas: el título (si va primero) y todas hasta la columna elegida en «Fijar columnas hasta aquí».
  const frozenTo = Math.max(titleFirst ? 0 : -1, prefs.freezeTo ? cols.indexOf(prefs.freezeTo) : -1);
  const lefts = {}; { let x = NW; cols.forEach((c, j) => { if (j <= frozenTo) { lefts[c] = x + 'px'; x += W(c); } }); }
  const left = c => lefts[c];
  const fz = c => c in lefts ? 'sticky ' + (cols.indexOf(c) === frozenTo ? 'fzlast ' : '') : '';
  return <div class="tablewrap"><div class="gridbox" ref={box} tabIndex={0} onKeyDown={onKey} onCopy={onCopy} onPaste={onPaste}>
    <table class={'grid fixed' + (prefs.rowH === 'compact' ? ' compact' : '') + (prefs.hideNums ? ' nonum' : '')} style={{ width: (NW + cols.reduce((a, c) => a + W(c), 0) + (st.can('manageColumns') ? 44 : 0)) + 'px' }}>
      <colgroup><col style={{ width: NW + 'px' }} />{cols.map(c => <col style={{ width: W(c) + 'px' }} />)}{st.can('manageColumns') && <col style={{ width: '44px' }} />}</colgroup>
      <thead><tr><th class="num sticky" onContextMenu={e => onMenu(e, { nums: true })} title={prefs.hideNums ? tr('Clic derecho: mostrar números de fila') : tr('Clic derecho: ocultar números de fila')}><input type="checkbox" title={tr("Seleccionar todas")} checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(rows.map(r => r.id)))} /></th>
        {cols.map(c => <th draggable onDragStart={e => { setDragCol(c); e.dataTransfer.setData('text/kuadro-col', c); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDragCol(null); setOverCol(null); }}
          onDragOver={e => { if (dragCol && dragCol !== c) { e.preventDefault(); setOverCol(c); } }} onDrop={e => { e.preventDefault(); const from = e.dataTransfer.getData('text/kuadro-col'); setOverCol(null); setDragCol(null); if (!from || from === c) return; const order = cols.filter(x => x !== from); order.splice(order.indexOf(c) + (cols.indexOf(from) < cols.indexOf(c) ? 1 : 0), 0, from); setPrefs({ order }); }}
          onContextMenu={e => onMenu(e, { col: c })} class={(c === tc ? 'title ' : '') + fz(c) + (canCol ? 'click ' : '') + (overCol === c ? 'colover' : '')} style={{ left: left(c) }} onClick={() => canCol && onCol(c)} title={canCol ? tr('Clic: editar · arrastra para mover · clic derecho: más opciones') : ''}>
          <span class="th-in"><span class="tyi">{ICON[st.type(c)]}</span>{c}</span><span class="rz" onMouseDown={e => startResize(e, c)} onClick={e => e.stopPropagation()} onDblClick={e => { e.stopPropagation(); const w = { ...(prefs.widths || {}) }; delete w[c]; setPrefs({ widths: w }); }} /></th>)}
        {st.can('manageColumns') && <th class="add click" onClick={onAddCol} title={tr("Agregar columna")}>+</th>}</tr></thead>
      {segments(rows.map((r, i) => <tr key={r.id} class={(r.tmp ? 'tmp ' : '') + (sel.has(r.id) ? 'selrow ' : '') + (hiddenRows && hiddenRows.has(r.id) ? 'hidrow ' : '') + (dropAt && dropAt.id === r.id ? (dropAt.after ? 'drop-after ' : 'drop-before ') : '') + (colorOf && colorOf(r) ? 'rc rc-' + colorOf(r) : '')} onContextMenu={e => ctxMenu(e, r, i)}
          onDragOver={e => { const d = dragRow.current; if (!d || !e.dataTransfer.types.includes('text/kuadro-row')) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const b = e.currentTarget.getBoundingClientRect(), after = e.clientY > b.top + b.height / 2; if (!dropAt || dropAt.id !== r.id || dropAt.after !== after) setDropAt({ id: r.id, after }); }}
          onDrop={e => { const d = dragRow.current; if (!d || !dropAt) return; e.preventDefault(); const at = dropAt; setDropAt(null); dragRow.current = null; if (d.id !== r.id && onRowDrop) onRowDrop(d, r, at.after); }}>
        <td class={'num sticky' + ((st.can('moveTabs') || (folderOps && folderOps.can)) && !r.tmp ? ' grab' : '') + (fold && fold.info.get(r.id) ? ' inf' + (fold.info.get(r.id).last ? ' inf-last' : '') : '')} draggable={(st.can('moveTabs') || (folderOps && folderOps.can)) && !r.tmp} onClick={e => clickNum(e, i)} title={tr("Clic: seleccionar · Ctrl/Shift: varias · arrastra para reacomodar, o suéltala en una pestaña o carpeta")} onDragStart={e => { e.dataTransfer.setData('text/plain', r.tab + '|' + r.id); e.dataTransfer.setData('text/kuadro-row', r.id); e.dataTransfer.effectAllowed = 'move'; dragRow.current = r; }} onDragEnd={() => { dragRow.current = null; setDropAt(null); }}>
          {sel.has(r.id) ? <input type="checkbox" checked readOnly /> : <><span class="n">{i + 1}</span><span class="h">⠿</span></>}</td>
        {cols.map((c, j) => c in r.v ? <td data-col={c} data-rc={i + ':' + j} style={{ left: left(c) }} class={(c === tc ? 'title ' : '') + fz(c) + (act && act.r === i && act.c === j ? 'act ' : '') + (inRange(i, j) && rg && (rg.r0 !== rg.r1 || rg.c0 !== rg.c1) ? 'inrg ' : '') + (c === st.S.config.settings.dateCol ? (d => d ? (d.late ? 'due-late' : 'due-soon') : '')(dueOf(st, r)) : '')}
          onMouseDown={e => { if (e.detail > 1) clearTimeout(clickT.current); if (e.button !== 0 || e.target.closest('.pop, textarea, input, a, button')) return; if (e.shiftKey && act) { e.preventDefault(); if (!anchor) setAnchor(act); setAct({ r: i, c: j }); } else if (!(act && act.r === i && act.c === j)) { setAnchor(null); setAct({ r: i, c: j }); guard.current = i + ':' + j; setTimeout(() => { if (guard.current === i + ':' + j) guard.current = null; }, 400); } if (!e.shiftKey) dragFrom.current = { r: i, c: j }; focusBox(); }}
          onMouseEnter={e => { const d = dragFrom.current; if (!d || !(e.buttons & 1) || (d.r === i && d.c === j && !anchor)) return; guard.current = null; setAnchor(d); setAct({ r: i, c: j }); }}
          onClick={e => { if (!clickOpen || c !== tc || r.tmp || e.shiftKey || e.ctrlKey || e.metaKey || e.detail > 1 || e.target.closest('.pop, textarea, input, a, button, .prog') || (rg && (rg.r0 !== rg.r1 || rg.c0 !== rg.c1))) return; clearTimeout(clickT.current); clickT.current = setTimeout(() => open(r), 230); }}
          onDblClick={e => { clearTimeout(clickT.current); if (e.target.closest('.pop, textarea, input')) return; guard.current = null; setAct({ r: i, c: j }); setSignal({ n: signal.n + 1, text: null, key: i + ':' + j }); }}>
          {c === tc && st.can('openPages') && <button class="openbtn" onClick={() => open(r)}>{tr("Abrir")}</button>}{c === tc && icons && icons[r.id] && <span class="ticon">{icons[r.id]}</span>}{c === tc && (() => { const pg = st.progressOf(r.id); return pg.total ? <span class={'prog sm' + (pg.done === pg.total ? ' full' : '')} title={tr('{d} de {t} tareas hechas', { d: pg.done, t: pg.total })}><span class="pt"><i style={{ width: Math.round(100 * pg.done / pg.total) + '%' }} /></span><b>{pg.done}/{pg.total}</b></span> : null; })()}
          <Field st={st} row={r} col={c} table guard={() => { if (clickOpen && c === tc) return true; if (guard.current === i + ':' + j) { guard.current = null; return true; } return false; }} active={!!act && act.r === i && act.c === j} signal={signal.key === i + ':' + j ? signal : null} onConsumed={() => setSignal(x => ({ ...x, key: null }))} onDone={onDone} />
          {c === tc && dups.has(r.id) && <span class="dup" title={tr("Hay otro elemento con el mismo título")}>{tr("Duplicado")}</span>}</td> : <td class="na" data-rc={i + ':' + j} />)}
        {st.can('manageColumns') && <td class="na" />}</tr>))}</table>
    {!rows.length && <div class="empty">{tr("No hay filas que coincidan.")}</div>}
    <div class="lrow0">{st.can('addRows') && <button class="addrow" onClick={() => onNew({})}>{tr("+ Nueva fila")}</button>}{folderOps && folderOps.can && folderOps.newFolder && <button class="addrow" onClick={folderOps.newFolder}>{tr("+ Nueva carpeta")}</button>}{onPasteList && st.can('addRows') && <button class="addrow" onClick={() => onPasteList('')}>{tr("Pegar lista de ideas…")}</button>}</div>
    <div class="kbhint muted sm">{tr("Flechas para moverte · Enter o escribir para editar · Shift para seleccionar varias · Ctrl+C / Ctrl+V · Supr para vaciar · Ctrl+Z para deshacer")}</div>
  </div></div>;
}

// Encabezado de una carpeta: clic para colapsar, doble clic para renombrar, se puede soltar una fila encima.
function FolderHead({ h, span, ops, pin }) {
  const [ren, setRen] = useState(false), [over, setOver] = useState(false), [v, setV] = useState(h.name), ref = useRef();
  useEffect(() => { if (ren && ref.current) { ref.current.focus(); ref.current.select(); } }, [ren]);
  const save = async () => { const n = v.trim(); setRen(false); if (n && n !== h.name) { const r = await ops.rename(h, n); if (!r) setV(h.name); } else setV(h.name); };
  return <tr class={'fhead' + (h.closed ? ' closed' : '') + (over ? ' over' : '') + (pin && !h.closed ? ' pin' : '')} onClick={() => !ren && ops.toggle(h.key)} onContextMenu={e => ops.menu(e, h, () => { setV(h.name); setRen(true); })}
    onDragOver={e => { if (ops.can && e.dataTransfer.types.includes('text/plain')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); } }} onDragLeave={() => setOver(false)}
    onDrop={e => { e.preventDefault(); setOver(false); const [from, id] = e.dataTransfer.getData('text/plain').split('|'); if (id) ops.drop(h, from, id); }}>
    <td class={'num sticky fh-num' + (h.closed || !h.count ? '' : ' open')} />
    <td colSpan={span} class="fh"><span class="fh-in"><span class="fh-chev">{h.closed ? '▸' : '▾'}</span>{h.group ? (h.color ? <span class={'fh-dot c-' + h.color} /> : <span class="fh-ic">◇</span>) : <span class="fh-ic">📁</span>}
      {ren ? <input ref={ref} class="fh-ren" value={v} maxLength={80} onClick={e => e.stopPropagation()} onInput={e => setV(e.target.value)} onBlur={save} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') save(); if (e.key === 'Escape') { setV(h.name); setRen(false); } }} />
        : <b class="fh-name" onDblClick={e => { e.stopPropagation(); if (ops.can && !h.group) { setV(h.name); setRen(true); } }}>{h.group && !h.name ? tr('(vacío)') : h.name}</b>}
      <span class="fh-n">{h.count}</span>{pin && !h.closed && <span class="fh-pin" title={tr('Fijado al desplazar')}>📌</span>}{!h.count && !h.group && <span class="muted sm">{tr('vacía · arrastra filas aquí o usa clic derecho → Mover a carpeta')}</span>}</span></td></tr>;
}
// Barra de edición masiva para las filas seleccionadas.
export function BulkBar({ st, rows, sel, setSel, onMenuAt }) {
  const S = st.S, s = S.config.settings, list = rows.filter(r => sel.has(r.id) && !r.tmp);
  if (!sel.size) return null;
  return <div class="bulk"><b>{tr(sel.size === 1 ? '1 seleccionado' : '{n} seleccionados', { n: sel.size })}</b>
    {s.groupCol && (st.canEditCol(s.groupCol) || st.can('moveCards')) && <button class="btn" onClick={e => onMenuAt(e, 'group', list)}>{tr('Cambiar')} {s.groupCol.toLowerCase()} ▾</button>}
    <button class="btn" onClick={e => onMenuAt(e, 'set', list)}>{tr("Editar campo ▾")}</button>
    {st.can('moveTabs') && <button class="btn" onClick={e => onMenuAt(e, 'move', list)}>{tr("Mover a ▾")}</button>}
    {st.can('addRows') && <button class="btn" onClick={() => { list.forEach(r => { const v = {}; Object.entries(r.v).forEach(([k, x]) => { if (st.type(k) !== 'auto' && x !== '' && x !== false) v[k] = x; }); v[s.titleCol] = (r.v[s.titleCol] || '') + tr(' (copia)'); st.addRow(r.tab, v, { page: (S.pages[r.id] || {}).md || '' }); }); setSel(new Set()); }}>{tr("Duplicar")}</button>}
    {st.can('deleteRows') && <button class="btn danger-t" onClick={() => { if (confirm(tr(list.length === 1 ? '¿Eliminar 1 elemento del Sheet?' : '¿Eliminar {n} elementos del Sheet?', { n: list.length }))) { list.forEach(r => st.deleteRow(r.tab, r.id)); setSel(new Set()); } }}>{tr("Eliminar")}</button>}
    <span class="sp" /><button class="icon" title={tr("Quitar selección (Esc)")} onClick={() => setSel(new Set())}>✕</button></div>;
}
