// Tabla con teclado: flechas, Enter/F2, escribir para reemplazar, Tab, Supr, Ctrl+C/V, Ctrl+A, Shift para rangos.
// Además: columnas con ancho ajustable, reordenables y ocultables (por persona), título fijo y selección de filas.
import { useState, useEffect, useRef } from 'preact/hooks';
import { Field } from './ui.jsx';
import { ICON, parseFor } from './shared.jsx';
import { fmtDate, urls } from './util.js';
import { t as tr } from './i18n.js';

const DEFAULT_W = (st, c, tc) => c === tc ? 380 : ({ checkbox: 110, auto: 70, date: 130, number: 110 }[st.type(c)] || 160);
const cellText = (st, r, c) => { const ty = st.type(c), v = r.v[c]; if (ty === 'checkbox') return v ? 'TRUE' : 'FALSE'; if (ty === 'date') return v ? fmtDate(v) : ''; return String(v ?? ''); };

export function TableView({ st, rows, cols, open, onCol, onAddCol, onNew, dups, onMenu, prefs, setPrefs, sel, setSel, icons }) {
  const S = st.S, tc = S.config.settings.titleCol, canCol = st.can('manageColumns') || st.can('manageOptions');
  const [act, setAct] = useState(null), [anchor, setAnchor] = useState(null), [signal, setSignal] = useState({ n: 0 }), [dragCol, setDragCol] = useState(null), [overCol, setOverCol] = useState(null);
  const box = useRef(), lastRow = useRef(null), guard = useRef(null);
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
    if (e.target !== box.current || !act) return; e.preventDefault();
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
  const left = c => c === tc && titleFirst ? '44px' : undefined;
  return <div class="tablewrap"><div class="gridbox" ref={box} tabIndex={0} onKeyDown={onKey} onCopy={onCopy} onPaste={onPaste}>
    <table class="grid fixed" style={{ width: (44 + cols.reduce((a, c) => a + W(c), 0) + (st.can('manageColumns') ? 44 : 0)) + 'px' }}>
      <colgroup><col style={{ width: '44px' }} />{cols.map(c => <col style={{ width: W(c) + 'px' }} />)}{st.can('manageColumns') && <col style={{ width: '44px' }} />}</colgroup>
      <thead><tr><th class="num sticky"><input type="checkbox" title={tr("Seleccionar todas")} checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(rows.map(r => r.id)))} /></th>
        {cols.map(c => <th draggable onDragStart={e => { setDragCol(c); e.dataTransfer.setData('text/kuadro-col', c); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDragCol(null); setOverCol(null); }}
          onDragOver={e => { if (dragCol && dragCol !== c) { e.preventDefault(); setOverCol(c); } }} onDrop={e => { e.preventDefault(); const from = e.dataTransfer.getData('text/kuadro-col'); setOverCol(null); setDragCol(null); if (!from || from === c) return; const order = cols.filter(x => x !== from); order.splice(order.indexOf(c) + (cols.indexOf(from) < cols.indexOf(c) ? 1 : 0), 0, from); setPrefs({ order }); }}
          onContextMenu={e => onMenu(e, { col: c })} class={(c === tc ? 'title ' : '') + (c === tc && titleFirst ? 'sticky ' : '') + (canCol ? 'click ' : '') + (overCol === c ? 'colover' : '')} style={{ left: left(c) }} onClick={() => canCol && onCol(c)} title={canCol ? tr('Clic: editar · arrastra para mover · clic derecho: más opciones') : ''}>
          <span class="th-in"><span class="tyi">{ICON[st.type(c)]}</span>{c}</span><span class="rz" onMouseDown={e => startResize(e, c)} onClick={e => e.stopPropagation()} onDblClick={e => { e.stopPropagation(); const w = { ...(prefs.widths || {}) }; delete w[c]; setPrefs({ widths: w }); }} /></th>)}
        {st.can('manageColumns') && <th class="add click" onClick={onAddCol} title={tr("Agregar columna")}>+</th>}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r.id} class={(r.tmp ? 'tmp ' : '') + (sel.has(r.id) ? 'selrow' : '')} onContextMenu={e => { const td = e.target.closest('td[data-col]'); onMenu(e, { row: r, col: td && td.dataset.col, list: rows }); }}>
        <td class={'num sticky' + (st.can('moveTabs') && !r.tmp ? ' grab' : '')} draggable={st.can('moveTabs') && !r.tmp} onClick={e => clickNum(e, i)} title="Clic: seleccionar · Ctrl/Shift: varias · arrastra a una pestaña para moverla" onDragStart={e => { e.dataTransfer.setData('text/plain', r.tab + '|' + r.id); e.dataTransfer.effectAllowed = 'move'; }}>
          {sel.has(r.id) ? <input type="checkbox" checked readOnly /> : <><span class="n">{i + 1}</span><span class="h">⠿</span></>}</td>
        {cols.map((c, j) => c in r.v ? <td data-col={c} data-rc={i + ':' + j} style={{ left: left(c) }} class={(c === tc ? 'title ' : '') + (c === tc && titleFirst ? 'sticky ' : '') + (act && act.r === i && act.c === j ? 'act ' : '') + (inRange(i, j) && rg && (rg.r0 !== rg.r1 || rg.c0 !== rg.c1) ? 'inrg' : '')}
          onMouseDown={e => { if (e.button !== 0 || e.target.closest('.pop, textarea, input, a, button')) return; if (e.shiftKey && act) { e.preventDefault(); if (!anchor) setAnchor(act); setAct({ r: i, c: j }); } else if (!(act && act.r === i && act.c === j)) { setAnchor(null); setAct({ r: i, c: j }); guard.current = i + ':' + j; setTimeout(() => { if (guard.current === i + ':' + j) guard.current = null; }, 400); } focusBox(); }}
          onDblClick={e => { if (e.target.closest('.pop, textarea, input')) return; setAct({ r: i, c: j }); setSignal({ n: signal.n + 1, text: null, key: act.r + ':' + act.c }); }}>
          {c === tc && st.can('openPages') && <button class="openbtn" onClick={() => open(r)}>{tr("Abrir")}</button>}{c === tc && icons && icons[r.id] && <span class="ticon">{icons[r.id]}</span>}
          <Field st={st} row={r} col={c} table guard={() => { if (guard.current === i + ':' + j) { guard.current = null; return true; } return false; }} active={!!act && act.r === i && act.c === j} signal={signal.key === i + ':' + j ? signal : null} onConsumed={() => setSignal(x => ({ ...x, key: null }))} onDone={onDone} />
          {c === tc && dups.has(r.id) && <span class="dup" title={tr("Hay otro elemento con el mismo título")}>{tr("Duplicado")}</span>}</td> : <td class="na" data-rc={i + ':' + j} />)}
        {st.can('manageColumns') && <td class="na" />}</tr>)}</tbody></table>
    {!rows.length && <div class="empty">{tr("No hay filas que coincidan.")}</div>}
    {st.can('addRows') && <button class="addrow" onClick={() => onNew({})}>{tr("+ Nueva fila")}</button>}
    <div class="kbhint muted sm">{tr("Flechas para moverte · Enter o escribir para editar · Shift para seleccionar varias · Ctrl+C / Ctrl+V · Supr para vaciar · Ctrl+Z para deshacer")}</div>
  </div></div>;
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
