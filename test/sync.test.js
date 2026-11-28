import './setup-es.js';
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { MockSheets } from '../src/mock.js'; import { createStore, APP } from '../src/store.js'; import { isoToSerial } from '../src/util.js';
const seed = () => JSON.parse(fs.readFileSync(new URL('./fixture.json', import.meta.url)));
const ME = { email: 'marcos@example.com', name: 'Marcos' };
async function boot(me = ME, data = seed(), api) { api = api || new MockSheets(data); const st = createStore(api, me, { notify: (...a) => (st.notes = st.notes || []).push(a) }); await st.init(); return { api, st, S: st.S }; }
async function ready() { const x = await boot(); await x.st.prepare(); return x; }
const cell = (api, tab, id, col) => { const s = api.sheet(tab); const h = s.rows[0]; const r = s.rows.find(r => r[h.indexOf('ID')] === id); return r[h.indexOf(col)]; };

test('preparar: crea pestañas ocultas, infiere tipos y deja dueño', async () => {
  const { api, S, st } = await boot(); assert.equal(S.prepared, false); assert.equal(st.can('editCells'), false);
  await st.prepare(); assert.equal(S.prepared, true);
  for (const t of Object.values(APP)) assert.ok(api.sheet(t).hidden);
  const sc = S.config.schema;
  assert.equal(sc['#'].type, 'auto'); assert.equal(sc['Fecha'].type, 'date'); assert.equal(sc['Guión listo'].type, 'checkbox');
  assert.equal(sc['Estado'].type, 'select'); assert.deepEqual(sc['Estado'].options.map(o => o.v), ['Pendiente', 'Grabando', 'Editando', 'Publicado', 'Descartado']);
  assert.equal(sc['Referencia'].type, 'url'); assert.equal(sc['Archivo Miniatura'].type, 'image'); assert.equal(sc['Editor'].type, 'person'); assert.equal(sc['Título del Video'].type, 'text');
  assert.deepEqual([S.config.settings.titleCol, S.config.settings.groupCol, S.config.settings.dateCol, S.config.settings.imageCol], ['Título del Video', 'Estado', 'Fecha de publicación', 'Archivo Miniatura']);
  assert.equal(S.config.owner, ME.email); assert.equal(S.tabs.ROBLOX.rows.length, 65); assert.equal(S.tabs.ROBLOX.rows[0].v['Fecha'], '2026-07-25'); assert.equal(S.tabs.ROBLOX.rows[0].v['#'], '1');
  const { S: S2 } = await boot(ME, api.d); assert.equal(S2.prepared, true); assert.equal(S2.config.schema['Estado'].type, 'select');
});

test('editar una celda cae en la fila correcta aunque el Sheet se haya reordenado', async () => {
  const { api, st, S } = await ready(); const row = S.tabs.ROBLOX.rows[10]; const s = api.sheet('ROBLOX');
  s.rows = [s.rows[0], ...s.rows.slice(1).reverse()]; s.rows.splice(1, 0, ['', '', 'fila nueva puesta a mano']);
  await st.setCell('ROBLOX', row.id, 'Estado', 'Editando');
  assert.equal(cell(api, 'ROBLOX', row.id, 'Estado'), 'Editando'); assert.equal(S.tabs.ROBLOX.rows.find(r => r.id === row.id).v['Estado'], 'Editando');
  assert.equal(s.rows.filter(r => r[4] === 'Editando').length, 1);
  const h = S.history.at(-1); assert.deepEqual([h.kind, h.col, h.before, h.after], ['edit', 'Estado', 'Publicado', 'Editando']);
});

test('conflicto: no pisa un cambio hecho en el Sheet y deja elegir', async () => {
  const { api, st, S } = await ready(); const row = S.tabs.ROBLOX.rows[3]; const s = api.sheet('ROBLOX'); const r = s.rows.find(x => x[17] === row.id);
  r[4] = 'Descartado';
  await st.setCell('ROBLOX', row.id, 'Estado', 'Grabando');
  assert.equal(r[4], 'Descartado'); assert.equal(S.conflicts.length, 1); assert.equal(S.tabs.ROBLOX.rows.find(x => x.id === row.id).v['Estado'], 'Descartado');
  st.resolveConflict(S.conflicts[0], true); await st.idle();
  assert.equal(r[4], 'Grabando'); assert.equal(S.conflicts.length, 0);
});

test('agregar fila: ID, numeración automática, fecha real y página de plantilla', async () => {
  const { api, st, S } = await ready();
  const id = st.addRow('MITOS', { 'Título del Video': '=SUMA(1) no es fórmula', 'Fecha de publicación': '2026-12-24', 'Estado': 'Pendiente', 'Guión listo': true }, { page: '# Guion\n\n- [ ] Intro' });
  assert.equal(S.tabs.MITOS.rows.at(-1).id, id); await st.idle();
  assert.equal(cell(api, 'MITOS', id, 'Título del Video'), '=SUMA(1) no es fórmula'); assert.equal(cell(api, 'MITOS', id, 'Fecha de publicación'), isoToSerial('2026-12-24'));
  assert.equal(cell(api, 'MITOS', id, 'Guión listo'), true); assert.equal(cell(api, 'MITOS', id, '#'), 12);
  const row = S.tabs.MITOS.rows.find(r => r.id === id); assert.equal(row.v['#'], '12'); assert.equal(row.v['Fecha de publicación'], '2026-12-24'); assert.equal(S.tabs.MITOS.rows.length, 12);
  const { S: S2 } = await boot(ME, api.d); assert.equal(S2.pages[id].md, '# Guion\n\n- [ ] Intro');
});

