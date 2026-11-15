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
