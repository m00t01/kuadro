// Cliente real de Google Sheets y Drive (REST v4 / v3).
import { q } from './util.js';
import { t as tr } from './i18n.js';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets/';
// Mensajes de Google traducidos a algo entendible.
export function spanish(status, detail = '') {
  if (status === 401) return tr('Tu sesión de Google caducó. Vuelve a iniciar sesión.');
  if (status === 403) return /insufficient|scope/i.test(detail) ? tr('Kuadro no tiene permiso suficiente en tu cuenta de Google; cierra sesión y vuelve a entrar aceptando todos los permisos.') : tr('Tu cuenta de Google no tiene permiso para hacer esto en este Sheet.');
  if (status === 404) return tr('No se encontró el Sheet o la pestaña; puede que la hayan borrado o renombrado.');
  if (status === 429) return tr('Google recibió demasiadas solicitudes seguidas; espera unos segundos y vuelve a intentar.');
  if (status >= 500) return tr('Google tuvo un problema temporal; vuelve a intentar en un momento.');
  if (/protected/i.test(detail)) return tr('Esa parte del Sheet está protegida y no se puede editar.');
  if (/exceeds grid limits/i.test(detail)) return tr('El cambio se sale de los límites de la hoja.');
  if (/Unable to parse range/i.test(detail)) return tr('No se encontró una pestaña o columna del Sheet; quizá la renombraron. Sincroniza de nuevo.');
  return tr('Google rechazó el cambio (') + detail + ').';
}
export class GoogleSheets {
  constructor(id, getToken, f) { this.id = id; this.getToken = getToken; this.f = f || ((...a) => fetch(...a)); }
  // body: objeto (JSON) o { raw: Uint8Array, type } para subidas.
  async req(method, url, body) {
    for (let t = 0; ; t++) {
      let token;
      try { token = await this.getToken(t > 0 && this._401); }
      catch (err) { const e = new Error(tr('Tu sesión de Google caducó. Vuelve a iniciar sesión.')); e.auth = true; e.status = 401; throw e; }
      const raw = body && body.raw; let res;
      try { res = await this.f(url, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': raw ? body.type : 'application/json' } : {}) }, body: body ? (raw ? body.raw : JSON.stringify(body)) : undefined }); }
      catch (err) { if (t < 2) { await new Promise(r => setTimeout(r, 1500)); continue; } const e = new Error(tr('No hay conexión con Google. Revisa tu internet; tus cambios se volverán a intentar.')); e.status = 0; e.network = true; throw e; }
      if (res.ok) return res.status === 204 ? {} : res.json();
      this._401 = res.status === 401;
      if ((res.status === 401 || res.status === 429 || res.status >= 500) && t < 4) { await new Promise(r => setTimeout(r, res.status === 401 ? 50 : 800 * 2 ** t)); continue; }
      let detail = res.statusText; try { detail = (await res.json()).error.message || detail; } catch { }
      const e = new Error(spanish(res.status, detail)); e.status = res.status; e.detail = detail; if (res.status === 401) e.auth = true; throw e;
    }
  }
  async meta() {
    const d = await this.req('GET', `${BASE}${this.id}?fields=properties.title,sheets.properties`);
    return { title: d.properties.title, sheets: (d.sheets || []).map(s => ({ sheetId: s.properties.sheetId, title: s.properties.title, hidden: !!s.properties.hidden, columnCount: s.properties.gridProperties?.columnCount || 26 })) };
  }
  // Grupos de filas nativos de una pestaña (los corchetes de la izquierda en Google Sheets).
  async rowGroups(sheetId) {
    const d = await this.req('GET', `${BASE}${this.id}?fields=sheets(properties.sheetId,rowGroups)`);
    const sh = (d.sheets || []).find(s => s.properties.sheetId === sheetId) || {};
    return (sh.rowGroups || []).map(g => ({ start: g.range.startIndex || 0, end: g.range.endIndex, depth: g.depth || 1 }));
  }
  async batchGet(ranges) {
    if (!ranges.length) return [];
    const p = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' });
    ranges.forEach(r => p.append('ranges', r));
    const d = await this.req('GET', `${BASE}${this.id}/values:batchGet?${p}`);
    return (d.valueRanges || []).map(v => v.values || []);
  }
  batchUpdateValues(data, opt) { return this.req('POST', `${BASE}${this.id}/values:batchUpdate`, { valueInputOption: opt, data }); }
  async append(range, values, opt) {
    const d = await this.req('POST', `${BASE}${this.id}/values/${encodeURIComponent(range)}:append?valueInputOption=${opt}&insertDataOption=INSERT_ROWS`, { values });
    return { updatedRange: d.updates?.updatedRange };
  }
  async batchUpdate(requests) { return (await this.req('POST', `${BASE}${this.id}:batchUpdate`, { requests })).replies || []; }
  // Pistas de tipo por columna: validaciones (desplegables, casillas) y formato de fecha de las primeras filas.
  async colHints(tabs) {
    const o = {}; if (!tabs.length) return o;
    const p = new URLSearchParams({ fields: 'sheets(properties.title,data.rowData.values(formattedValue,effectiveFormat.numberFormat.type,dataValidation.condition))' });
    tabs.forEach(t => p.append('ranges', `${q(t)}!1:12`));
    const d = await this.req('GET', `${BASE}${this.id}?${p}`);
    for (const s of d.sheets || []) {
      const rows = s.data?.[0]?.rowData || []; const head = (rows[0]?.values || []).map(c => (c.formattedValue || '').trim()); const h = {};
      rows.slice(1).forEach(r => (r.values || []).forEach((c, i) => {
        const name = head[i]; if (!name || h[name]) return; const cond = c.dataValidation?.condition;
        if (cond?.type === 'BOOLEAN') h[name] = { checkbox: true };
        else if (cond?.type === 'ONE_OF_LIST') h[name] = { options: (cond.values || []).map(v => v.userEnteredValue).filter(Boolean) };
        else if (/^DATE/.test(c.effectiveFormat?.numberFormat?.type || '')) h[name] = { date: true };
      }));
      o[s.properties.title] = h;
    }
    return o;
  }
  // Drive: carpeta de imágenes y subida con enlace público de solo lectura.
  async ensureFolder(name) {
    const d = await this.req('POST', 'https://www.googleapis.com/drive/v3/files?fields=id', { name, mimeType: 'application/vnd.google-apps.folder' });
    return d.id;
  }
  async uploadImage(bytes, name, mime, folderId) {
    const B = 'hojabase' + Date.now(), te = new TextEncoder();
    const head = te.encode(`--${B}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: folderId ? [folderId] : undefined })}\r\n--${B}\r\nContent-Type: ${mime}\r\n\r\n`), tail = te.encode(`\r\n--${B}--`);
    const raw = new Uint8Array(head.length + bytes.length + tail.length); raw.set(head, 0); raw.set(bytes, head.length); raw.set(tail, head.length + bytes.length);
    const d = await this.req('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { raw, type: 'multipart/related; boundary=' + B });
    await this.req('POST', `https://www.googleapis.com/drive/v3/files/${d.id}/permissions`, { role: 'reader', type: 'anyone' });
    return `https://drive.google.com/file/d/${d.id}/view`;
  }
}