test('eliminar fila borra la correcta y deshacer la restaura con su ID', async () => {
  const { api, st, S } = await ready(); const row = S.tabs['SHORTS 2D'].rows[2]; const title = row.v['Título del Video']; const s = api.sheet('SHORTS 2D');
  s.rows.splice(1, 0, ['', '', 'insertada a mano']);
  await st.deleteRow('SHORTS 2D', row.id);
  assert.ok(!s.rows.some(r => r[2] === title)); assert.equal(s.rows.length, 11); assert.ok(s.rows.some(r => r[2] === 'insertada a mano'));
  st.undo(S.history.at(-1)); await st.idle();
  assert.equal(cell(api, 'SHORTS 2D', row.id, 'Título del Video'), title);
});

test('filas agregadas a mano en el Sheet reciben ID', async () => {
  const { api, st } = await ready(); api.sheet('REACCIONES').rows.push(['', '', 'Video escrito directo en el Sheet']);
  const { S } = await boot(ME, api.d); const r = S.tabs.REACCIONES.rows.at(-1);
  assert.equal(r.v['Título del Video'], 'Video escrito directo en el Sheet'); assert.match(r.id, /^[a-z0-9]{8}$/); assert.equal(api.sheet('REACCIONES').rows.at(-1)[17], r.id);
});

test('permisos por rol y ajustes individuales', async () => {
  const { api, st, S } = await ready();
  S.config.users.push({ email: 'mini@example.com', name: 'Mini', roleId: 'mini', overrides: {} }, { email: 'ed@example.com', name: 'Ed', roleId: 'editor', overrides: { moveCards: false, deleteRows: true } }); await st.saveConfig();
  const v = await boot({ email: 'nadie@example.com', name: 'Visita' }, api.d); const id = v.S.tabs.ROBLOX.rows[0].id;
  assert.equal(v.st.can('openPages'), true); assert.equal(v.st.can('editCells'), false); v.st.setCell('ROBLOX', id, 'Estado', 'Editando'); await v.st.idle(); assert.equal(cell(api, 'ROBLOX', id, 'Estado'), 'Publicado');
  assert.equal(v.st.addRow('ROBLOX', {}), undefined);
  const m = await boot({ email: 'MINI@example.com', name: 'Mini' }, api.d);
  assert.equal(m.st.canEditCol('Miniatura'), true); assert.equal(m.st.canEditCol('Estado'), false); assert.equal(m.st.canEditCol('#'), false);
  await m.st.setCell('ROBLOX', id, 'Miniatura', 'En proceso'); assert.equal(cell(api, 'ROBLOX', id, 'Miniatura'), 'En proceso');
  const e = await boot({ email: 'ed@example.com', name: 'Ed' }, api.d); assert.equal(e.st.can('moveCards'), false); assert.equal(e.st.can('deleteRows'), true); assert.equal(e.st.can('admin'), false);
});

test('columnas: agregar, renombrar, eliminar y renombrar opción', async () => {
  const { api, st, S } = await ready();
  await st.addColumn('Etiquetas', 'multi', S.order); assert.equal(api.sheet('ROBLOX').rows[0][18], 'Etiquetas'); assert.equal(api.sheet('ROBLOX').cols, 19); assert.equal(S.config.schema['Etiquetas'].type, 'multi');
  const id = S.tabs.ROBLOX.rows[0].id; await st.setCell('ROBLOX', id, 'Etiquetas', 'viral, teclas'); assert.equal(cell(api, 'ROBLOX', id, 'Etiquetas'), 'viral, teclas');
  await st.renameColumn('Estado', 'Etapa'); assert.equal(api.sheet('MITOS').rows[0][4], 'Etapa'); assert.equal(S.config.settings.groupCol, 'Etapa'); assert.equal(S.config.schema['Etapa'].type, 'select'); assert.equal(S.tabs.ROBLOX.rows[0].v['Etapa'], 'Publicado');
  await st.renameOption('Etapa', 'Publicado', 'En línea'); assert.equal(cell(api, 'ROBLOX', id, 'Etapa'), 'En línea'); assert.ok(!api.sheet('ROBLOX').rows.some(r => r[4] === 'Publicado'));
  await st.deleteColumn('Notas'); assert.ok(!api.sheet('ROBLOX').rows[0].includes('Notas')); assert.equal(cell(api, 'ROBLOX', id, 'Etiquetas'), 'viral, teclas'); assert.equal(S.tabs.ROBLOX.rows[0].id, id);
});

