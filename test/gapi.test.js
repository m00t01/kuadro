import './setup-es.js';
import test from 'node:test'; import assert from 'node:assert/strict'; import { GoogleSheets } from '../src/gapi.js';
test('cliente de Google: URLs, cuerpos, reintentos y errores', async () => {
  const calls = []; let n = 0;
  const f = async (url, o) => { calls.push({ url, ...o }); n++; if (n === 1) return { ok: false, status: 429, statusText: '', json: async () => ({}) }; if (url.includes('NOPE')) return { ok: false, status: 403, statusText: 'Forbidden', json: async () => ({ error: { message: 'The caller does not have permission' } }) };
    if (url.includes(':append')) return { ok: true, status: 200, json: async () => ({ updates: { updatedRange: "'A b'!A5:C5" } }) }; if (url.includes('values:batchGet')) return { ok: true, status: 200, json: async () => ({ valueRanges: [{ values: [[1]] }, {}] }) }; return { ok: true, status: 200, json: async () => ({ replies: [{}], properties: { title: 'T' }, sheets: [{ properties: { sheetId: 5, title: 'A b', hidden: true, gridProperties: { columnCount: 9 } } }] }) }; };
  const g = new GoogleSheets('ID123', async () => 'tok', f); const realSet = globalThis.setTimeout; globalThis.setTimeout = (fn) => realSet(fn, 0);
  try {
    assert.deepEqual(await g.meta(), { title: 'T', sheets: [{ sheetId: 5, title: 'A b', hidden: true, columnCount: 9 }] }); assert.equal(calls.length, 2); assert.equal(calls[1].headers.Authorization, 'Bearer tok');
    assert.deepEqual(await g.batchGet(["'A b'", "'_app_config'!A:A"]), [[[1]], []]); const u = new URL(calls.at(-1).url);
    assert.equal(u.pathname, '/v4/spreadsheets/ID123/values:batchGet'); assert.deepEqual(u.searchParams.getAll('ranges'), ["'A b'", "'_app_config'!A:A"]); assert.equal(u.searchParams.get('valueRenderOption'), 'UNFORMATTED_VALUE'); assert.equal(u.searchParams.get('dateTimeRenderOption'), 'SERIAL_NUMBER');
    assert.deepEqual(await g.append("'A b'!A1", [['', 'x']], 'RAW'), { updatedRange: "'A b'!A5:C5" }); assert.match(calls.at(-1).url, /values\/'A%20b'!A1:append\?valueInputOption=RAW&insertDataOption=INSERT_ROWS$/); assert.equal(calls.at(-1).body, '{"values":[["","x"]]}');
    await g.batchUpdateValues([{ range: "'A b'!C3", values: [[true]] }], 'USER_ENTERED'); assert.equal(calls.at(-1).body, JSON.stringify({ valueInputOption: 'USER_ENTERED', data: [{ range: "'A b'!C3", values: [[true]] }] })); assert.equal(calls.at(-1).method, 'POST');
    await g.batchUpdate([{ deleteDimension: {} }]); assert.match(calls.at(-1).url, /ID123:batchUpdate$/);
    const bad = new GoogleSheets('NOPE', async () => 'tok', f); await assert.rejects(() => bad.meta(), e => e.status === 403 && /permiso/.test(e.message) && /permission/.test(e.detail));
    await g.uploadImage(new Uint8Array([1, 2, 3]), 'a.png', 'image/png', 'F1'); const up = calls.at(-2); assert.match(up.headers['Content-Type'], /^multipart\/related; boundary=/); const txt = new TextDecoder().decode(up.body); assert.ok(txt.includes('"parents":["F1"]') && txt.includes('Content-Type: image/png') && txt.trimEnd().endsWith('--'));
  } finally { globalThis.setTimeout = realSet; }
});
