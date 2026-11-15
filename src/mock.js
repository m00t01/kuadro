// Simulador en memoria de la API de Google Sheets: modo demo y pruebas.
import { colI, colL, isISO, isoToSerial, q } from './util.js';
export class MockSheets {
  constructor(data, persist) { this.d = data; this.persist = persist; this.calls = []; }
  save() { this.persist && this.persist(this.d); }
  sheet(t) { const s = this.d.sheets.find(s => s.title === t); if (!s) { const e = new Error('Unable to parse range: ' + t); e.status = 400; throw e; } return s; }
  parse(range) {
    let m = range.match(/^'((?:[^']|'')*)'(?:!(.*))?$/) || range.match(/^([^!]+)(?:!(.*))?$/);
    const s = this.sheet(m[1].replace(/''/g, "'")); const a = m[2];
    if (!a) return { s, r0: 0, c0: 0, r1: Infinity, c1: Infinity };
    const p = a.match(/^([A-Z]*)(\d*)(?::([A-Z]*)(\d*))?$/);
    const c0 = p[1] ? colI(p[1]) : 0, r0 = p[2] ? +p[2] - 1 : 0;
    if (a.indexOf(':') < 0) return { s, r0, c0, r1: r0, c1: c0, single: true };
    return { s, r0, c0, r1: p[4] ? +p[4] - 1 : Infinity, c1: p[3] ? colI(p[3]) : Infinity };
  }
  val(c, r) { if (c && typeof c === 'object') return c.f === '=ROW()-1' ? r : '#N/A'; return c ?? ''; }
  async meta() { this.calls.push('meta'); return { title: this.d.title, sheets: this.d.sheets.map(s => ({ sheetId: s.sheetId, title: s.title, hidden: !!s.hidden, columnCount: s.cols || 26 })) }; }
  async batchGet(ranges) {
    this.calls.push('batchGet');
    return ranges.map(rg => {
      const { s, r0, c0, r1, c1 } = this.parse(rg); const out = [];
      for (let r = r0; r <= Math.min(r1, s.rows.length - 1); r++) {
        const row = []; const src = s.rows[r] || [];
        for (let c = c0; c <= Math.min(c1, src.length - 1); c++) row.push(this.val(src[c], r));
        while (row.length && row[row.length - 1] === '') row.pop(); out.push(row);
      }
      while (out.length && !out[out.length - 1].length) out.pop();
      return out;
    });
  }
  conv(v, opt) {
    if (v == null) return undefined;
    if (opt !== 'USER_ENTERED' || typeof v !== 'string') return v;
    if (v.startsWith('=')) return { f: v }; if (v.startsWith("'")) return v.slice(1);
    if (isISO(v)) return isoToSerial(v); if (v !== '' && !isNaN(v)) return +v;
    if (v === 'TRUE') return true; if (v === 'FALSE') return false; return v;
  }
  put(s, r, c, v, opt) { const x = this.conv(v, opt); if (x === undefined) return; if (c >= (s.cols || 26)) { const e = new Error('Range exceeds grid limits'); e.status = 400; throw e; } while (s.rows.length <= r) s.rows.push([]); const row = s.rows[r]; while (row.length <= c) row.push(''); row[c] = x; }
  async batchUpdateValues(data, opt) {
    this.calls.push('write'); if (this.readOnly) { const e = new Error('The caller does not have permission'); e.status = 403; throw e; }
    for (const { range, values } of data) { const { s, r0, c0 } = this.parse(range); values.forEach((row, i) => row.forEach((v, j) => this.put(s, r0 + i, c0 + j, v, opt))); }
    this.save();
  }
  async append(range, values, opt) {
    this.calls.push('append'); if (this.readOnly) { const e = new Error('The caller does not have permission'); e.status = 403; throw e; }
    const { s } = this.parse(range); let last = -1;
    s.rows.forEach((row, i) => { if (row.some(c => c !== '' && c != null)) last = i; });
    const at = last + 1; s.rows.splice(at, 0, ...values.map(() => []));
    values.forEach((row, i) => row.forEach((v, j) => this.put(s, at + i, j, v, opt)));
    this.save(); return { updatedRange: `${q(s.title)}!A${at + 1}:${colL(Math.max(0, values[0].length - 1))}${at + values.length}` };
  }
  async batchUpdate(requests) {
    this.calls.push('batchUpdate'); if (this.readOnly) { const e = new Error('The caller does not have permission'); e.status = 403; throw e; }
    const byId = id => this.d.sheets.find(s => s.sheetId === id); const replies = [];
    for (const rq of requests) {
      if (rq.addSheet) { const p = rq.addSheet.properties; const sheetId = Math.max(0, ...this.d.sheets.map(s => s.sheetId)) + 1; this.d.sheets.push({ sheetId, title: p.title, hidden: !!p.hidden, rows: [], cols: p.gridProperties?.columnCount || 26 }); replies.push({ addSheet: { properties: { sheetId, title: p.title } } }); continue; }
      if (rq.deleteDimension) { const g = rq.deleteDimension.range, s = byId(g.sheetId); if (g.dimension === 'ROWS') s.rows.splice(g.startIndex, g.endIndex - g.startIndex); else { s.rows.forEach(r => r.splice(g.startIndex, g.endIndex - g.startIndex)); s.cols = (s.cols || 26) - (g.endIndex - g.startIndex); } }
      if (rq.moveDimension && rq.moveDimension.source.dimension === 'ROWS') { const m = rq.moveDimension, s = byId(m.source.sheetId), n = m.source.endIndex - m.source.startIndex; const blk = s.rows.splice(m.source.startIndex, n); let d = m.destinationIndex; if (d > m.source.startIndex) d -= n; s.rows.splice(d, 0, ...blk); }
      if (rq.appendDimension && rq.appendDimension.dimension === 'COLUMNS') { const s = byId(rq.appendDimension.sheetId); s.cols = (s.cols || 26) + rq.appendDimension.length; }
      replies.push({});
    }
    this.save(); return replies;
  }
  async colHints(tabs) { const o = {}; for (const t of tabs) o[t] = this.sheet(t).hints || {}; return o; }
}