test('páginas largas se guardan en trozos y se recuperan íntegras; comentarios', async () => {
  const { api, st, S } = await ready(); const id = S.tabs.ROBLOX.rows[0].id; const md = '# Título\n\n' + 'párrafo con acentos y emoji 🎬 '.repeat(4000);
  await st.savePage(id, md); await st.savePage(id, md + 'fin'); st.addComment(id, 'Listo @Marcos'); await st.idle();
  assert.equal(api.sheet(APP.pages).rows.length, 2);
  const { S: S2 } = await boot(ME, api.d); assert.equal(S2.pages[id].md, md + 'fin'); assert.equal(S2.comments[0].text, 'Listo @Marcos');
});

test('Sheet genérico sin ID: se prepara, agrega la columna y asigna IDs', async () => {
  const data = { title: 'Otro proyecto', sheets: [{ sheetId: 0, title: "Tareas d'equipo", cols: 3, rows: [['Nombre', 'Status', 'Costo'], ['Diseñar logo', 'Hecho', 1200], ['Publicar', 'Pendiente', 300]], hints: { Status: { options: ['Pendiente', 'Hecho'] } } }, { sheetId: 1, title: 'Vacía', rows: [] }] };
  const { api, st, S } = await boot(ME, data); assert.equal(S.tabs["Tareas d'equipo"].rows.length, 2); assert.ok(S.tabs["Tareas d'equipo"].rows[0].tmp);
  await st.prepare(); const T = S.tabs["Tareas d'equipo"];
  assert.deepEqual(api.sheet("Tareas d'equipo").rows[0], ['Nombre', 'Status', 'Costo', 'ID']); assert.ok(T.rows.every(r => !r.tmp)); assert.equal(S.config.schema.Costo.type, 'number'); assert.equal(S.config.settings.groupCol, 'Status'); assert.equal(S.config.settings.titleCol, 'Nombre');
  await st.setCell("Tareas d'equipo", T.rows[1].id, 'Costo', '450'); assert.equal(api.sheet("Tareas d'equipo").rows[2][2], 450); assert.deepEqual(S.order, ["Tareas d'equipo"]);
});

test('cuenta de solo lectura en Google: avisa y revierte', async () => {
  const { api, st, S } = await ready(); const id = S.tabs.ROBLOX.rows[0].id; api.readOnly = true;
  await st.setCell('ROBLOX', id, 'Estado', 'Editando'); assert.equal(S.readOnly, true); assert.equal(S.tabs.ROBLOX.rows[0].v['Estado'], 'Publicado'); assert.equal(st.can('editCells'), false);
});

test('avisos: asignación y mención detectadas al sincronizar', async () => {
  const { api, st, S } = await ready(); const s = api.sheet('ROBLOX'); s.rows[1][12] = 'Marcos'; api.sheet(APP.comments).rows.push(['x1', S.tabs.ROBLOX.rows[0].id, 'otro@example.com', 'Otro', '2026-11-11', 'ojo @Marcos']);
  await st.refresh(); assert.equal(st.notes.length, 2); assert.match(st.notes[0][0], /Te asignaron/); assert.match(st.notes[1][0], /te mencionó/);
});

test('valor por defecto: rellena vacíos, filas nuevas y se configura al preparar', async () => {
  const { api, st, S } = await ready(); assert.equal(S.config.schema['Estado'].default, 'Pendiente');
  const s = api.sheet('ROBLOX'); assert.ok(!s.rows.slice(1).some(r => r[2] && !r[4]), 'no quedan estados vacíos');
  s.rows.push(['', '', 'Video escrito a mano sin estado']); await st.refresh(); await st.idle();
  assert.equal(s.rows.at(-1)[4], 'Pendiente'); assert.match(s.rows.at(-1)[17], /^[a-z0-9]{8}$/);
  const id = st.addRow('MITOS', { 'Título del Video': 'Nuevo' }); await st.idle(); assert.equal(cell(api, 'MITOS', id, 'Estado'), 'Pendiente');
  const id2 = st.addRow('MITOS', { 'Título del Video': 'Otro', Estado: 'Grabando' }); await st.idle(); assert.equal(cell(api, 'MITOS', id2, 'Estado'), 'Grabando');
});

test('mover entre pestañas: conserva ID, datos, página y comentarios; deshacer lo regresa', async () => {
  const { api, st, S } = await ready(); const row = S.tabs.REACCIONES.rows[0]; const id = row.id; const title = row.v['Título del Video']; const before = { ...row.v };
  await st.savePage(id, '# Guion'); st.addComment(id, 'nota'); await st.idle();
  api.sheet('ROBLOX VARIEDAD').rows.splice(1, 0, ['', '', 'fila puesta a mano arriba']);
  st.moveRow('REACCIONES', id, 'ROBLOX VARIEDAD');
  assert.ok(S.tabs['ROBLOX VARIEDAD'].rows.some(r => r.id === id)); assert.ok(!S.tabs.REACCIONES.rows.some(r => r.id === id));
  await st.idle();
  const dst = api.sheet('ROBLOX VARIEDAD'), src = api.sheet('REACCIONES');
  assert.ok(!src.rows.some(r => r[17] === id)); assert.equal(src.rows.length, 2);
  const m = dst.rows.find(r => r[17] === id); assert.equal(m[2], title); assert.equal(m[4], before['Estado']); assert.equal(m[5] || '', before['Canal']); assert.equal(m[3] || '', before['Temática']); assert.equal(m[15] || '', before['Referencia']); assert.equal(m[0], 21);
  assert.ok(dst.rows.some(r => r[2] === 'fila puesta a mano arriba'));
  assert.equal(S.pages[id].md, '# Guion'); assert.equal(S.comments.filter(c => c.rowId === id).length, 1);
  const h = S.history.at(-1); assert.deepEqual([h.kind, h.before, h.after], ['move', 'REACCIONES', 'ROBLOX VARIEDAD']);
  st.undo(h); await st.idle(); assert.ok(src.rows.some(r => r[17] === id && r[2] === title)); assert.ok(!dst.rows.some(r => r[17] === id));
  const v = await boot({ email: 'nadie@example.com', name: 'V' }, api.d); assert.equal(v.st.can('moveTabs'), false);
});

