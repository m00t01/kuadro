// Bandeja de avisos: menciones, respuestas, asignaciones, cambios en tus elementos y avisos de automatizaciones.
import { Avatar, ago, who } from './shared.jsx';
import { t as tr } from './i18n.js';

export function inboxItems(st) {
  const S = st.S, me = (S.me.email || '').toLowerCase(), name = st.myName(), tc = S.config.settings.titleCol, out = [];
  const rowById = id => { for (const t of S.order) { const r = S.tabs[t].rows.find(x => x.id === id); if (r) return r; } return null; };
  const peopleCols = [...new Set(S.order.flatMap(t => S.tabs[t].header.filter(h => st.type(h) === 'person')))];
  const isMine = r => r && peopleCols.some(c => r.v[c] === name);
  const myComments = new Set(S.comments.filter(c => c.author.toLowerCase() === me).map(c => c.id));
  for (const c of S.comments) {
    if (c.deleted || c.author.toLowerCase() === me) continue; const r = rowById(c.rowId);
    const why = c.text.includes('@' + name) ? tr('te mencionó') : c.parent && myComments.has(c.parent) ? tr('respondió a tu comentario') : isMine(r) ? tr('comentó en tu elemento') : null;
    if (why) out.push({ at: c.at, who: c.name || c.author, text: why, detail: c.text, row: r, key: 'c' + c.id });
  }
  for (const h of S.history) {
    if (h.user.toLowerCase() === me) continue; const r = rowById(h.rowId);
    if (h.kind === 'notify' && h.col === name) out.push({ at: h.at, who: '⚡ ' + h.title, text: '', detail: h.after, row: r, key: 'h' + h.at + h.rowId });
    else if (h.kind === 'edit' && st.type(h.col) === 'person' && h.after === name) out.push({ at: h.at, who: who(st, h.user), text: tr('te asignó como {c}', { c: h.col.toLowerCase() }), detail: h.title, row: r, key: 'h' + h.at + h.rowId + h.col });
    else if (h.kind === 'edit' && isMine(r)) out.push({ at: h.at, who: who(st, h.user), text: tr('cambió {c}: {a} → {b}', { c: h.col, a: h.before || '—', b: h.after || '—' }), detail: h.title, row: r, key: 'h' + h.at + h.rowId + h.col });
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 80);
}
export function Inbox({ st, items, seen, open, onClose, onSeen }) {
  return <div class="inbox"><div class="ib-h"><b>{tr("Bandeja")}</b><span class="sp" /><button class="mini" onClick={onSeen}>{tr("Marcar todo como leído")}</button><button class="icon" onClick={onClose}>✕</button></div>
    <div class="ib-b">{items.map(i => <div class={'ib-i' + (Date.parse(i.at) > seen ? ' new' : '')} onClick={() => { if (i.row) { open(i.row); onClose(); } }}>
      <Avatar name={i.who.replace('⚡ ', '')} size={26} /><div class="grow"><div><b>{i.who}</b> {i.text}</div>{i.detail && <div class="muted sm ib-d">{i.detail}</div>}
        <div class="muted sm">{ago(i.at)}{i.row ? ' · ' + (i.row.v[st.S.config.settings.titleCol] || tr('Sin título')).slice(0, 50) : ''}</div></div></div>)}
      {!items.length && <p class="muted pad">{tr("Nada por aquí. Te avisaremos cuando te mencionen, te asignen algo o cambien tus elementos.")}</p>}</div></div>;
}
