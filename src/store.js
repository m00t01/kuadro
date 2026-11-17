// Motor de datos: lee y escribe el Sheet ubicando cada fila por su ID, nunca por posición.
import { q, colL, colI, serialToISO, isISO, newId, norm, chunk, urls } from './util.js';
import DMP from 'diff-match-patch';
import { t as tr } from './i18n.js';

export const APP = { config: '_app_config', pages: '_app_pages', comments: '_app_comments', history: '_app_history' };
const PRESENCE = '_app_presence';
const KV_HEAD = ['clave', 'actualizado', 'autor', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
const HEAD = {
  [APP.config]: KV_HEAD, [APP.pages]: KV_HEAD,
  [APP.comments]: ['id', 'fila', 'autor', 'nombre', 'fecha', 'texto', 'padre', 'editado', 'borrado'],
  [APP.history]: ['fecha', 'usuario', 'pestaña', 'fila', 'columna', 'antes', 'despues', 'tipo', 'titulo'],
};
const CHUNK = 40000, MAXCHUNKS = 8;
export const TYPES = { text: tr('Texto'), number: tr('Número'), select: tr('Selección'), multi: tr('Selección múltiple'), date: tr('Fecha'), checkbox: tr('Casilla'), url: tr('Enlace'), person: tr('Persona'), image: tr('Imagen'), auto: tr('Número fijo automático') };
export const PERMS = [
  ['openPages', tr('Abrir páginas')], ['editPages', tr('Editar el contenido de las páginas')], ['editCells', tr('Editar celdas')],
  ['addRows', tr('Agregar filas')], ['deleteRows', tr('Eliminar filas')], ['moveCards', tr('Mover tarjetas')], ['moveTabs', tr('Mover elementos entre pestañas')], ['addCards', tr('Agregar tarjetas')],
  ['manageColumns', tr('Agregar, renombrar y eliminar columnas')], ['manageTabs', tr('Crear, renombrar y eliminar pestañas')], ['manageOptions', tr('Editar opciones de los desplegables')],
  ['comment', tr('Comentar')], ['upload', tr('Subir imágenes')], ['viewHistory', tr('Ver historial')], ['undo', tr('Deshacer cambios')],
  ['admin', tr('Administrar roles, usuarios y ajustes')],
];
export const COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
const KNOWN = { green: /publicad|finalizad|listo|hecho|complet|aprobad|published|done|finished|approved|ready/i, yellow: /editando|en proceso|progreso|revisi|editing|in progress|review/i, blue: /graband|program|recording|scheduled/i, red: /descartad|falta|cancel|bloque|discarded|missing|blocked/i, gray: /pendiente|esperando|idea|pending|waiting|backlog/i };
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const pickColor = name => Object.keys(KNOWN).find(c => KNOWN[c].test(name)) || COLORS[1 + hash(name) % (COLORS.length - 1)];
const blankConfig = () => ({ owner: '', schema: {}, settings: { titleCol: '', groupCol: '', dateCol: '', imageCol: '', ytKey: '', folderId: '' }, roles: [], users: [], templates: [], defaultRoleId: 'visit' });
const eq = (a, b) => String(a ?? '') === String(b ?? '') || ((a === false || a === '') && (b === false || b === ''));
const now = () => new Date().toISOString();

export function createStore(api, me, opts = {}) {
  const S = { rev: 0, status: 'loading', error: '', title: '', tabs: {}, order: [], config: blankConfig(), pages: {}, pageMeta: {}, merged: {}, comments: [], history: [], presence: [], conflicts: [], toasts: [], pending: 0, prepared: false, readOnly: false, authExpired: false, lastSync: 0, undo: [], redo: [], me };
  const pageBase = {}; const dmp = new DMP();
  const subs = new Set(), opt = new Map(), newRows = new Map(), gone = new Set(), dirty = new Set(), order = new Map();
  const emit = () => { S.rev++; subs.forEach(f => f()); };
  const toast = (msg, kind = 'info') => { const t = { id: newId(), msg, kind }; S.toasts = [...S.toasts.filter(x => x.msg !== msg).slice(-2), t]; emit(); const tm = setTimeout(() => { S.toasts = S.toasts.filter(x => x !== t); emit(); }, 6000); tm.unref && tm.unref(); };
  const fail = e => {
    if (e && e.auth) { S.authExpired = true; emit(); return; }
    if (e && e.status === 403) { S.readOnly = true; toast(tr('Tu cuenta de Google solo puede ver este Sheet; no se guardó el cambio.'), 'error'); } else toast(e && e.message || String(e), 'error');
  };
  let chain = Promise.resolve();
  const enqueue = fn => { S.pending++; emit(); const p = chain.then(fn).catch(fail).finally(() => { S.pending--; emit(); }); chain = p; return p; };

  const type = col => S.config.schema[col]?.type || 'text';
  const user = () => S.config.users.find(u => u.email.toLowerCase() === (me.email || '').toLowerCase());
  const myName = () => user()?.name || me.name || me.email;
  const perms = () => {
    if (!S.prepared) return {};
    if (S.config.owner.toLowerCase() === (me.email || '').toLowerCase()) return { admin: true };
    const u = user(); const role = S.config.roles.find(r => r.id === (u?.roleId || S.config.defaultRoleId)) || { perms: {} };
    return { ...role.perms, ...(u?.overrides || {}) };
  };
  const can = p => { const x = perms(); if (S.readOnly && p !== 'openPages' && p !== 'viewHistory') return false; if (p === 'moveTabs' && x.moveTabs === undefined) p = 'moveCards'; return !!(x.admin || x[p]); };
  const hiddenCols = () => { const x = perms(); return x.admin ? [] : x.hiddenCols || []; };
  const hiddenTabs = () => { const x = perms(); return x.admin ? [] : x.hiddenTabs || []; };
  const canEditCol = col => { const x = perms(); if (!can('editCells') || type(col) === 'auto') return false; return x.admin || ((!x.editableCols || !x.editableCols.length || x.editableCols.includes(col)) && !hiddenCols().includes(col)); };

  const normVal = (raw, ty) => {
    if (ty === 'checkbox') return raw === true || raw === 'TRUE';
    if (raw == null || raw === '') return '';
    if (ty === 'date') return typeof raw === 'number' ? serialToISO(raw) : String(raw);
    if (typeof raw === 'boolean') return raw ? 'TRUE' : 'FALSE';
    return String(raw);
  };
  function parseTab(title, sheetId, values) {
    const header = (values[0] || []).map(h => String(h ?? '').trim()); const idCol = header.indexOf('ID'); const rows = [];
    for (let r = 1; r < values.length; r++) {
      const raw = values[r] || []; const v = {}; let has = false;
      header.forEach((h, c) => { if (!h || c === idCol) return; const ty = type(h); v[h] = normVal(raw[c], ty); if (ty !== 'auto' && raw[c] != null && raw[c] !== '' && raw[c] !== false) has = true; });
      const id = idCol >= 0 ? String(raw[idCol] ?? '').trim() : '';
      if (!has && !id) continue;
      rows.push({ id: id || `tmp:${title}:${r}`, tmp: !id, r, v, tab: title });
    }
    return { title, sheetId, header, idCol, rows };
  }
  function applyOpt() {
    for (const [k, val] of opt) { const [tab, id, col] = k.split('|'); const row = S.tabs[tab]?.rows.find(r => r.id === id); if (row) row.v[col] = val; }
    for (const row of newRows.values()) { const T = S.tabs[row.tab]; if (T && !T.rows.some(r => r.id === row.id)) T.rows.push(row); }
    for (const [id, o] of order) if (S.tabs[o.tab]) optPlace(S.tabs[o.tab], id, o.targetId, o.after);
    if (gone.size) for (const T of Object.values(S.tabs)) T.rows = T.rows.filter(r => !gone.has(T.title + '|' + r.id));
  }
  const readKV = values => { const m = {}; (values || []).slice(1).forEach(r => { if (r[0] !== '' && r[0] != null) m[String(r[0])] = { at: r[1] || '', by: r[2] || '', text: r.slice(3).map(x => String(x ?? '')).join('') }; }); return m; };

  async function fetchAll() {
    const meta = await api.meta();
    const data = meta.sheets.filter(s => !s.title.startsWith('_app_') && !s.hidden);
    const app = Object.values(APP).filter(t => meta.sheets.some(s => s.title === t));
    const pres = meta.sheets.some(s => s.title === PRESENCE);
    const res = await api.batchGet([...data.map(s => q(s.title)), ...app.map(q), ...(pres ? [q(PRESENCE)] : [])]);
    const appVals = {}; app.forEach((t, i) => appVals[t] = res[data.length + i]);
    return { meta, data, res, appVals, presence: pres ? res[data.length + app.length] : null, prepared: app.length === 4 };
  }
  function apply(f, initial) {
    const prev = S.tabs, prevComments = S.comments.length, prevHistory = S.history.length;
    S.title = f.meta.title; S.prepared = f.prepared; S.meta = f.meta;
    if (f.appVals[APP.config]) { const kv = readKV(f.appVals[APP.config]); if (kv.config) try { const c = JSON.parse(kv.config.text); S.config = { ...blankConfig(), ...c, settings: { ...blankConfig().settings, ...c.settings } }; } catch { } }
    const tabs = {}, order = [];
    f.data.forEach((s, i) => { const t = parseTab(s.title, s.sheetId, f.res[i]); if (!t.header.some(Boolean)) return; tabs[s.title] = t; order.push(s.title); });
    S.tabs = tabs; S.order = order; applyOpt();
    if (f.appVals[APP.pages]) {
      const kv = readKV(f.appVals[APP.pages]); const pages = {}, metas = {};
      for (const k in kv) { if (k.startsWith('meta:')) { try { metas[k.slice(5)] = JSON.parse(kv[k].text); } catch { } continue; } pages[k] = { md: kv[k].text, at: kv[k].at, by: kv[k].by }; if (!dirty.has(k)) pageBase[k] = kv[k].text; }
      for (const id of dirty) if (S.pages[id]) pages[id] = S.pages[id];
      S.pages = pages; S.pageMeta = metas;
    }
    if (f.appVals[APP.comments]) S.comments = f.appVals[APP.comments].slice(1).filter(r => r[0]).map(r => ({ id: String(r[0]), rowId: String(r[1] ?? ''), author: r[2] || '', name: r[3] || '', at: r[4] || '', text: String(r[5] ?? ''), parent: String(r[6] ?? ''), edited: r[7] || '', deleted: !!r[8] && r[8] !== 'FALSE' }));
    S.presence = (f.presence || []).slice(1).filter(r => r[0] && String(r[0]).toLowerCase() !== (me.email || '').toLowerCase() && Date.now() - Date.parse(r[3]) < 75000).map(r => ({ email: String(r[0]), name: r[1] || r[0], rowId: String(r[2] ?? ''), at: r[3] }));
    if (f.appVals[APP.history]) S.history = f.appVals[APP.history].slice(1).map(r => ({ at: r[0], user: r[1] || '', tab: r[2] || '', rowId: String(r[3] ?? ''), col: r[4] || '', before: String(r[5] ?? ''), after: String(r[6] ?? ''), kind: r[7] || 'edit', title: String(r[8] ?? '') }));
    if (!initial) diffNotify(prev, prevComments, prevHistory);
    S.status = 'ready'; S.error = ''; S.lastSync = Date.now(); emit();
  }
  function diffNotify(prev, prevComments, prevHistory) {
    if (!opts.notify) return; const name = myName(), g = S.config.settings.groupCol, tc = S.config.settings.titleCol;
    for (const t of S.order) {
      const old = new Map((prev[t]?.rows || []).map(r => [r.id, r])); const T = S.tabs[t];
      const people = T.header.filter(h => type(h) === 'person');
      for (const row of T.rows) {
        const o = old.get(row.id); if (!o) continue; const title = row.v[tc] || tr('(sin título)');
        for (const c of people) if (row.v[c] === name && o.v[c] !== name) opts.notify(tr('Te asignaron: ') + title, `${c} · ${t}`);
        if (g && !eq(row.v[g], o.v[g]) && people.some(c => row.v[c] === name)) opts.notify(title, `${g}: ${o.v[g] || '—'} → ${row.v[g] || '—'}`);
      }
    }
    S.history.slice(prevHistory).forEach(h => { if (h.kind === 'notify' && h.col === name && h.user !== me.email) opts.notify(h.title || 'Kuadro', h.after); });
    S.comments.slice(prevComments).forEach(c => { if (c.author !== me.email && !c.deleted && c.text.includes('@' + name)) opts.notify(tr('{x} te mencionó', { x: c.name || c.author }), c.text.slice(0, 120)); });
  }
  async function fresh(tab) { const [vals] = await api.batchGet([q(tab)]); return parseTab(tab, S.tabs[tab].sheetId, vals); }
  function cellWrites(tab, t, r, obj) {
    const raw = [], ue = [];
    for (const [col, val] of Object.entries(obj)) {
      const c = t.header.indexOf(col); if (c < 0) continue; const ty = type(col), range = `${q(tab)}!${colL(c)}${r + 1}`;
      if (ty === 'auto') raw.push({ range, values: [[val === '' || val == null ? '' : Number(val)]] });
      else if (ty === 'date' && (isISO(val) || !val)) ue.push({ range, values: [[val || '']] });
      else if (ty === 'checkbox') raw.push({ range, values: [[val === true || val === 'true' || val === 'TRUE']] });
      else if (ty === 'number' && val !== '' && val != null && !isNaN(val)) raw.push({ range, values: [[Number(val)]] });
      else raw.push({ range, values: [[String(val ?? '')]] });
    }
    return { raw, ue };
  }
  async function send({ raw, ue }) { if (raw.length) await api.batchUpdateValues(raw, 'RAW'); if (ue.length) await api.batchUpdateValues(ue, 'USER_ENTERED'); }
  async function log(entries) {
    const rows = entries.map(([tab, rowId, col, before, after, kind, title]) => [now(), me.email, tab, rowId, col, String(before ?? ''), String(after ?? ''), kind, String(title ?? '')]);
    S.history = [...S.history, ...rows.map(r => ({ at: r[0], user: r[1], tab: r[2], rowId: r[3], col: r[4], before: r[5], after: r[6], kind: r[7], title: r[8] }))];
    try { await api.append(`${q(APP.history)}!A1`, rows, 'RAW'); } catch { }
  }
  async function upsert(tab, key, cells) {
    if (cells.length > 2 + MAXCHUNKS) throw new Error(tr('El contenido es demasiado largo para guardarse.'));
    const pad = [...cells]; while (pad.length < 2 + MAXCHUNKS) pad.push('');
    const [vals] = await api.batchGet([`${q(tab)}!A:A`]); const r = vals.findIndex(row => String(row[0] ?? '') === key);
    if (r >= 0) await api.batchUpdateValues([{ range: `${q(tab)}!B${r + 1}`, values: [pad] }], 'RAW');
    else await api.append(`${q(tab)}!A1`, [[key, ...pad]], 'RAW');
  }
  const saveConfigNow = () => upsert(APP.config, 'config', [now(), me.email, ...chunk(JSON.stringify(S.config), CHUNK)]);
  const titleOf = row => row?.v[S.config.settings.titleCol] || '';
  // Siguiente número fijo de una columna automática dentro de una pestaña.
  const nextNum = (t, col) => 1 + Math.max(0, ...t.rows.map(r => parseInt(r.v[col], 10)).filter(n => !isNaN(n)));
  const autoVals = (t, obj) => { t.header.forEach(h => { if (h && type(h) === 'auto') obj[h] = nextNum(t, h); }); return obj; };

  // Ediciones de celdas: se juntan durante unos milisegundos y se guardan en una sola llamada.
  // Para ubicar las filas se lee solo la cabecera, la columna ID y las columnas tocadas, no la pestaña entera.
  const pendingW = new Map(); let flushP = null;
  function scheduleFlush() {
    if (flushP) return flushP;
    flushP = new Promise(res => { const tm = setTimeout(() => { const items = [...pendingW.values()]; pendingW.clear(); flushP = null; enqueue(() => flushNow(items)).then(res); }, 40); });
    return flushP;
  }
  function setCell(tab, id, col, val, o = {}) {
    const row = S.tabs[tab]?.rows.find(r => r.id === id); if (!row || row.tmp) return;
    if (!o.system && !canEditCol(col) && !(o.move && can('moveCards') && type(col) !== 'auto')) { toast(tr('No tienes permiso para editar esta celda.'), 'error'); return; }
    const base = row.v[col]; if (eq(base, val) && !o.force) return;
    const key = `${tab}|${id}|${col}`, prev = pendingW.get(key);
    opt.set(key, val); row.v = { ...row.v, [col]: val };
    pendingW.set(key, { tab, id, col, val, base: prev ? prev.base : base, force: o.force || (prev && prev.force) });
    if (!o.noUndo) { const e = { tab, id, col, before: base, after: val }; if (o.group) o.group.push(e); else { S.undo = [...S.undo.slice(-99), { cells: [e] }]; S.redo = []; } }
    emit(); const p = scheduleFlush();
    if (!o.system) runAutomations('change', tab, id, { col, before: base, after: val });
    return p;
  }
  // Varias celdas a la vez (pegar, edición masiva): un solo paso de deshacer.
  function setMany(edits, o = {}) {
    const group = []; let p; for (const e of edits) p = setCell(e.tab, e.id, e.col, e.val, { ...o, group }) || p;
    if (group.length) { S.undo = [...S.undo.slice(-99), { cells: group }]; S.redo = []; emit(); } return p;
  }
  async function flushNow(items) {
    const byTab = new Map(); items.forEach(it => { if (!byTab.has(it.tab)) byTab.set(it.tab, []); byTab.get(it.tab).push(it); });
    const writes = { raw: [], ue: [] }, logs = [], done = [];
    try {
      for (const [tab, list] of byTab) {
        const T = S.tabs[tab]; if (!T) continue;
        const cols = [...new Set(list.map(i => i.col))], idx = cols.map(c => T.header.indexOf(c));
        let header, ids, colVals;
        if (T.idCol >= 0 && idx.every(i => i >= 0)) {
          const L = i => `${q(tab)}!${colL(i)}:${colL(i)}`;
          const res = await api.batchGet([`${q(tab)}!1:1`, L(T.idCol), ...idx.map(L)]);
          header = (res[0][0] || []).map(h => String(h ?? '').trim());
          if (header[T.idCol] === 'ID' && idx.every((i, k) => header[i] === cols[k])) { ids = res[1].map(r => String(r[0] ?? '').trim()); colVals = Object.fromEntries(cols.map((c, k) => [c, res[2 + k].map(r => r[0])])); }
        }
        if (!ids) { // la estructura cambió: lectura completa
          const t = await fresh(tab); S.tabs[tab] = t; applyOpt(); header = t.header; ids = []; colVals = {};
          t.rows.forEach(r => { ids[r.r] = r.id; }); cols.forEach(c => { colVals[c] = []; t.rows.forEach(r => { colVals[c][r.r] = r.v[c]; }); });
          ids = Array.from(ids, x => x ?? '');
        }
        for (const it of list) {
          const r = ids.indexOf(it.id), c = header.indexOf(it.col);
          if (r < 1) { toast(tr('Esa fila ya no existe en el Sheet.'), 'error'); done.push(it); continue; }
          if (c < 0) { toast(tr('La columna «{c}» ya no existe en el Sheet.', { c: it.col }), 'error'); done.push(it); continue; }
          const raw = (colVals[it.col] || [])[r], theirs = typeof raw === 'string' && type(it.col) === 'date' && isISO(raw) ? raw : normVal(raw, type(it.col));
          const title = titleOf(S.tabs[tab].rows.find(x => x.id === it.id));
          if (!it.force && !eq(theirs, it.base) && !eq(theirs, it.val)) { S.conflicts = [...S.conflicts, { key: newId(), tab, id: it.id, col: it.col, mine: it.val, theirs, title }]; const row = S.tabs[tab].rows.find(x => x.id === it.id); if (row) row.v = { ...row.v, [it.col]: theirs }; done.push(it); continue; }
          if (!eq(theirs, it.val)) { const w = cellWrites(tab, { header }, r, { [it.col]: it.val }); writes.raw.push(...w.raw); writes.ue.push(...w.ue); logs.push([tab, it.id, it.col, theirs, it.val, 'edit', title]); }
          done.push(it);
        }
      }
      await send(writes); if (logs.length) await log(logs);
    } catch (e) {
      // No se guardó: se regresa cada celda a su valor anterior.
      for (const it of items) { const row = S.tabs[it.tab]?.rows.find(x => x.id === it.id); if (row && eq(row.v[it.col], it.val)) row.v = { ...row.v, [it.col]: it.base }; opt.delete(`${it.tab}|${it.id}|${it.col}`); }
      throw e;
    } finally {
      for (const it of items) { const key = `${it.tab}|${it.id}|${it.col}`; if (opt.get(key) === it.val && !pendingW.has(key)) opt.delete(key); }
      emit();
    }
  }
  // Las operaciones de estructura (mover, borrar, reordenar, columnas) guardan primero las ediciones pendientes.
  async function flushFirst() { if (pendingW.size) { const items = [...pendingW.values()]; pendingW.clear(); await flushNow(items); } }
  function undoLast() {
    const e = S.undo[S.undo.length - 1]; if (!e) return false; S.undo = S.undo.slice(0, -1);
    if (e.cells) { setMany(e.cells.map(c => ({ tab: c.tab, id: c.id, col: c.col, val: c.before })), { system: true, noUndo: true }); }
    else if (e.kind) runInverse(e);
    S.redo = [...S.redo, e]; emit(); return true;
  }
  function redoLast() {
    const e = S.redo[S.redo.length - 1]; if (!e) return false; S.redo = S.redo.slice(0, -1);
    if (e.cells) setMany(e.cells.map(c => ({ tab: c.tab, id: c.id, col: c.col, val: c.after })), { system: true, noUndo: true });
    else if (e.kind) runForward(e);
    S.undo = [...S.undo, e]; emit(); return true;
  }
  const pushUndo = e => { S.undo = [...S.undo.slice(-99), e]; S.redo = []; };
  function runInverse(e) { if (e.kind === 'tabdel') restoreTab(e.sheetId, { system: true }); if (e.kind === 'tabrestore' || e.kind === 'tabadd') { const t = titleById(e.sheetId); if (t && S.tabs[t]) deleteTab(t, { system: true }); } if (e.kind === 'tabren') { const t = titleById(e.sheetId); if (t && S.tabs[t]) renameTab(t, e.from, { system: true }); }
    if (e.kind === 'delete') addRow(e.tab, e.values, { system: true, id: e.id, noUndo: true }); if (e.kind === 'create') deleteRow(e.tab, e.id, { system: true, noUndo: true }); if (e.kind === 'move') moveRow(e.to, e.id, e.from, { system: true, noUndo: true }); }
  function runForward(e) { if (e.kind === 'tabdel' || e.kind === 'tabrestore') { const t = titleById(e.sheetId); if (e.kind === 'tabdel' && t && S.tabs[t]) deleteTab(t, { system: true }); if (e.kind === 'tabrestore') restoreTab(e.sheetId, { system: true }); } if (e.kind === 'tabadd') restoreTab(e.sheetId, { system: true }); if (e.kind === 'tabren') { const t = titleById(e.sheetId); if (t && S.tabs[t]) renameTab(t, e.to, { system: true }); }
    if (e.kind === 'delete') deleteRow(e.tab, e.id, { system: true, noUndo: true }); if (e.kind === 'create') addRow(e.tab, e.values, { system: true, id: e.id, noUndo: true }); if (e.kind === 'move') moveRow(e.from, e.id, e.to, { system: true, noUndo: true }); }
  function resolveConflict(c, mine) { S.conflicts = S.conflicts.filter(x => x !== c); emit(); if (mine) setCell(c.tab, c.id, c.col, c.mine, { force: true, system: true }); }

  function addRow(tab, values = {}, o = {}) {
    const T = S.tabs[tab]; if (!T || T.idCol < 0) { toast(tr('Esta pestaña aún no está preparada para la app.'), 'error'); return; }
    if (!o.system && !can(o.card ? 'addCards' : 'addRows')) { toast(tr('No tienes permiso para agregar.'), 'error'); return; }
    const id = o.id || newId(); const v = {}; T.header.forEach(h => { if (h && h !== 'ID') v[h] = type(h) === 'checkbox' ? false : ''; }); values = { ...defaultsFor(T, values), ...values }; Object.assign(v, values);
    const row = { id, tab, v, r: -1 }; newRows.set(id, row); gone.delete(tab + '|' + id); T.rows = [...T.rows, row];
    if (!o.noUndo && !o.system) pushUndo({ kind: 'create', tab, id, values }); emit();
    if (!o.system) runAutomations('create', tab, id, {});
    enqueue(async () => {
      try {
        const line = Array(T.idCol + 1).fill(''); line[T.idCol] = id;
        await api.append(`${q(tab)}!A1`, [line], 'RAW');
        const t = await fresh(tab); const fr = t.rows.find(r => r.id === id); if (!fr) throw new Error(tr('No se pudo crear la fila.'));
        const obj = autoVals({ rows: t.rows.filter(x => x.id !== id), header: t.header }, { ...values });
        await send(cellWrites(tab, t, fr.r, obj));
        await log([[tab, id, '', '', JSON.stringify(values), 'create', values[S.config.settings.titleCol] || '']]);
        if (o.page) { S.pages = { ...S.pages, [id]: { md: o.page, at: now(), by: me.email } }; await upsert(APP.pages, id, [now(), me.email, ...chunk(o.page, CHUNK)]); }
        newRows.delete(id); S.tabs[tab] = await fresh(tab); applyOpt();
      } catch (e) { newRows.delete(id); if (S.tabs[tab]) S.tabs[tab].rows = S.tabs[tab].rows.filter(r => r.id !== id); throw e; }
    });
    return id;
  }
  function deleteRow(tab, id, o = {}) {
    if (!o.system && !can('deleteRows')) { toast(tr('No tienes permiso para eliminar filas.'), 'error'); return; }
    const T = S.tabs[tab]; if (!T) return; const gk = tab + '|' + id; const old = T.rows.find(r => r.id === id);
    if (old && !o.noUndo && !o.system) { const values = {}; Object.entries(old.v).forEach(([k, x]) => { if (type(k) !== 'auto' && x !== '' && x !== false) values[k] = x; }); pushUndo({ kind: 'delete', tab, id, values }); }
    gone.add(gk); T.rows = T.rows.filter(r => r.id !== id); emit();
    return enqueue(async () => {
      try {
        await flushFirst();
        const t = await fresh(tab); const fr = t.rows.find(r => r.id === id); if (!fr) return;
        await api.batchUpdate([{ deleteDimension: { range: { sheetId: T.sheetId, dimension: 'ROWS', startIndex: fr.r, endIndex: fr.r + 1 } } }]);
        await log([[tab, id, '', JSON.stringify(fr.v), '', 'delete', titleOf(fr)]]);
        gone.delete(gk); S.tabs[tab] = await fresh(tab); applyOpt();
      } catch (e) { gone.delete(gk); throw e; }
    });
  }
  // Orden manual: la posición de la tarjeta es la posición de su fila en el Sheet.
  function optPlace(T, id, targetId, after) { const rows = [...T.rows]; const i = rows.findIndex(r => r.id === id); const j0 = rows.findIndex(r => r.id === targetId); if (i < 0 || j0 < 0 || i === j0) return; const [row] = rows.splice(i, 1); const j = rows.findIndex(r => r.id === targetId); rows.splice(j + (after ? 1 : 0), 0, row); T.rows = rows; }
  async function placeNow(tab, id, targetId, after) {
    const t = await fresh(tab); const fr = t.rows.find(r => r.id === id), tr = t.rows.find(r => r.id === targetId); if (!fr || !tr || fr === tr) return;
    const dest = tr.r + (after ? 1 : 0); if (dest === fr.r || dest === fr.r + 1) return;
    await api.batchUpdate([{ moveDimension: { source: { sheetId: t.sheetId, dimension: 'ROWS', startIndex: fr.r, endIndex: fr.r + 1 }, destinationIndex: dest } }]);
  }
  function reorder(tab, id, targetId, after) {
    if (!can('moveCards')) { toast(tr('No tienes permiso para mover tarjetas.'), 'error'); return; }
    const T = S.tabs[tab]; if (!T || id === targetId) return; order.set(id, { tab, targetId, after }); optPlace(T, id, targetId, after); emit();
    return enqueue(async () => { try { await flushFirst(); await placeNow(tab, id, targetId, after); } finally { order.delete(id); S.tabs[tab] = await fresh(tab); applyOpt(); } });
  }
  // Mueve un elemento a otra pestaña conservando su ID (y con él su página, comentarios e historial).
  // Orden seguro: primero se crea la copia en el destino y solo después se borra el original.
  function moveRow(from, id, to, o = {}) {
    if (from === to) return;
    if (!o.system && !can('moveTabs')) { toast(tr('No tienes permiso para mover elementos entre pestañas.'), 'error'); return; }
    const F = S.tabs[from], T = S.tabs[to]; if (!F || !T) return;
    if (T.idCol < 0) { toast(tr('La pestaña destino aún no está preparada para la app.'), 'error'); return; }
    const row = F.rows.find(r => r.id === id); if (!row || row.tmp) return;
    const gk = from + '|' + id, v = {}; T.header.forEach(h => { if (h && h !== 'ID') v[h] = h in row.v ? row.v[h] : (type(h) === 'checkbox' ? false : ''); });
    if (!o.noUndo && !o.system) pushUndo({ kind: 'move', id, from, to });
    if (!o.system) setTimeout(() => runAutomations('move', to, id, { from, to }), 0);
    const copy = { id, tab: to, v, r: -1 }; gone.add(gk); newRows.set(id, copy); F.rows = F.rows.filter(r => r.id !== id); T.rows = [...T.rows.filter(r => r.id !== id), copy]; if (o.pos) { order.set(id, { tab: to, ...o.pos }); optPlace(T, id, o.pos.targetId, o.pos.after); } emit();
    return enqueue(async () => {
      try {
        await flushFirst();
        const src = await fresh(from); const fr = src.rows.find(r => r.id === id);
        let dst = await fresh(to); let dr = dst.rows.find(r => r.id === id);
        if (!fr && !dr) { toast(tr('Ese elemento ya no existe en el Sheet.'), 'error'); return; }
        if (fr) {
          if (!dr) { const line = Array(dst.idCol + 1).fill(''); line[dst.idCol] = id; await api.append(`${q(to)}!A1`, [line], 'RAW'); dst = await fresh(to); dr = dst.rows.find(r => r.id === id); if (!dr) throw new Error(tr('No se pudo crear la fila en la pestaña destino.')); }
          const obj = {}; dst.header.forEach(h => { if (!h || h === 'ID') return; if (type(h) === 'auto') obj[h] = nextNum({ rows: dst.rows.filter(x => x.id !== id) }, h); else if (h in fr.v && fr.v[h] !== '' && fr.v[h] !== false) obj[h] = fr.v[h]; });
          await send(cellWrites(to, dst, dr.r, obj));
          const lost = src.header.filter(h => h && h !== 'ID' && !dst.header.includes(h) && fr.v[h] !== '' && fr.v[h] !== false);
          const again = await fresh(from); const fr2 = again.rows.find(r => r.id === id);
          if (fr2) await api.batchUpdate([{ deleteDimension: { range: { sheetId: F.sheetId, dimension: 'ROWS', startIndex: fr2.r, endIndex: fr2.r + 1 } } }]);
          await log([[to, id, '', from, to, 'move', titleOf(fr)]]);
          if (o.pos) await placeNow(to, id, o.pos.targetId, o.pos.after);
          if (lost.length) toast(tr('«{x}» no tiene las columnas {c}; esos datos se quedaron sin copiar.', { x: to, c: lost.join(', ') }), 'error');
        }
      } finally { newRows.delete(id); gone.delete(gk); order.delete(id); S.tabs[from] = await fresh(from); S.tabs[to] = await fresh(to); applyOpt(); }
    });
  }
  function undo(h) {
    if (!can('undo')) { toast(tr('No tienes permiso para deshacer.'), 'error'); return; }
    if (h.kind === 'edit') return setCell(h.tab, h.rowId, h.col, type(h.col) === 'checkbox' ? h.before === 'true' : h.before, { system: true, force: true });
    if (h.kind === 'delete') { let v = {}; try { v = JSON.parse(h.before); } catch { } return addRow(h.tab, v, { system: true, id: h.rowId }); }
    if (h.kind === 'create') return deleteRow(h.tab, h.rowId, { system: true });
    if (h.kind === 'move') return moveRow(h.after, h.rowId, h.before, { system: true });
    if (h.kind === 'tabdel') return restoreTab(h.col);
    if (h.kind === 'tabadd' || h.kind === 'tabrestore') { const t = titleById(h.col); if (t && S.tabs[t]) return deleteTab(t); toast(tr('Esa pestaña ya no está visible.')); return; }
    if (h.kind === 'tabren') { const t = titleById(h.col); if (t && S.tabs[t]) return renameTab(t, h.before); toast(tr('Esa pestaña ya no está visible.')); return; }
  }
  // ¿Se puede deshacer o restaurar esta entrada del historial ahora mismo?
  function undoable(h) {
    if (h.kind === 'notify') return false;
    if (h.kind === 'tabdel') return canRestoreTab(h.col);
    if (h.kind === 'tabadd' || h.kind === 'tabrestore' || h.kind === 'tabren') { const t = titleById(h.col); return !!t && !!S.tabs[t] && (h.kind !== 'tabren' || t === h.after); }
    if (h.kind === 'delete') return !S.order.some(t => S.tabs[t].rows.some(r => r.id === h.rowId)) && !!S.tabs[h.tab];
    return true;
  }

  const heads = async tabs => (await api.batchGet(tabs.map(t => `${q(t)}!1:1`))).map(v => (v[0] || []).map(x => String(x ?? '').trim()));
  const reload = async () => apply(await fetchAll(), true);
  function addColumn(name, ty, tabs) {
    name = name.trim(); if (!name || name === 'ID' || !can('manageColumns')) return;
    return enqueue(async () => {
      await flushFirst();
      const meta = await api.meta(); const targets = tabs.filter(t => S.tabs[t]); const hs = await heads(targets); const reqs = [], writes = [];
      targets.forEach((t, i) => { const h = hs[i]; if (h.includes(name)) return; const sm = meta.sheets.find(s => s.title === t); if (h.length >= sm.columnCount) reqs.push({ appendDimension: { sheetId: sm.sheetId, dimension: 'COLUMNS', length: 1 } }); writes.push({ range: `${q(t)}!${colL(h.length)}1`, values: [[name]] }); });
      if (reqs.length) await api.batchUpdate(reqs); if (writes.length) await api.batchUpdateValues(writes, 'RAW');
      if (!S.config.schema[name]) S.config.schema[name] = { type: ty, options: [] }; await saveConfigNow(); await reload();
    });
  }
  function renameColumn(old, neu) {
    neu = neu.trim(); if (!neu || neu === old || neu === 'ID' || old === 'ID' || !can('manageColumns')) return;
    if (S.order.some(t => S.tabs[t].header.includes(neu))) { toast(tr('Ya existe una columna con ese nombre.'), 'error'); return; }
    return enqueue(async () => {
      await flushFirst();
      const hs = await heads(S.order); const writes = [];
      S.order.forEach((t, i) => { const c = hs[i].indexOf(old); if (c >= 0) writes.push({ range: `${q(t)}!${colL(c)}1`, values: [[neu]] }); });
      if (writes.length) await api.batchUpdateValues(writes, 'RAW');
      const c = S.config; if (c.schema[old]) { c.schema[neu] = c.schema[old]; delete c.schema[old]; }
      for (const k of ['titleCol', 'groupCol', 'dateCol', 'imageCol']) if (c.settings[k] === old) c.settings[k] = neu;
      const swap = p => { for (const k of ['editableCols', 'hiddenCols']) if (p && p[k]) p[k] = p[k].map(x => x === old ? neu : x); };
      c.roles.forEach(r => swap(r.perms)); c.users.forEach(u => swap(u.overrides));
      await saveConfigNow(); await reload();
    });
  }
  function deleteColumn(name) {
    if (name === 'ID' || !can('manageColumns')) return;
    return enqueue(async () => {
      await flushFirst();
      const hs = await heads(S.order); const reqs = [];
      S.order.forEach((t, i) => { const c = hs[i].indexOf(name); if (c >= 0) reqs.push({ deleteDimension: { range: { sheetId: S.tabs[t].sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 } } }); });
      if (reqs.length) await api.batchUpdate(reqs);
      delete S.config.schema[name]; for (const k of ['titleCol', 'groupCol', 'dateCol', 'imageCol']) if (S.config.settings[k] === name) S.config.settings[k] = '';
      await saveConfigNow(); await reload();
    });
  }
  // Pestañas: crear una nueva (con las mismas columnas que una existente) y renombrar.
  const tabNameError = (name, except) => {
    if (!name) return tr('Escribe un nombre para la pestaña.');
    if (name.length > 90) return tr('El nombre es demasiado largo.');
    if (/^_app_/i.test(name)) return tr('Ese nombre está reservado.');
    const clash = S.meta && S.meta.sheets.find(x => x.title.toLowerCase() === name.toLowerCase() && x.title !== except);
    if (clash) return clash.hidden && !clash.title.startsWith('_app_') ? tr('Hay una pestaña eliminada con ese nombre. Restáurala desde Ajustes → Historial o usa otro nombre.') : tr('Ya existe una pestaña con ese nombre.');
    if (S.order.some(t => t.toLowerCase() === name.toLowerCase() && t !== except)) return tr('Ya existe una pestaña con ese nombre.');
    return '';
  };
  function addTab(name, like) {
    name = String(name || '').trim(); if (!can('manageTabs')) return Promise.resolve(null);
    const err = tabNameError(name); if (err) { toast(err, 'error'); return Promise.resolve(null); }
    return enqueue(async () => {
      await flushFirst();
      const meta = await api.meta(); S.meta = meta;
      if (meta.sheets.some(x => x.title.toLowerCase() === name.toLowerCase())) { toast(tr('Ya existe una pestaña con ese nombre.'), 'error'); return null; }
      const src = S.tabs[like] ? like : S.order.find(t => S.tabs[t].idCol >= 0);
      let header = src ? S.tabs[src].header.filter(Boolean) : [];
      if (!header.includes('ID')) header = [...header, 'ID'];
      const title0 = S.config.settings.titleCol; if (title0 && !header.includes(title0)) header = [title0, ...header];
      const rep = await api.batchUpdate([{ addSheet: { properties: { title: name, gridProperties: { rowCount: 1000, columnCount: Math.max(header.length, 5), frozenRowCount: 1 } } } }]);
      await api.batchUpdateValues([{ range: `${q(name)}!A1`, values: [header] }], 'RAW');
      const sid = rep && rep[0] && rep[0].addSheet ? rep[0].addSheet.properties.sheetId : '';
      await log([[name, '', String(sid), '', name, 'tabadd', name]]); pushUndo({ kind: 'tabadd', sheetId: sid, title: name });
      await reload(); toast(tr('Pestaña «{t}» creada', { t: name }));
      return name;
    });
  }
  function renameTab(old, neu, o = {}) {
    neu = String(neu || '').trim(); if (!can('manageTabs') || !S.tabs[old] || neu === old) return Promise.resolve(old);
    const err = tabNameError(neu, old); if (err) { toast(err, 'error'); return Promise.resolve(null); }
    return enqueue(async () => {
      await flushFirst();
      await api.batchUpdate([{ updateSheetProperties: { properties: { sheetId: S.tabs[old].sheetId, title: neu }, fields: 'title' } }]);
      const c = S.config, sw = x => x === old ? neu : x;
      const fix = p => { if (p && Array.isArray(p.hiddenTabs)) p.hiddenTabs = p.hiddenTabs.map(sw); };
      c.roles.forEach(r => fix(r.perms)); c.users.forEach(u => fix(u.overrides));
      (c.automations || []).forEach(a => { if (a.when && a.when.tab === old) a.when.tab = neu; (a.conds || []).forEach(k => { if (k.op === 'tab' && k.val === old) k.val = neu; }); (a.actions || []).forEach(x => { if (x.type === 'move' && x.tab === old) x.tab = neu; }); });
      await saveConfigNow(); await log([[neu, '', String(S.tabs[old].sheetId), old, neu, 'tabren', neu]]);
      if (!o.system) pushUndo({ kind: 'tabren', sheetId: S.tabs[old].sheetId, from: old, to: neu });
      await reload(); toast(tr('Pestaña renombrada a «{t}»', { t: neu }));
      return neu;
    });
  }
  // Eliminar una pestaña la oculta en el Sheet (no borra nada); se puede restaurar desde el historial.
  const sheetById = id => S.meta && S.meta.sheets.find(x => String(x.sheetId) === String(id));
  const canRestoreTab = id => { const sh = sheetById(id); return !!sh && sh.hidden && !sh.title.startsWith('_app_'); };
  function deleteTab(name, o = {}) {
    if (!can('manageTabs') || !S.tabs[name]) return Promise.resolve(false);
    if (S.order.length <= 1) { toast(tr('No puedes eliminar la única pestaña.'), 'error'); return Promise.resolve(false); }
    const T = S.tabs[name], n = T.rows.length;
    return enqueue(async () => {
      await flushFirst();
      await api.batchUpdate([{ updateSheetProperties: { properties: { sheetId: T.sheetId, hidden: true }, fields: 'hidden' } }]);
      await log([[name, '', String(T.sheetId), name, String(n), 'tabdel', name]]);
      if (!o.system) pushUndo({ kind: 'tabdel', sheetId: T.sheetId, title: name });
      await reload(); toast(tr('Pestaña «{t}» eliminada. Puedes restaurarla desde Ajustes → Historial.', { t: name }));
      return true;
    });
  }
  function restoreTab(sheetId, o = {}) {
    if (!can('manageTabs')) { toast(tr('No tienes permiso para restaurar pestañas.'), 'error'); return Promise.resolve(null); }
    return enqueue(async () => {
      await flushFirst();
      const meta = await api.meta(); const sh = meta.sheets.find(x => String(x.sheetId) === String(sheetId));
      if (!sh) { toast(tr('Esa pestaña ya no existe en el Sheet.'), 'error'); return null; }
      if (!sh.hidden) { toast(tr('Esa pestaña ya está visible.')); return sh.title; }
      let title = sh.title; const taken = t => meta.sheets.some(x => x !== sh && x.title.toLowerCase() === t.toLowerCase());
      if (taken(title)) { let i = 1, base = title + tr(' (restaurada)'); title = base; while (taken(title)) title = base + ' ' + (++i); }
      await api.batchUpdate([{ updateSheetProperties: { properties: { sheetId: sh.sheetId, hidden: false, title }, fields: title === sh.title ? 'hidden' : 'hidden,title' } }]);
      await log([[title, '', String(sh.sheetId), '', title, 'tabrestore', title]]);
      if (!o.system) pushUndo({ kind: 'tabrestore', sheetId: sh.sheetId, title });
      await reload(); toast(tr('Pestaña «{t}» restaurada', { t: title }));
      return title;
    });
  }
  const titleById = id => (sheetById(id) || {}).title;
  // ---------- Carpetas de filas ----------
  // Cada fila guarda el nombre de su carpeta en una columna del Sheet; la lista de carpetas por pestaña vive en la configuración.
  // Las filas de una carpeta se mantienen juntas en el Sheet y se agrupan con los grupos nativos de Google Sheets.
  const folderCol = () => S.config.settings.folderCol || '';
  function foldersOf(tab) {
    const fc = folderCol(), defs = (S.config.folders || []).filter(f => f.tab === tab).map(f => ({ ...f }));
    if (fc && S.tabs[tab]) S.tabs[tab].rows.forEach(r => { const n = String(r.v[fc] || '').trim(); if (n && !defs.some(d => d.name === n)) defs.push({ id: 'auto:' + n, name: n, tab }); });
    return defs;
  }
  async function ensureFolderCol(tab) {
    let fc = folderCol();
    if (!fc) { fc = tr('Carpeta'); if (S.order.some(t => S.tabs[t].header.includes(fc)) && !(S.config.schema[fc] || {}).folder) fc = tr('Carpeta') + ' (Kuadro)'; S.config.settings.folderCol = fc; }
    if (!S.config.schema[fc]) S.config.schema[fc] = { type: 'text', options: [], folder: true };
    const [h] = await heads([tab]);
    if (!h.includes(fc)) {
      const meta = await api.meta(), sm = meta.sheets.find(x => x.title === tab), at = h.length;
      if (at >= sm.columnCount) await api.batchUpdate([{ appendDimension: { sheetId: sm.sheetId, dimension: 'COLUMNS', length: 1 } }]);
      await api.batchUpdateValues([{ range: `${q(tab)}!${colL(at)}1`, values: [[fc]] }], 'RAW');
    }
    await saveConfigNow(); S.tabs[tab] = await fresh(tab); applyOpt();
    return fc;
  }
  const folderNameError = (tab, name, except) => !name ? tr('Escribe un nombre para la carpeta.') : name.length > 80 ? tr('El nombre es demasiado largo.') : foldersOf(tab).some(f => f.name.toLowerCase() === name.toLowerCase() && f.name !== except) ? tr('Ya hay una carpeta con ese nombre en esta pestaña.') : '';
  function addFolder(tab, name, ids = []) {
    name = String(name || '').trim(); if (!can('moveCards') || !S.tabs[tab]) return Promise.resolve(null);
    const err = folderNameError(tab, name); if (err) { toast(err, 'error'); return Promise.resolve(null); }
    S.config.folders = [...(S.config.folders || []), { id: newId(), name, tab }]; emit();
    const p = enqueue(async () => { await flushFirst(); await ensureFolderCol(tab); });
    return p.then(async () => { if (ids.length) await moveToFolder(tab, ids, name); else await syncGroups(tab); toast(tr('Carpeta «{n}» creada', { n: name })); return name; });
  }
  // Mete (o saca, con name = '') filas en una carpeta: se escriben las celdas y las filas se mueven al final de la carpeta.
  async function moveToFolder(tab, ids, name) {
    if (!can('moveCards')) { toast(tr('No tienes permiso para mover tarjetas.'), 'error'); return; }
    const T = S.tabs[tab]; if (!T) return;
    let fc = folderCol(); if (!fc || !T.header.includes(fc)) { await enqueue(async () => { await flushFirst(); fc = await ensureFolderCol(tab); }); }
    const moving = new Set(ids), list = S.tabs[tab].rows.filter(r => moving.has(r.id) && !r.tmp); if (!list.length) return;
    const olds = [...new Set(list.map(r => String(r.v[fc] || '')).filter(Boolean))];
    await setMany(list.map(r => ({ tab, id: r.id, col: fc, val: name })), { system: true });
    const rows = () => S.tabs[tab].rows;
    if (name) {
      const others = rows().filter(r => !moving.has(r.id) && String(r.v[fc] || '') === name);
      let target = others.length ? others[others.length - 1].id : null;
      for (const r of list) { if (target) await reorder(tab, r.id, target, true); target = r.id; }
    } else {
      // Al sacarlas, quedan justo debajo de la carpeta de donde salieron.
      for (const old of olds) { const rest = rows().filter(r => !moving.has(r.id) && String(r.v[fc] || '') === old); if (!rest.length) continue; let target = rest[rest.length - 1].id; for (const r of list.filter(x => String(x.v[fc] || '') === '' )) { await reorder(tab, r.id, target, true); target = r.id; } }
    }
    await syncGroups(tab);
    toast(name ? tr(list.length === 1 ? 'Movido a «{n}»' : '{c} filas movidas a «{n}»', { n: name, c: list.length }) : tr('Fuera de la carpeta'));
  }
  async function renameFolder(tab, old, neu) {
    neu = String(neu || '').trim(); if (!can('moveCards') || neu === old) return old;
    const err = folderNameError(tab, neu, old); if (err) { toast(err, 'error'); return null; }
    const fc = folderCol(), members = (S.tabs[tab]?.rows || []).filter(r => !r.tmp && String(r.v[fc] || '') === old);
    const f = (S.config.folders || []).find(x => x.tab === tab && x.name === old); if (f) f.name = neu; else S.config.folders = [...(S.config.folders || []), { id: newId(), name: neu, tab }];
    if (members.length) await setMany(members.map(r => ({ tab, id: r.id, col: fc, val: neu })), { system: true });
    await enqueue(saveConfigNow); return neu;
  }
  // Eliminar una carpeta no borra sus filas: solo las saca de la carpeta.
  async function deleteFolder(tab, name) {
    if (!can('moveCards')) return;
    const fc = folderCol(), members = (S.tabs[tab]?.rows || []).filter(r => !r.tmp && String(r.v[fc] || '') === name);
    S.config.folders = (S.config.folders || []).filter(x => !(x.tab === tab && x.name === name));
    if (members.length) await setMany(members.map(r => ({ tab, id: r.id, col: fc, val: '' })), { system: true });
    await enqueue(saveConfigNow); await syncGroups(tab); toast(tr('Carpeta «{n}» eliminada; sus filas siguen en la pestaña.', { n: name }));
  }
  // Grupos nativos de Google Sheets: uno por carpeta cuyas filas estén juntas.
  function syncGroups(tab) {
    return enqueue(async () => {
      await flushFirst(); const fc = folderCol(); if (!fc || !S.tabs[tab] || !api.rowGroups) return;
      const t = await fresh(tab); S.tabs[tab] = t; applyOpt();
      const want = []; foldersOf(tab).forEach(f => { const rs = t.rows.filter(r => !r.tmp && String(r.v[fc] || '') === f.name).map(r => r.r).sort((a, b) => a - b); if (rs.length && rs[rs.length - 1] - rs[0] + 1 === rs.length) want.push([rs[0], rs[rs.length - 1] + 1]); });
      const have = (await api.rowGroups(t.sheetId)).sort((a, b) => b.depth - a.depth);
      const same = have.length === want.length && have.every(g => g.depth === 1 && want.some(w => w[0] === g.start && w[1] === g.end));
      if (same) return;
      const reqs = [...have.map(g => ({ deleteDimensionGroup: { range: { sheetId: t.sheetId, dimension: 'ROWS', startIndex: g.start, endIndex: g.end } } })), ...want.map(([a, b]) => ({ addDimensionGroup: { range: { sheetId: t.sheetId, dimension: 'ROWS', startIndex: a, endIndex: b } } }))];
      if (reqs.length) try { await api.batchUpdate(reqs); } catch (e) { console.warn('row groups', e); }
    });
  }
  // Renombra una opción de desplegable en la configuración y en todas las celdas que la usan.
  function renameOption(col, old, neu) {
    neu = neu.trim(); const sc = S.config.schema[col]; if (!sc || !neu || neu === old) return;
    const o = sc.options.find(x => x.v === old); if (o) o.v = neu; emit();
    return enqueue(async () => {
      await flushFirst();
      for (const tab of S.order) {
        if (!S.tabs[tab].header.includes(col)) continue; const t = await fresh(tab); const all = { raw: [], ue: [] };
        t.rows.forEach(r => { if (r.tmp) return; const cur = String(r.v[col] ?? ''); const next = sc.type === 'multi' ? cur.split(',').map(s => s.trim()).map(s => s === old ? neu : s).join(', ') : (cur === old ? neu : cur); if (next !== cur) all.raw.push(...cellWrites(tab, t, r.r, { [col]: next }).raw); });
        if (all.raw.length) await send(all);
      }
      await saveConfigNow(); await reload();
    });
  }
  // Valores por defecto: columnas de selección con «default» definido.
  const defaults = () => Object.entries(S.config.schema).filter(([, sc]) => sc.default && (sc.type === 'select' || sc.type === 'multi')).map(([c, sc]) => [c, sc.default]);
  function defaultsFor(T, values) { const o = {}; defaults().forEach(([c, d]) => { if (T.header.includes(c) && (values[c] === undefined || values[c] === '')) o[c] = d; }); return o; }
  // Rellena en el Sheet las celdas vacías de esas columnas (filas con contenido y con ID).
  async function fillDefaultsNow() {
    const ds = defaults(); if (!ds.length) return false; let did = false;
    for (const tab of S.order) {
      const T0 = S.tabs[tab]; if (!ds.some(([c]) => T0.header.includes(c) && T0.rows.some(r => !r.tmp && r.v[c] === ''))) continue;
      const t = await fresh(tab); const raw = [];
      for (const [c, d] of ds) { const ci = t.header.indexOf(c); if (ci < 0) continue; t.rows.forEach(r => { if (!r.tmp && r.v[c] === '') { raw.push({ range: `${q(tab)}!${colL(ci)}${r.r + 1}`, values: [[d]] }); r.v[c] = d; } }); }
      if (raw.length) { await api.batchUpdateValues(raw, 'RAW'); did = true; S.tabs[tab] = t; applyOpt(); }
    }
    if (did) emit(); return did;
  }
  // Tras cada sincronización: da ID a filas escritas a mano en el Sheet y rellena valores por defecto.
  const autoFill = () => {
    if (!S.prepared || S.readOnly || !can('editCells')) return;
    if (can('admin') && !S.config.autoSeeded && seedAutomations()) enqueue(saveConfigNow);
    const autos = Object.keys(S.config.schema).filter(c => type(c) === 'auto');
    const needNums = autos.length && (!S.config.fixedNums || S.order.some(t => S.tabs[t].rows.some(r => !r.tmp && autos.some(c => S.tabs[t].header.includes(c) && r.v[c] === ''))));
    const tmp = S.order.some(t => S.tabs[t].rows.some(r => r.tmp));
    if (defaults().length || needNums || tmp) return enqueue(async () => { await assignIdsNow(); await fillDefaultsNow(); if (needNums || (tmp && autos.length)) await fixNumbersNow(); });
  };
  const saveConfig = () => { emit(); return enqueue(saveConfigNow); };
  // Lee la fila de una clave en una pestaña clave-valor (páginas, configuración).
  async function readKey(tab, key) {
    const [col] = await api.batchGet([`${q(tab)}!A:A`]); const r = col.findIndex(row => String(row[0] ?? '') === key); if (r < 0) return null;
    const [vals] = await api.batchGet([`${q(tab)}!A${r + 1}:K${r + 1}`]); const row = vals[0] || [];
    return { at: row[1] || '', by: row[2] || '', text: row.slice(3).map(x => String(x ?? '')).join('') };
  }
  // Guarda una página. Si alguien más la cambió desde que la abriste, combina ambos cambios en lugar de pisarlos.
  function savePage(id, md) {
    S.pages = { ...S.pages, [id]: { ...(S.pages[id] || {}), md, at: now(), by: me.email } }; dirty.add(id); emit();
    return enqueue(async () => {
      try {
        const cur = S.pages[id].md, base = pageBase[id] ?? '', server = await readKey(APP.pages, id), theirs = server ? server.text : '';
        let out = cur;
        if (server && theirs !== base && theirs !== cur) {
          const [merged, ok] = dmp.patch_apply(dmp.patch_make(base, cur), theirs); out = merged;
          S.merged = { ...S.merged, [id]: { at: Date.now(), by: server.by, clean: ok.every(Boolean) } };
          if (!ok.every(Boolean)) toast(tr('Hubo cambios de otra persona en el mismo párrafo; revisa la página.'), 'error');
        }
        if (out !== theirs) await upsert(APP.pages, id, [now(), me.email, ...chunk(out, CHUNK)]);
        pageBase[id] = out; if (S.pages[id].md === cur) S.pages = { ...S.pages, [id]: { md: out, at: now(), by: me.email } };
      } finally { if (S.pages[id] && S.pages[id].md === pageBase[id]) dirty.delete(id); }
    });
  }
  function setPageMeta(id, patch) {
    const m = { ...(S.pageMeta[id] || {}), ...patch }; S.pageMeta = { ...S.pageMeta, [id]: m }; emit();
    return enqueue(() => upsert(APP.pages, 'meta:' + id, [now(), me.email, JSON.stringify(m)]));
  }
  // Presencia: quién tiene abierta qué página (latido cada ~20 s).
  async function setPresence(rowId) {
    if (!S.prepared || S.readOnly || !me.email || !can('editCells') && !can('comment')) return;
    return enqueue(async () => {
      const meta = S.meta || await api.meta();
      if (!meta.sheets.some(s => s.title === PRESENCE)) { await api.batchUpdate([{ addSheet: { properties: { title: PRESENCE, hidden: true, gridProperties: { rowCount: 2, columnCount: 4 } } } }]); await api.batchUpdateValues([{ range: `${q(PRESENCE)}!A1`, values: [['correo', 'nombre', 'fila', 'fecha']] }], 'RAW'); S.meta = await api.meta(); }
      const [col] = await api.batchGet([`${q(PRESENCE)}!A:A`]); const r = col.findIndex(x => String(x[0] ?? '').toLowerCase() === me.email.toLowerCase());
      const line = [me.email, myName(), rowId || '', now()];
      if (r >= 0) await api.batchUpdateValues([{ range: `${q(PRESENCE)}!A${r + 1}`, values: [line] }], 'RAW'); else await api.append(`${q(PRESENCE)}!A1`, [line], 'RAW');
    }).catch(() => { });
  }
  function addComment(rowId, text, parent = '') {
    text = text.trim(); if (!text || !can('comment')) return;
    const c = { id: newId(), rowId, author: me.email, name: myName(), at: now(), text, parent, edited: '', deleted: false }; S.comments = [...S.comments, c]; emit();
    return enqueue(() => api.append(`${q(APP.comments)}!A1`, [[c.id, c.rowId, c.author, c.name, c.at, c.text, parent, '', '']], 'RAW'));
  }
  const canTouchComment = c => c.author.toLowerCase() === (me.email || '').toLowerCase() || can('admin');
  async function commentRow(id) { const [col] = await api.batchGet([`${q(APP.comments)}!A:A`]); const r = col.findIndex(x => String(x[0] ?? '') === id); return r < 0 ? null : r + 1; }
  function editComment(id, text) {
    const c = S.comments.find(x => x.id === id); text = text.trim(); if (!c || !text || !canTouchComment(c)) return;
    S.comments = S.comments.map(x => x.id === id ? { ...x, text, edited: now() } : x); emit();
    return enqueue(async () => { const r = await commentRow(id); if (r) await api.batchUpdateValues([{ range: `${q(APP.comments)}!F${r}`, values: [[text]] }, { range: `${q(APP.comments)}!H${r}`, values: [[now()]] }], 'RAW'); });
  }
  function deleteComment(id) {
    const c = S.comments.find(x => x.id === id); if (!c || !canTouchComment(c)) return;
    S.comments = S.comments.map(x => x.id === id ? { ...x, deleted: true, text: '' } : x); emit();
    return enqueue(async () => { const r = await commentRow(id); if (r) await api.batchUpdateValues([{ range: `${q(APP.comments)}!F${r}`, values: [['']] }, { range: `${q(APP.comments)}!I${r}`, values: [['1']] }], 'RAW'); });
  }
  // Cambio de «#» por fórmula a número fijo: se congela el número actual de cada fila una sola vez.
  async function fixNumbersNow() {
    const autos = Object.keys(S.config.schema).filter(c => type(c) === 'auto'); if (!autos.length) return false;
    let did = false;
    for (const tab of S.order) {
      const T0 = S.tabs[tab]; const cs = autos.filter(c => T0.header.includes(c)); if (!cs.length) continue;
      const needs = !S.config.fixedNums || T0.rows.some(r => !r.tmp && cs.some(c => r.v[c] === ''));
      if (!needs) continue;
      const t = await fresh(tab); const raw = [];
      for (const c of cs) {
        const ci = t.header.indexOf(c); let next = nextNum(t, c);
        t.rows.forEach(r => { if (r.tmp) return; const n = parseInt(r.v[c], 10); const val = isNaN(n) ? next++ : n; raw.push({ range: `${q(tab)}!${colL(ci)}${r.r + 1}`, values: [[val]] }); r.v[c] = String(val); });
      }
      if (raw.length) { await api.batchUpdateValues(raw, 'RAW'); did = true; S.tabs[tab] = t; applyOpt(); }
    }
    if (!S.config.fixedNums) { S.config.fixedNums = true; await saveConfigNow(); }
    return did;
  }
  async function infer() {
    const hints = await api.colHints(S.order); const c = S.config, names = [];
    S.order.forEach(t => S.tabs[t].header.forEach(h => { if (h && h !== 'ID' && !names.includes(h)) names.push(h); }));
    for (const n of names) {
      if (c.schema[n]) continue; let hint; for (const t of S.order) hint = hint || hints[t]?.[n];
      const vals = []; S.order.forEach(t => S.tabs[t].rows.forEach(r => { const x = r.v[n]; if (x !== '' && x != null && x !== false) vals.push(String(x)); }));
      const allUrl = vals.length > 0 && vals.every(v => urls(v).length > 0), allNum = vals.length > 0 && vals.every(v => !isNaN(v));
      let sc;
      if (/^(#|n[°ºo]\.?|n[úu]m\.?)$/i.test(n) && (allNum || !vals.length)) sc = { type: 'auto' };
      else if (hint?.checkbox) sc = { type: 'checkbox' };
      else if (hint?.options) { const o = [...hint.options]; vals.forEach(v => { if (!o.includes(v)) o.push(v); }); sc = { type: 'select', options: o.map((v, i) => ({ v, color: pickColor(v, i) })) }; }
      else if (hint?.date) sc = { type: 'date' };
      else if (/^(guionista|editor|miniaturero|responsable|asignado|encargado|writer|scriptwriter|thumbnail artist|designer|owner|assignee|assigned to)/i.test(n)) sc = { type: 'person', roleId: '' };
      else if (/archivo|imagen|foto|thumbnail|portada|image|photo|cover|picture/i.test(n) && !/^miniatura$/i.test(n)) sc = { type: 'image' };
      else if (allUrl || /^(link|enlace|url|referencia|reference)s?$/i.test(n)) sc = { type: 'url' };
      else if (allNum) sc = { type: 'number' };
      else sc = { type: 'text' };
      c.schema[n] = sc;
    }
    const ty = n => c.schema[n].type, s = c.settings;
    s.titleCol = s.titleCol || names.find(n => /t[ií]tulo|nombre|title|name/i.test(n) && ty(n) === 'text') || names.find(n => ty(n) === 'text') || names[0] || '';
    s.groupCol = s.groupCol || names.find(n => /^(estado|status|etapa|stage)$/i.test(n) && ty(n) === 'select') || names.find(n => ty(n) === 'select') || '';
    s.dateCol = s.dateCol || names.find(n => /publicaci|publish|release/i.test(n) && ty(n) === 'date') || names.find(n => ty(n) === 'date') || '';
    s.imageCol = s.imageCol || names.find(n => ty(n) === 'image') || '';
  }
  // Prepara un Sheet: columna ID en cada pestaña, pestañas ocultas de la app y configuración inicial.
  async function prepare() {
    return enqueue(async () => {
      const meta = await api.meta(); const reqs = [], writes = [];
      for (const t of Object.values(APP)) if (!meta.sheets.some(s => s.title === t)) { reqs.push({ addSheet: { properties: { title: t, hidden: true, gridProperties: { rowCount: 2, columnCount: 12 } } } }); writes.push({ range: `${q(t)}!A1`, values: [HEAD[t]] }); }
      const data = meta.sheets.filter(s => !s.title.startsWith('_app_') && !s.hidden); const hs = await heads(data.map(s => s.title));
      data.forEach((s, i) => { const h = hs[i]; if (!h.some(Boolean) || h.includes('ID')) return; if (h.length >= s.columnCount) reqs.push({ appendDimension: { sheetId: s.sheetId, dimension: 'COLUMNS', length: 1 } }); writes.push({ range: `${q(s.title)}!${colL(h.length)}1`, values: [['ID']] }); });
      if (reqs.length) await api.batchUpdate(reqs); if (writes.length) await api.batchUpdateValues(writes, 'RAW');
      await reload();
      if (!S.config.owner) {
        await infer(); const c = S.config; c.owner = me.email;
        const mini = Object.keys(c.schema).filter(n => /miniatura|imagen|portada|thumbnail|image|cover/i.test(n));
        c.roles = [{ id: 'admin', name: tr('Administrador'), perms: { admin: true } },
        { id: 'editor', name: tr('Editor'), perms: { openPages: true, editPages: true, editCells: true, addRows: true, moveCards: true, moveTabs: true, addCards: true, comment: true, upload: true, viewHistory: true } },
        ...(mini.length ? [{ id: 'mini', name: tr('Miniaturero'), perms: { openPages: true, editCells: true, comment: true, upload: true, editableCols: mini } }] : []),
        { id: 'visit', name: tr('Visitante'), perms: { openPages: true } }];
        const g = c.schema[c.settings.groupCol]; if (g && g.options) { const p = g.options.find(o => /pendiente|por hacer|to ?do|idea|backlog|pending|not started/i.test(o.v)); if (p) g.default = p.v; }
        for (const n in c.schema) if (c.schema[n].type === 'person') c.schema[n].roleId = /^editor/i.test(n) ? 'editor' : /^(miniaturero|thumbnail artist|designer)/i.test(n) && mini.length ? 'mini' : '';
        c.users = [{ email: me.email, name: me.name || me.email, roleId: 'admin', overrides: {} }]; c.templates = []; seedAutomations();
        await saveConfigNow(); await reload();
      }
      await assignIdsNow(); await fillDefaultsNow(); await fixNumbersNow();
    });
  }
  async function assignIdsNow() {
    let did = false;
    for (const tab of S.order) {
      const T = S.tabs[tab]; if (T.idCol < 0 || !T.rows.some(r => r.tmp)) continue;
      const t = await fresh(tab); const raw = t.rows.filter(r => r.tmp).map(r => ({ range: `${q(tab)}!${colL(t.idCol)}${r.r + 1}`, values: [[newId()]] }));
      if (raw.length) { await api.batchUpdateValues(raw, 'RAW'); did = true; }
    }
    if (did) await reload();
  }
  async function init() {
    try { apply(await fetchAll(), true); await autoFill(); }
    catch (e) { if (e.auth) S.authExpired = true; S.status = 'error'; S.error = e.status === 404 ? tr('No se encontró el Sheet. Revisa el enlace.') : e.status === 403 ? tr('Tu cuenta de Google no tiene acceso a este Sheet.') : (e.message || String(e)); emit(); }
  }
  const refresh = () => enqueue(async () => apply(await fetchAll(), false)).then(() => autoFill());
  const allRows = tab => (tab && S.tabs[tab] ? S.tabs[tab].rows : S.order.filter(t => !hiddenTabs().includes(t)).flatMap(t => S.tabs[t].rows));
  const duplicates = () => { const m = new Map(), tc = S.config.settings.titleCol, d = new Set(); if (!tc) return d; allRows().forEach(r => { const k = norm(r.v[tc]); if (!k) return; if (m.has(k)) { d.add(r.id); d.add(m.get(k)); } else m.set(k, r.id); }); return d; };
  const idle = async () => { for (let i = 0; i < 20; i++) { if (flushP) await flushP; await chain; if (!flushP && !pendingW.size) return; } };

  // ---------- Automatizaciones: CUANDO <disparador> · SI <condiciones> · ENTONCES <acciones> ----------
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const condOk = (row, c) => {
    const v = String(row.v[c.col] ?? ''), empty = !v || v === 'false';
    if (c.op === 'empty') return empty; if (c.op === 'full') return !empty;
    if (c.op === 'is') return v === c.val || v.split(',').map(x => x.trim()).includes(c.val);
    if (c.op === 'isnot') return !(v === c.val || v.split(',').map(x => x.trim()).includes(c.val));
    if (c.op === 'has') return v.toLowerCase().includes(String(c.val || '').toLowerCase());
    if (c.op === 'tab') return row.tab === c.val;
    return true;
  };
  function triggers(a, kind, tab, info) {
    const w = a.when || {};
    if (w.type === 'create') return kind === 'create';
    if (w.type === 'move') return kind === 'move' && (!w.tab || w.tab === info.to);
    if (w.type === 'change') {
      if (kind !== 'change' || info.col !== w.col) return false;
      const after = String(info.after ?? ''), before = String(info.before ?? '');
      if (w.to === '*empty') return !after || after === 'false';
      if (w.to && w.to !== '*any') return after === w.to || (type(w.col) === 'multi' && after.split(',').map(x => x.trim()).includes(w.to) && !before.split(',').map(x => x.trim()).includes(w.to)) || (type(w.col) === 'checkbox' && String(w.to) === String(after));
      return true;
    }
    return false;
  }
  function runAutomations(kind, tab, id, info) {
    const list = (S.config.automations || []).filter(a => a.enabled !== false); if (!list.length || !S.prepared) return;
    for (const a of list) {
      if (!triggers(a, kind, tab, info)) continue;
      const row = S.tabs[tab]?.rows.find(r => r.id === id); if (!row) continue;
      if (!(a.conds || []).every(c => condOk(row, c))) continue;
      const title = titleOf(row) || tr('Sin título'), notes = [];
      for (const x of a.actions || []) {
        const cur = S.order.map(t => S.tabs[t].rows.find(r => r.id === id)).find(Boolean); if (!cur) break;
        if (x.type === 'set' && cur.tab && S.tabs[cur.tab].header.includes(x.col)) setCell(cur.tab, id, x.col, type(x.col) === 'checkbox' ? x.val === true || x.val === 'true' : x.val, { system: true });
        if (x.type === 'today' && S.tabs[cur.tab].header.includes(x.col)) setCell(cur.tab, id, x.col, todayISO(), { system: true });
        if (x.type === 'clear' && S.tabs[cur.tab].header.includes(x.col)) setCell(cur.tab, id, x.col, type(x.col) === 'checkbox' ? false : '', { system: true });
        if (x.type === 'move' && x.tab && x.tab !== cur.tab) moveRow(cur.tab, id, x.tab, { system: true });
        if (x.type === 'notify') {
          const who = x.to === 'me' ? [myName()] : x.to && x.to.startsWith('col:') ? [cur.v[x.to.slice(4)]].filter(Boolean) : x.to && x.to.startsWith('user:') ? [(S.config.users.find(u => u.email === x.to.slice(5)) || {}).name].filter(Boolean) : [];
          const msg = (x.msg || tr('«{titulo}» cambió')).replace(/\{(titulo|title)\}/g, title).replace(/\{(quien|who)\}/g, myName());
          who.forEach(n => { if (n === myName() && opts.notify) opts.notify(a.name || tr('Automatización'), msg); notes.push([cur.tab, id, n, '', msg, 'notify', a.name || tr('Automatización')]); });
        }
      }
      if (notes.length) enqueue(() => log(notes));
      toast('⚡ ' + (a.name || tr('Automatización')) + ': ' + title.slice(0, 40));
    }
  }
  // Automatizaciones de ejemplo que se agregan una sola vez si las columnas existen.
  function seedAutomations() {
    const c = S.config; if (c.autoSeeded) return false; c.autoSeeded = true; c.automations = c.automations || [];
    const g = c.settings.groupCol, sch = c.schema, has = n => !!sch[n];
    const pub = g && (sch[g]?.options || []).find(o => /publicad|published|live/i.test(o.v)), dateCol = Object.keys(sch).find(n => /publicaci|publish|release/i.test(n) && sch[n].type === 'date');
    if (pub && dateCol) c.automations.push({ id: newId(), name: tr('Fecha al publicar'), enabled: true, when: { type: 'change', col: g, to: pub.v }, conds: [{ col: dateCol, op: 'empty' }], actions: [{ type: 'today', col: dateCol }] });
    const mini = Object.keys(sch).find(n => sch[n].type === 'select' && /^(miniatura|thumbnail)( status)?$/i.test(n)), fin = mini && (sch[mini].options || []).find(o => /finalizad|lista|hecha|done|ready|finished/i.test(o.v)), ed = Object.keys(sch).find(n => sch[n].type === 'person' && /^editor/i.test(n));
    if (fin && ed) c.automations.push({ id: newId(), name: tr('Avisar al editor: miniatura lista'), enabled: true, when: { type: 'change', col: mini, to: fin.v }, conds: [], actions: [{ type: 'notify', to: 'col:' + ed, msg: tr('La miniatura de «{titulo}» está lista') }] });
    return true;
  }
  const searchPages = (qy, rows) => { const k = norm(qy); if (k.length < 2) return []; const out = []; for (const r of rows) { const md = S.pages[r.id]?.md; if (!md) continue; const i = norm(md).indexOf(k); if (i >= 0) out.push({ row: r, snippet: md.replace(/[#*>`\[\]-]/g, ' ').replace(/\s+/g, ' ').slice(Math.max(0, i - 30), i + 70) }); } return out; };
  return { runAutomations, todayISO, autoFill, setMany, undoLast, redoLast, setPageMeta, setPresence, editComment, deleteComment, searchPages, S, subscribe: f => { subs.add(f); return () => subs.delete(f); }, emit, toast, init, refresh, prepare, can, canEditCol, hiddenCols, hiddenTabs, type, myName, perms, setCell, resolveConflict, addRow, deleteRow, moveRow, reorder, undo, addColumn, renameColumn, deleteColumn, addTab, renameTab, tabNameError, deleteTab, restoreTab, canRestoreTab, undoable, folderCol, foldersOf, addFolder, moveToFolder, renameFolder, deleteFolder, syncGroups, folderNameError, renameOption, saveConfig, savePage, addComment, allRows, duplicates, idle, api };
}