test('reordenar: mueve la fila en el Sheet, también entre pestañas con posición', async () => {
  const { api, st, S } = await ready(); const ids = S.tabs.MITOS.rows.map(r => r.id); const sh = api.sheet('MITOS');
  const titleAt = i => sh.rows[i + 1][2], byId = id => S.tabs.MITOS.rows.find(r => r.id === id).v['Título del Video'];
  const t5 = byId(ids[5]), t1 = byId(ids[1]);
  st.reorder('MITOS', ids[5], ids[1], false); assert.equal(S.tabs.MITOS.rows[1].id, ids[5]); await st.idle();
  assert.equal(titleAt(1), t5); assert.equal(titleAt(2), t1); assert.deepEqual(S.tabs.MITOS.rows.map(r => r.id), [ids[0], ids[5], ids[1], ids[2], ids[3], ids[4], ...ids.slice(6)]);
  st.reorder('MITOS', ids[0], ids[10], true); await st.idle(); assert.equal(S.tabs.MITOS.rows.at(-1).id, ids[0]); assert.equal(sh.rows.at(-1)[17], ids[0]);
  assert.equal(S.tabs.MITOS.rows[0].v['#'], '6', 'el # se queda fijo aunque cambie el orden'); assert.equal(S.tabs.MITOS.rows.at(-1).v['#'], '1');
  const r = S.tabs.REACCIONES.rows[1]; const target = S.tabs['SHORTS 2D'].rows[2].id;
  st.moveRow('REACCIONES', r.id, 'SHORTS 2D', { pos: { targetId: target, after: false } }); await st.idle();
  const T = S.tabs['SHORTS 2D'].rows; const k = T.findIndex(x => x.id === r.id); assert.equal(T[k + 1].id, target);
  const v = await boot({ email: 'nadie@example.com', name: 'V' }, api.d); v.st.reorder('MITOS', ids[2], ids[3], true); await v.st.idle(); assert.equal(api.sheet('MITOS').rows.findIndex(x => x[17] === ids[2]), 3);
});

test('# fijo: se congela al preparar, nuevas filas toman el siguiente y no cambia al borrar o reordenar', async () => {
  const { api, st, S } = await ready(); const sh = api.sheet('ROBLOX');
  assert.ok(sh.rows.slice(1).every(r => typeof r[0] === 'number'), 'ya no hay fórmulas'); assert.equal(S.config.fixedNums, true);
  const ids = S.tabs.ROBLOX.rows.map(r => r.id); await st.deleteRow('ROBLOX', ids[0]); await st.idle();
  assert.equal(S.tabs.ROBLOX.rows[0].v['#'], '2');
  const id = st.addRow('ROBLOX', { 'Título del Video': 'Nuevo' }); await st.idle(); assert.equal(S.tabs.ROBLOX.rows.find(r => r.id === id).v['#'], '66');
  sh.rows.push(['', '', 'escrito a mano']); await st.refresh(); await st.idle(); assert.equal(sh.rows.at(-1)[0], 67);
});

test('lote: varias ediciones seguidas se guardan juntas y con pocas lecturas', async () => {
  const { api, st, S } = await ready(); const rows = S.tabs.ROBLOX.rows; api.calls.length = 0;
  rows.slice(0, 5).forEach(r => st.setCell('ROBLOX', r.id, 'Estado', 'Grabando')); st.setCell('MITOS', S.tabs.MITOS.rows[0].id, 'Canal', 'Lime!'); await st.idle();
  assert.deepEqual(api.calls, ['batchGet', 'batchGet', 'write', 'append']);
  assert.equal(api.sheet('ROBLOX').rows.filter(r => r[4] === 'Grabando').length, 5);
});

test('deshacer y rehacer: celdas, grupos y eliminar', async () => {
  const { api, st, S } = await ready(); const [a, b] = S.tabs.MITOS.rows;
  st.setCell('MITOS', a.id, 'Estado', 'Editando'); st.setMany([{ tab: 'MITOS', id: a.id, col: 'Canal', val: 'Lime!' }, { tab: 'MITOS', id: b.id, col: 'Canal', val: 'Lime!' }]); await st.idle();
  st.undoLast(); await st.idle(); assert.equal(cell(api, 'MITOS', a.id, 'Canal'), ''); assert.equal(cell(api, 'MITOS', b.id, 'Canal'), ''); assert.equal(cell(api, 'MITOS', a.id, 'Estado'), 'Editando');
  st.redoLast(); await st.idle(); assert.equal(cell(api, 'MITOS', b.id, 'Canal'), 'Lime!');
  const t = b.v['Título del Video']; st.deleteRow('MITOS', b.id); await st.idle(); st.undoLast(); await st.idle();
  assert.equal(cell(api, 'MITOS', b.id, 'Título del Video'), t);
});

test('páginas: dos personas editan a la vez y se combinan los cambios', async () => {
  const { api, st, S } = await ready(); const id = S.tabs.ROBLOX.rows[0].id;
  await st.savePage(id, '# Guion\n\nIntro\n\nDesarrollo\n\nCierre'); await st.idle();
  const ana = await boot({ email: 'ana@example.com', name: 'Ana' }, api.d); S.config.users.push({ email: 'ana@example.com', name: 'Ana', roleId: 'editor', overrides: {} }); await st.saveConfig(); await ana.st.refresh(); await ana.st.idle();
  ana.st.savePage(id, '# Guion\n\nIntro con chiste\n\nDesarrollo\n\nCierre'); await ana.st.idle();
  await st.savePage(id, '# Guion\n\nIntro\n\nDesarrollo\n\nCierre con llamada a suscribirse'); await st.idle();
  const { S: S3 } = await boot(ME, api.d); assert.equal(S3.pages[id].md, '# Guion\n\nIntro con chiste\n\nDesarrollo\n\nCierre con llamada a suscribirse');
  assert.equal(S.pages[id].md, S3.pages[id].md); assert.ok(S.merged[id]);
});

test('comentarios: respuestas, editar, borrar; presencia', async () => {
  const { api, st, S } = await ready(); const id = S.tabs.ROBLOX.rows[0].id;
  st.addComment(id, 'Hola'); await st.idle(); const c = S.comments[0]; st.addComment(id, 'Respuesta', c.id); await st.idle();
  st.editComment(c.id, 'Hola editado'); await st.idle(); st.deleteComment(S.comments[1].id); await st.idle();
  const { S: S2 } = await boot(ME, api.d); assert.equal(S2.comments[0].text, 'Hola editado'); assert.ok(S2.comments[0].edited); assert.equal(S2.comments[1].parent, c.id); assert.equal(S2.comments[1].deleted, true);
  S.config.users.push({ email: 'ana@example.com', name: 'Ana', roleId: 'editor', overrides: {} }); await st.saveConfig();
  const ana = await boot({ email: 'ana@example.com', name: 'Ana' }, api.d); await ana.st.setPresence(id); await ana.st.idle();
  await st.refresh(); await st.idle(); assert.deepEqual(S.presence.map(p => [p.name, p.rowId]), [['Ana', id]]);
});

test('ícono y portada de página; búsqueda en contenido', async () => {
  const { api, st, S } = await ready(); const r = S.tabs.MITOS.rows[2];
  st.setPageMeta(r.id, { icon: '🎬', cover: 'grad:sunset' }); await st.savePage(r.id, 'Hablar del **easter egg** secreto'); await st.idle();
  const { S: S2, st: st2 } = await boot(ME, api.d); assert.deepEqual(S2.pageMeta[r.id], { icon: '🎬', cover: 'grad:sunset' }); assert.ok(!('meta:' + r.id in S2.pages));
  const res = st2.searchPages('easter egg', st2.allRows()); assert.equal(res.length, 1); assert.equal(res[0].row.id, r.id);
});

test('automatizaciones: ejemplos sembrados, reglas propias, condiciones y avisos', async () => {
  const { api, st, S } = await ready(); const today = st.todayISO();
  assert.deepEqual(S.config.automations.map(a => a.name), ['Fecha al publicar', 'Avisar al editor: miniatura lista']);
  const r = S.tabs.MITOS.rows[0]; st.setCell('MITOS', r.id, 'Estado', 'Publicado'); await st.idle();
  assert.equal(cell(api, 'MITOS', r.id, 'Fecha de publicación'), isoToSerial(today));
  S.config.users.push({ email: 'ed@example.com', name: 'Ed', roleId: 'editor', overrides: {} });
  S.config.automations.push({ id: 'x', name: 'Mitos descartados a archivo', when: { type: 'change', col: 'Estado', to: 'Descartado' }, conds: [{ col: 'Canal', op: 'isnot', val: 'Lime!' }], actions: [{ type: 'set', col: 'Miniatura', val: 'Falta' }, { type: 'move', tab: 'SHORTS 2D' }, { type: 'notify', to: 'user:ed@example.com', msg: '{quien} descartó «{titulo}»' }] });
  await st.saveConfig();
  const r2 = S.tabs.MITOS.rows[1]; st.setCell('MITOS', r2.id, 'Estado', 'Descartado'); await st.idle(); await st.idle();
  assert.ok(api.sheet('SHORTS 2D').rows.some(x => x[17] === r2.id)); assert.equal(cell(api, 'SHORTS 2D', r2.id, 'Miniatura'), 'Falta');
  assert.ok(S.history.some(h => h.kind === 'notify' && h.col === 'Ed' && /descartó/.test(h.after)));
  const ed = await boot({ email: 'ed@example.com', name: 'Ed' }, api.d); st.setCell('MITOS', S.tabs.MITOS.rows[2].id, 'Editor', 'Ed'); await st.idle();
  st.setCell('MITOS', S.tabs.MITOS.rows[2].id, 'Miniatura', 'Finalizada'); await st.idle(); await ed.st.refresh(); await ed.st.idle();
  assert.ok(ed.st.notes.some(n => /miniatura de/.test(n[1])));
  const r3 = S.tabs.MITOS.rows[3]; S.tabs.MITOS.rows[3].v['Canal'] = 'Lime!'; st.setCell('MITOS', r3.id, 'Estado', 'Descartado'); await st.idle();
  assert.ok(api.sheet('MITOS').rows.some(x => x[17] === r3.id), 'la condición evitó moverlo');
});

test('pestañas: crear con las mismas columnas, renombrar y actualizar referencias', async () => {
  const { api, st, S } = await ready();
  const other = S.order.find(t => t !== 'ROBLOX');
  S.config.roles[0].perms.hiddenTabs = ['ROBLOX'];
  S.config.automations = [{ id: 'a1', name: 'mover', enabled: true, when: { type: 'move', tab: 'ROBLOX' }, conds: [{ op: 'tab', val: 'ROBLOX' }], actions: [{ type: 'move', tab: 'ROBLOX' }] }];
  await st.saveConfig();
  // Nombres inválidos o repetidos no hacen nada.
  assert.equal(await st.addTab('roblox'), null); assert.equal(await st.addTab('_app_x'), null); assert.equal(await st.addTab('   '), null);
  const n = await st.addTab('SHORTS 3D', 'ROBLOX'); assert.equal(n, 'SHORTS 3D');
  assert.ok(S.order.includes('SHORTS 3D')); assert.deepEqual(api.sheet('SHORTS 3D').rows[0], S.tabs.ROBLOX.header.filter(Boolean));
  assert.equal(S.tabs['SHORTS 3D'].rows.length, 0); assert.ok(S.tabs['SHORTS 3D'].idCol >= 0);
  await st.addRow('SHORTS 3D', { 'Título del Video': 'Primera idea' }); await st.idle();
  assert.equal(S.tabs['SHORTS 3D'].rows.length, 1);
  // Renombrar.
  assert.equal(await st.renameTab('ROBLOX', other), null);
  assert.equal(await st.renameTab('ROBLOX', 'ROBLOX PRINCIPAL'), 'ROBLOX PRINCIPAL');
  assert.ok(!S.tabs.ROBLOX); assert.equal(S.tabs['ROBLOX PRINCIPAL'].rows.length, 65); assert.ok(api.sheet('ROBLOX PRINCIPAL'));
  assert.deepEqual(S.config.roles[0].perms.hiddenTabs, ['ROBLOX PRINCIPAL']);
  const a = S.config.automations[0]; assert.deepEqual([a.when.tab, a.conds[0].val, a.actions[0].tab], ['ROBLOX PRINCIPAL', 'ROBLOX PRINCIPAL', 'ROBLOX PRINCIPAL']);
  // La configuración guardada también cambió.
  const { S: S2 } = await boot(ME, api.d); assert.equal(S2.config.automations[0].when.tab, 'ROBLOX PRINCIPAL'); assert.ok(S2.order.includes('SHORTS 3D'));
  // Sin permiso no se puede.
  const { st: st3 } = await boot({ email: 'otro@example.com', name: 'Otro' }, api.d); assert.equal(st3.can('manageTabs'), false); assert.equal(await st3.addTab('X'), null);
});

test('pestañas: eliminar oculta (no borra) y se restaura desde el historial o con deshacer', async () => {
  const { api, st, S } = await ready();
  const tab = S.order.find(t => t !== 'ROBLOX'), n = S.tabs[tab].rows.length, rowsBefore = JSON.stringify(api.sheet(tab).rows);
  assert.equal(await st.deleteTab(tab), true);
  assert.ok(!S.order.includes(tab)); assert.ok(api.sheet(tab).hidden); assert.equal(JSON.stringify(api.sheet(tab).rows), rowsBefore);
  const h = S.history.at(-1); assert.deepEqual([h.kind, h.before, h.after], ['tabdel', tab, String(n)]); assert.equal(st.undoable(h), true);
  // Restaurar desde el historial.
  assert.equal(await st.restoreTab(h.col), tab); assert.ok(S.order.includes(tab)); assert.equal(S.tabs[tab].rows.length, n); assert.equal(st.undoable(h), false);
  // Ctrl+Z: borrar y deshacer.
  await st.deleteTab(tab); assert.ok(!S.order.includes(tab)); st.undoLast(); await st.idle(); assert.ok(S.order.includes(tab));
  // Si ya existe otra con ese nombre, se restaura con otro nombre.
  // Google no permite dos pestañas con el mismo nombre, aunque una esté oculta: se avisa claramente.
  await st.deleteTab(tab); assert.match(st.tabNameError(tab), /eliminada/); assert.equal(await st.addTab(tab), null);
  const del = S.history.filter(x => x.kind === 'tabdel').at(-1); assert.equal(await st.restoreTab(del.col), tab); assert.equal(S.tabs[tab].rows.length, n);
  // No se puede eliminar la última pestaña.
  const { st: one, S: S1 } = await ready(); for (const t of S1.order.slice(1)) await one.deleteTab(t); assert.equal(S1.order.length, 1); assert.equal(await one.deleteTab(S1.order[0]), false);
  // Renombrar se puede deshacer desde el historial.
  await st.renameTab('ROBLOX', 'R2'); const ren = S.history.at(-1); assert.equal(ren.kind, 'tabren'); await st.undo(ren); await st.idle(); assert.ok(S.tabs.ROBLOX);
  // Una fila borrada se puede restaurar y luego deja de ofrecerse.
  const row = S.tabs.ROBLOX.rows[0]; await st.deleteRow('ROBLOX', row.id); const dh = S.history.filter(x => x.kind === 'delete').at(-1);
  assert.equal(st.undoable(dh), true); await st.undo(dh); await st.idle(); assert.ok(S.tabs.ROBLOX.rows.some(r => r.id === row.id)); assert.equal(st.undoable(dh), false);
});

test('carpetas: crear, meter filas lejanas al final, agrupar en Sheets, sacar, renombrar y eliminar', async () => {
  const { api, st, S } = await ready(); const tab = 'ROBLOX', ids = S.tabs[tab].rows.map(r => r.id);
  const idx = id => S.tabs[tab].rows.findIndex(r => r.id === id);
  assert.equal(await st.addFolder(tab, 'Ideas en pausa', [ids[2], ids[3]]), 'Ideas en pausa'); await st.idle();
  const fc = st.folderCol(); assert.equal(fc, 'Carpeta'); assert.ok(S.tabs[tab].header.includes(fc));
  assert.equal(cell(api, tab, ids[2], fc), 'Ideas en pausa'); assert.equal(cell(api, tab, ids[3], fc), 'Ideas en pausa');
  // Una fila lejana entra y queda al final de la carpeta.
  await st.moveToFolder(tab, [ids[40]], 'Ideas en pausa'); await st.idle();
  assert.deepEqual([idx(ids[2]), idx(ids[3]), idx(ids[40])], [2, 3, 4]);
  const sheetRows = api.sheet(tab).rows, h = sheetRows[0], at = id => sheetRows.findIndex(r => r[h.indexOf('ID')] === id);
  assert.deepEqual([at(ids[2]), at(ids[3]), at(ids[40])], [3, 4, 5]);
  assert.deepEqual(api.sheet(tab).rowGroups, [{ start: 3, end: 6, depth: 1 }]);
  // Nombre repetido en la misma pestaña no se permite.
  assert.equal(await st.addFolder(tab, 'ideas en pausa'), null);
  // Sacar una fila: queda justo debajo de la carpeta y el grupo se achica.
  await st.moveToFolder(tab, [ids[2]], ''); await st.idle();
  assert.equal(cell(api, tab, ids[2], fc), ''); assert.equal(idx(ids[2]), idx(ids[40]) + 1); assert.deepEqual(api.sheet(tab).rowGroups.map(g => g.end - g.start), [2]);
  // Renombrar.
  assert.equal(await st.renameFolder(tab, 'Ideas en pausa', 'Pausa'), 'Pausa'); await st.idle();
  assert.equal(cell(api, tab, ids[40], fc), 'Pausa'); assert.deepEqual(st.foldersOf(tab).map(f => f.name), ['Pausa']);
  // Carpeta vacía y luego eliminar: las filas siguen ahí.
  await st.addFolder(tab, 'Vacía'); await st.idle(); assert.deepEqual(st.foldersOf(tab).map(f => f.name), ['Pausa', 'Vacía']);
  const n = S.tabs[tab].rows.length; await st.deleteFolder(tab, 'Pausa'); await st.idle();
  assert.equal(S.tabs[tab].rows.length, n); assert.equal(cell(api, tab, ids[40], fc), ''); assert.deepEqual(api.sheet(tab).rowGroups, []);
  // Persistencia: otra persona ve las mismas carpetas.
  const { st: st2 } = await boot(ME, api.d); assert.deepEqual(st2.foldersOf(tab).map(f => f.name), ['Vacía']);
});

test('automatizaciones nuevas: carpeta, color, checklist, completar checklist, copia, comentario y por fecha', async () => {
  const { api, st, S } = await ready(); const tab = 'ROBLOX', g = S.config.settings.groupCol, opts = S.config.schema[g].options.map(o => o.v);
  const pub = opts.find(v => /publicad/i.test(v)), other = opts.find(v => v !== pub), shorts = S.order.find(t => t !== tab);
  S.config.automations = [
    { id: 'a1', name: 'pub', enabled: true, when: { type: 'change', col: g, to: pub }, conds: [], actions: [{ type: 'folder', folder: 'Publicados' }, { type: 'color', color: 'green' }, { type: 'dup', tab: shorts, suffix: '(Short)' }, { type: 'comment', msg: 'Publicado: {titulo}' }] },
    { id: 'a2', name: 'chk', enabled: true, when: { type: 'change', col: g, to: other }, conds: [], actions: [{ type: 'checklist', list: 'rec' }] },
    { id: 'a3', name: 'done', enabled: true, when: { type: 'checklist' }, conds: [{ op: 'chk', col: '', val: 'done' }], actions: [{ type: 'color', color: 'blue' }] },
  ];
  await st.saveConfig();
  const r = S.tabs[tab].rows.find(x => x.v[g] !== pub && x.v[S.config.settings.titleCol]), title = r.v[S.config.settings.titleCol], n0 = S.tabs[shorts].rows.length;
  st.setCell(tab, r.id, g, pub); await new Promise(res => setTimeout(res, 50)); await st.idle(); await new Promise(res => setTimeout(res, 50)); await st.idle();
  const fc = st.folderCol(), cc = st.colorCol();
  assert.equal(cell(api, tab, r.id, fc), 'Publicados'); assert.equal(cell(api, tab, r.id, cc), 'green');
  assert.equal(S.tabs[shorts].rows.length, n0 + 1); assert.ok(S.tabs[shorts].rows.some(x => x.v[S.config.settings.titleCol] === title + ' (Short)'));
  assert.ok(S.comments.some(c => c.rowId === r.id && c.text === 'Publicado: ' + title));
  // Checklist agregada al cambiar de estado; al completarla se dispara la otra automatización.
  const r2 = S.tabs[tab].rows.find(x => x.v[g] !== other && x.id !== r.id); st.setCell(tab, r2.id, g, other); await new Promise(res => setTimeout(res, 50)); await st.idle();
  const p = st.progressOf(r2.id); assert.ok(p.total >= 5 && p.done === 0);
  await st.checkAll(r2.id, true); await st.idle(); await new Promise(res => setTimeout(res, 50)); await st.idle();
  assert.equal(st.progressOf(r2.id).done, p.total); assert.equal(cell(api, tab, r2.id, cc), 'blue');
  // Por fecha: un día antes; corre una sola vez.
  const dc = Object.keys(S.config.schema).find(k => S.config.schema[k].type === 'date' && S.tabs[tab].header.includes(k));
  const r3 = S.tabs[tab].rows[9]; st.setCell(tab, r3.id, dc, st.addDays(st.todayISO(), 1)); await st.idle();
  S.config.automations = [{ id: 'd1', name: 'pre', enabled: true, when: { type: 'date', col: dc, dir: 'before', n: 1 }, conds: [], actions: [{ type: 'color', color: 'orange' }] }];
  const ran = st.runDateAutomations(); await st.idle(); await new Promise(res => setTimeout(res, 50)); await st.idle();
  assert.ok(ran >= 1); assert.equal(cell(api, tab, r3.id, cc), 'orange'); assert.equal(st.runDateAutomations(), 0);
});

test('automatizaciones por fecha: dos computadoras a la vez, los avisos salen una sola vez (candado)', async () => {
  const A = await ready(); const tab = A.S.order[0]; const dc = Object.keys(A.S.config.schema).find(k => A.S.config.schema[k].type === 'date' && A.S.tabs[tab].header.includes(k));
  const rows = A.S.tabs[tab].rows.slice(3, 6); for (const r of rows) A.st.setCell(tab, r.id, dc, A.st.addDays(A.st.todayISO(), 1)); await A.st.idle();
  A.S.config.automations = [{ id: 'dl', name: 'aviso', enabled: true, when: { type: 'date', col: dc, dir: 'before', n: 1 }, conds: [], actions: [{ type: 'comment', msg: 'mañana' }] }]; await A.st.saveConfig(); await A.st.idle();
  const B = await boot({ email: 'ana@example.com', name: 'Ana' }, null, A.api); B.S.config.users = A.S.config.users;
  A.S.config.users = [...(A.S.config.users || []), { email: 'ana@example.com', name: 'Ana', roleId: 'admin', overrides: {} }]; await A.st.saveConfig(); await A.st.idle(); await B.st.refresh();
  const [na, nb] = await Promise.all([A.st.runDateAutomationsShared({ jitter: 0, settle: 30 }), B.st.runDateAutomationsShared({ jitter: 0, settle: 30 })]);
  await A.st.idle(); await B.st.idle(); await A.st.refresh();
  assert.ok(B.st.can('editCells'), 'B can edit'); assert.equal(na + nb, 3, `ran A=${na} B=${nb}`);
  const cs = A.S.comments.filter(c => rows.some(r => r.id === c.rowId) && c.text === 'mañana'); assert.equal(cs.length, 3);
  // Una segunda vuelta no repite nada, y el candado queda libre.
  const again = await Promise.all([A.st.runDateAutomationsShared({ jitter: 0, settle: 10 }), B.st.runDateAutomationsShared({ jitter: 0, settle: 10 })]);
  assert.deepEqual(again, [0, 0]); await A.st.refresh(); assert.ok(!A.S.config.autoLease);
});
