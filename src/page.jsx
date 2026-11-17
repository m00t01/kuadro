// Página de cada elemento: portada, ícono, propiedades, vista previa de YouTube, guion, comentarios en hilo, historial y presencia.
import { useState, useEffect, useRef } from 'preact/hooks';
import { Field, Pop, Chip, colorOf, RichEditor } from './ui.jsx';
import { ICON, when, ago, who, Avatar } from './shared.jsx';
import { urls, ytId, imgSrc, fmtDate } from './util.js';
import { t as tr, LOCALE } from './i18n.js';

export const GRADS = { sunset: 'linear-gradient(120deg,#ff7e5f,#feb47b)', ocean: 'linear-gradient(120deg,#2193b0,#6dd5ed)', grape: 'linear-gradient(120deg,#6a3093,#a044ff)', forest: 'linear-gradient(120deg,#134e5e,#71b280)', fire: 'linear-gradient(120deg,#f12711,#f5af19)', night: 'linear-gradient(120deg,#0f2027,#2c5364)', candy: 'linear-gradient(120deg,#d53369,#daae51)', mint: 'linear-gradient(120deg,#11998e,#38ef7d)' };
const EMOJIS = '🎬 🎥 📹 🎮 🕹️ 👾 🧠 💡 🔥 ⭐ 🚀 🎯 📌 📝 ✏️ 🎨 🖼️ 🧪 🧩 🏆 💰 🤑 😂 🤣 😱 😈 💀 👻 🤖 🐒 🐔 🥚 🍕 🎃 🧟 🦖 ⚔️ 🛡️ 🏃 🌋 🌈 ❄️ ⚡ 💣 🧨 🎉 ❤️ ✅ ❗'.split(' ');
export const coverCss = c => !c ? null : c.startsWith('grad:') ? { background: GRADS[c.slice(5)] || GRADS.sunset } : { backgroundImage: `url("${imgSrc(c)}")` };

export function HistList({ st, list }) {
  return <div class="hist">{list.map(h => <div class="hrow"><span class="muted sm">{when(h.at)} · {who(st, h.user)}</span>
    <span>{h.kind === 'edit' ? <span><b>{h.col}</b>: {h.before || '—'} → {h.after || '—'}</span> : h.kind === 'create' ? tr('Creó el elemento') : h.kind === 'move' ? <span>{tr('Movió de')} <b>{h.before}</b> {tr('a')} <b>{h.after}</b></span> : h.kind === 'notify' ? <span>{tr("⚡ Aviso a")}{' '}<b>{h.col}</b>: {h.after}</span>
      : h.kind === 'tabdel' ? <span>{tr('Eliminó la pestaña')} <b>{h.before}</b> <span class="muted">({tr('{n} elementos', { n: h.after || 0 })})</span></span>
      : h.kind === 'tabadd' ? <span>{tr('Creó la pestaña')} <b>{h.after}</b></span>
      : h.kind === 'tabren' ? <span>{tr('Renombró la pestaña')} <b>{h.before}</b> {tr('a')} <b>{h.after}</b></span>
      : h.kind === 'tabrestore' ? <span>{tr('Restauró la pestaña')} <b>{h.after}</b></span>
      : tr('Eliminó el elemento')}{h.title && !h.kind.startsWith('tab') && <span class="muted"> · {h.title.slice(0, 50)}</span>}</span>
    {st.can('undo') && h.kind !== 'notify' && (st.undoable(h) ? <button class={'mini' + (h.kind === 'delete' || h.kind === 'tabdel' ? ' restore' : '')} onClick={() => st.undo(h)}>{h.kind === 'delete' || h.kind === 'tabdel' ? tr("Restaurar") : tr("Deshacer")}</button> : (h.kind === 'delete' || h.kind === 'tabdel') && <span class="muted sm">{tr("Restaurado")}</span>)}</div>)}{!list.length && <p class="muted">{tr("Sin cambios registrados.")}</p>}</div>;
}

const ytCache = new Map();
function References({ st, row }) {
  const S = st.S, s = S.config.settings, [, tick] = useState(0);
  const list = [...new Set(Object.keys(row.v).filter(c => st.type(c) === 'url').flatMap(c => urls(row.v[c])).filter(ytId))].slice(0, 3);
  useEffect(() => { list.forEach(u => { if (ytCache.has(u)) return; ytCache.set(u, {}); st.ui.yt(u, s.ytKey).then(d => { ytCache.set(u, d || {}); tick(x => x + 1); }); }); }, [list.join()]);
  if (!list.length) return null;
  return <div class="yt"><h4 class="sec0">{tr("Referencias")}</h4>{list.map(u => { const d = ytCache.get(u) || {}; return <div class="ytc"><img src={`https://i.ytimg.com/vi/${ytId(u)}/mqdefault.jpg`} onClick={() => st.ui.open(u)} /><div><div class="card-t">{d.title || tr('Video de YouTube')}</div>
    <div class="muted sm">{d.author || ''}{d.views != null ? ' · ' + tr('{n} vistas', { n: Number(d.views).toLocaleString(LOCALE) }) : ''}</div>
    <div class="ytb">{d.title && st.canEditCol(s.titleCol) && !row.v[s.titleCol] && <button class="mini" onClick={() => st.setCell(row.tab, row.id, s.titleCol, d.title)}>{tr("Usar como título")}</button>}
      {s.imageCol && st.canEditCol(s.imageCol) && !row.v[s.imageCol] && <button class="mini" onClick={() => st.setCell(row.tab, row.id, s.imageCol, u)}>{tr("Usar su miniatura")}</button>}</div></div></div>; })}</div>;
}

// Vista previa como se vería en YouTube (portada, celular, búsqueda) + comparar variantes de título y miniatura.
// Íconos simples (trazos) para los botones del reproductor de Shorts.
const SI = {
  like: 'M7 10v11H3V10h4zm2 11h8.3a2 2 0 0 0 2-1.6l1.3-7A2 2 0 0 0 18.6 10H14l.7-3.6A2 2 0 0 0 12.8 4L9 10v11z',
  dislike: 'M17 14V3h4v11h-4zm-2-11H6.7a2 2 0 0 0-2 1.6l-1.3 7A2 2 0 0 0 5.4 14H10l-.7 3.6a2 2 0 0 0 1.9 2.4L15 14V3z',
  comment: 'M4 4h16v12H8l-4 4V4z', share: 'M14 5l7 7-7 7v-4c-5 0-8 1.5-10 5 1-5 4-9 10-10V5z', remix: 'M4 7h11l-3-3m3 3-3 3M20 17H9l3 3m-3-3 3-3',
};
const Ico = ({ d }) => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d={d} /></svg>;
// Shorts: tarjeta vertical del estante de la portada y el reproductor a pantalla completa.
function YTShorts({ title, thumb, channel }) {
  const img = thumb ? <img src={thumb} /> : <div class="yp-noimg">{tr("Sin miniatura")}</div>, handle = '@' + String(channel).replace(/\s+/g, '');
  return <div class="ys-wrap">
    <div class="ys-col"><div class="ys-lab">{tr("Estante de Shorts")}</div>
      <div class="ys-shelf"><div class="ys-th">{img}</div><div class="ys-t">{title || tr('Sin título')}</div><div class="yp-st">{tr("0 vistas")}</div></div></div>
    <div class="ys-col"><div class="ys-lab">{tr("Reproductor")}</div>
      <div class="ys-player"><div class="ys-bg">{img}</div><div class="ys-shade" />
        <div class="ys-side">{[['like', tr('Me gusta')], ['dislike', tr('No me gusta')], ['comment', '0'], ['share', tr('Compartir')], ['remix', 'Remix']].map(([k, l]) => <div class="ys-btn"><span class="ys-ic"><Ico d={SI[k]} /></span><span>{l}</span></div>)}
          <div class="ys-disc"><Avatar name={channel} size={30} /></div></div>
        <div class="ys-bottom"><div class="ys-ch"><Avatar name={channel} size={30} /><b>{handle}</b><span class="ys-sub">{tr("Suscribirme")}</span></div>
          <div class="ys-title">{title || tr('Sin título')}</div></div></div></div>
  </div>;
}
function YTCard({ mode, title, thumb, channel }) {
  if (mode === 'shorts') return <YTShorts title={title} thumb={thumb} channel={channel} />;
  const img = thumb ? <img src={thumb} /> : <div class="yp-noimg">{tr("Sin miniatura")}</div>;
  const meta = <><div class="yp-ch">{channel}</div><div class="yp-st">{tr("0 vistas · hace un momento")}</div></>;
  if (mode === 'search') return <div class="yp search"><div class="yp-th">{img}<span class="yp-dur">10:00</span></div><div class="yp-info"><div class="yp-t">{title || tr('Sin título')}</div><div class="yp-st">{tr("0 vistas · hace un momento")}</div><div class="yp-ch"><Avatar name={channel} size={20} />{channel}</div></div></div>;
  return <div class={'yp ' + mode}><div class="yp-th">{img}<span class="yp-dur">10:00</span></div><div class="yp-row"><Avatar name={channel} size={mode === 'mobile' ? 30 : 36} /><div><div class="yp-t">{title || tr('Sin título')}</div>{meta}</div></div></div>;
}
function YTPreview({ st, row, meta, setMeta }) {
  const S = st.S, s = S.config.settings, [mode, setMode] = useState(/short/i.test(row.tab || '') ? 'shorts' : 'home'), [cmp, setCmp] = useState(false);
  const canal = Object.keys(row.v).find(c => /^(canal|channel)$/i.test(c)); const channel = (canal && row.v[canal]) || S.title || tr('Tu canal');
  const title = row.v[s.titleCol] || '', thumb = s.imageCol ? imgSrc(row.v[s.imageCol]) : '', n = [...title].length;
  const variants = meta.variants || [], canEd = st.canEditCol(s.titleCol);
  // Minimizado o abierto: se recuerda en esta computadora para todas las páginas.
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('yt-preview-open') !== '0'; } catch { return true; } });
  const toggle = () => { const v = !open; setOpen(v); try { localStorage.setItem('yt-preview-open', v ? '1' : '0'); } catch { } };
  const setV = (i, p) => setMeta({ variants: variants.map((v, j) => j === i ? { ...v, ...p } : v) });
  const useV = i => { const v = variants[i]; const rest = variants.filter((_, j) => j !== i); setMeta({ variants: [...rest, { title, thumb: row.v[s.imageCol] || '' }] }); if (v.title) st.setCell(row.tab, row.id, s.titleCol, v.title); if (s.imageCol && v.thumb && st.canEditCol(s.imageCol)) st.setCell(row.tab, row.id, s.imageCol, v.thumb); };
  if (!open) return <div class="ytprev closed"><div class="yp-h yp-toggle" onClick={toggle} title={tr("Mostrar")}><span class="yp-chev">▸</span><h4 class="sec0">{tr("Vista previa en YouTube")}</h4><span class="sp" /><span class="muted sm">{tr('{n}/100 caracteres', { n })}</span></div></div>;
  return <div class="ytprev"><div class="yp-h"><span class="yp-toggle" onClick={toggle} title={tr("Minimizar")}><span class="yp-chev">▾</span><h4 class="sec0">{tr("Vista previa en YouTube")}</h4></span><span class="sp" />
    <div class="seg sm-seg">{[['home', tr('Portada')], ['mobile', tr('Celular')], ['search', tr('Búsqueda')], ['shorts', 'Shorts']].map(([k, l]) => <button class={mode === k && !cmp ? 'on' : ''} onClick={() => { setMode(k); setCmp(false); }}>{l}</button>)}<button class={cmp ? 'on' : ''} onClick={() => setCmp(true)}>{tr('Comparar')} ({variants.length + 1})</button></div></div>
    <div class={'yp-count' + (n > 100 ? ' bad' : n > (mode === 'shorts' && !cmp ? 40 : 70) ? ' warn' : '')}>{tr('{n}/100 caracteres', { n })}{n > 100 ? tr(' · YouTube no permite más de 100') : mode === 'shorts' && !cmp ? (n > 40 ? tr(' · en el estante de Shorts se corta alrededor del carácter 40') : tr(' · se lee completo')) + tr(' · la miniatura se recorta al centro en vertical (9:16)') : n > 70 ? tr(' · en la portada se corta alrededor del carácter 70') : n > 55 ? tr(' · en celular puede cortarse') : tr(' · se lee completo')}</div>
    {!cmp && <div class="yp-stage"><YTCard mode={mode} title={title} thumb={thumb} channel={channel} /></div>}
    {cmp && <div class="yp-cmp"><div class="yp-var cur"><div class="yp-lab">{tr("Actual")}</div><YTCard mode="home" title={title} thumb={thumb} channel={channel} /></div>
      {variants.map((v, i) => <div class="yp-var"><div class="yp-lab">{tr('Variante {n}', { n: i + 1 })}<span class="sp" />{canEd && <button class="mini" onClick={() => useV(i)}>{tr("Usar esta")}</button>}<button class="icon" title={tr("Quitar")} onClick={() => setMeta({ variants: variants.filter((_, j) => j !== i) })}>✕</button></div>
        <YTCard mode="home" title={v.title} thumb={imgSrc(v.thumb)} channel={channel} />
        <input placeholder={tr("Título alternativo")} value={v.title} onInput={e => setV(i, { title: e.target.value })} />
        <div class="lrow0"><input placeholder={tr("Enlace de miniatura alternativa")} value={v.thumb} onInput={e => setV(i, { thumb: e.target.value })} />{st.ui.canUpload && <button class="mini" onClick={async () => { const u = await st.ui.uploadPick(); if (u) setV(i, { thumb: u }); }}>{tr("Subir")}</button>}</div></div>)}
      {variants.length < 3 && <button class="yp-add" onClick={() => setMeta({ variants: [...variants, { title, thumb: '' }] })}>{tr("＋ Agregar variante")}</button>}</div>}
  </div>;
}

function MentionInput({ st, value, setValue, onSubmit, placeholder, autoFocus }) {
  const [m, setM] = useState(null), ref = useRef();
  const users = st.S.config.users.map(u => u.name).filter(Boolean);
  const upd = v => { setValue(v); const cur = ref.current ? ref.current.selectionStart : v.length; const mm = v.slice(0, cur).match(/@([\wáéíóúñ]*)$/i); setM(mm ? { q: mm[1].toLowerCase(), at: cur - mm[1].length - 1, hi: 0 } : null); };
  const list = m ? users.filter(u => u.toLowerCase().includes(m.q)).slice(0, 6) : [];
  const pick = u => { const cur = ref.current.selectionStart; const v = value.slice(0, m.at) + '@' + u + ' ' + value.slice(cur); setValue(v); setM(null); requestAnimationFrame(() => { ref.current.focus(); const p = m.at + u.length + 2; ref.current.setSelectionRange(p, p); }); };
  useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, []);
  return <div class="mention"><textarea ref={ref} rows={Math.min(5, Math.max(1, value.split('\n').length))} placeholder={placeholder} value={value} onInput={e => upd(e.target.value)}
    onKeyDown={e => { e.stopPropagation(); if (m && list.length) { if (e.key === 'ArrowDown') { e.preventDefault(); setM({ ...m, hi: Math.min(m.hi + 1, list.length - 1) }); return; } if (e.key === 'ArrowUp') { e.preventDefault(); setM({ ...m, hi: Math.max(m.hi - 1, 0) }); return; } if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(list[m.hi]); return; } if (e.key === 'Escape') { setM(null); return; } }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }} />
    {m && list.length > 0 && <div class="mlist">{list.map((u, i) => <div class={'pop-i' + (i === m.hi ? ' hi' : '')} onMouseDown={e => { e.preventDefault(); pick(u); }}><span class="pchip"><Avatar name={u} size={18} />{u}</span></div>)}</div>}</div>;
}
const renderText = t => String(t).split(/(@[\wáéíóúñ]+(?: [A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/).map((p, i) => i % 2 ? <span class="ment">{p}</span> : p);
function Comments({ st, row }) {
  const S = st.S, [msg, setMsg] = useState(''), [reply, setReply] = useState(null), [rmsg, setRmsg] = useState(''), [edit, setEdit] = useState(null), [emsg, setEmsg] = useState('');
  const all = S.comments.filter(c => c.rowId === row.id), top = all.filter(c => !c.parent), kids = id => all.filter(c => c.parent === id);
  const mine = c => c.author.toLowerCase() === (S.me.email || '').toLowerCase() || st.can('admin');
  const one = (c, isReply) => <div class={'cmt' + (isReply ? ' reply' : '')}>
    <div class="cmt-h"><Avatar name={c.name || c.author} size={22} /><b>{c.name || c.author}</b><span class="muted sm">{ago(c.at)}{c.edited ? tr(' · editado') : ''}</span><span class="sp" />
      {!c.deleted && !isReply && st.can('comment') && <button class="mini" onClick={() => { setReply(c.id); setRmsg(''); }}>{tr("Responder")}</button>}
      {!c.deleted && mine(c) && <button class="mini" onClick={() => { setEdit(c.id); setEmsg(c.text); }}>{tr("Editar")}</button>}
      {!c.deleted && mine(c) && <button class="mini" onClick={() => { if (confirm(tr('¿Borrar este comentario?'))) st.deleteComment(c.id); }}>{tr("Borrar")}</button>}</div>
    {edit === c.id ? <div class="askbar"><MentionInput st={st} value={emsg} setValue={setEmsg} autoFocus onSubmit={() => { st.editComment(c.id, emsg); setEdit(null); }} /><button class="btn" onClick={() => { st.editComment(c.id, emsg); setEdit(null); }}>{tr("Guardar")}</button><button class="btn" onClick={() => setEdit(null)}>{tr("Cancelar")}</button></div>
      : <div class="cmt-b">{c.deleted ? <i class="muted">{tr("Comentario borrado")}</i> : renderText(c.text)}</div>}
    {!isReply && kids(c.id).map(k => one(k, true))}
    {reply === c.id && <div class="askbar reply"><MentionInput st={st} value={rmsg} setValue={setRmsg} autoFocus placeholder={tr("Escribe una respuesta…")} onSubmit={() => { st.addComment(row.id, rmsg, c.id); setReply(null); }} /><button class="btn" onClick={() => { st.addComment(row.id, rmsg, c.id); setReply(null); }}>{tr("Responder")}</button></div>}
  </div>;
  const send = () => { st.addComment(row.id, msg); setMsg(''); };
  return <div><h4 class="sec">{tr('Comentarios')}{all.length ? ` (${all.filter(c => !c.deleted).length})` : ''}</h4>{top.map(c => one(c, false))}
    {st.can('comment') && !row.tmp && <div class="askbar"><MentionInput st={st} value={msg} setValue={setMsg} onSubmit={send} placeholder={tr("Escribe un comentario… usa @ para mencionar a alguien (Shift+Enter: nueva línea)")} /><button class="btn" onClick={send}>{tr("Enviar")}</button></div>}</div>;
}

export function RowPage({ st, row, onClose, dup, onMoved }) {
  const S = st.S, s = S.config.settings, tc = s.titleCol, [full, setFull] = useState(false), [title, setTitle] = useState(row.v[tc] || ''), [iconPop, setIconPop] = useState(false), [coverPop, setCoverPop] = useState(false), [emo, setEmo] = useState('');
  const focus = useRef(false), ta = useRef(), iconRef = useRef(), coverRef = useRef();
  const meta = S.pageMeta[row.id] || {}, setMeta = p => st.setPageMeta(row.id, p), canMeta = st.can('editPages') && !row.tmp;
  useEffect(() => { if (!focus.current) setTitle(row.v[tc] || ''); }, [row.v[tc], row.id]);
  useEffect(() => { const t = ta.current; if (t) { t.style.height = '0'; t.style.height = t.scrollHeight + 'px'; } }, [title, full]);
  useEffect(() => { if (row.tmp) return; st.setPresence(row.id); const iv = setInterval(() => st.setPresence(row.id), 20000); return () => { clearInterval(iv); st.setPresence(''); }; }, [row.id]);
  const here = S.presence.filter(p => p.rowId === row.id), merged = S.merged[row.id], recentMerge = merged && Date.now() - merged.at < 10000;
  const cols = S.tabs[row.tab].header.filter(h => h && h !== 'ID' && h !== tc && !st.hiddenCols().includes(h));
  const hist = S.history.filter(h => h.rowId === row.id).reverse().slice(0, 30);
  const others = S.order.filter(t => t !== row.tab && !st.hiddenTabs().includes(t) && S.tabs[t].idCol >= 0);
  const thumb = s.imageCol && row.v[s.imageCol];
  return <aside class={'page' + (full ? ' full' : '')}><div class="page-h">{st.can('moveTabs') && !row.tmp && others.length ? <select class="tabsel" value="" title={tr("Mover a otra pestaña")} onChange={e => { const to = e.target.value; if (to) { st.moveRow(row.tab, row.id, to); onMoved(to); } }}><option value="">{row.tab}</option>{others.map(t => <option value={t}>{tr('Mover a')} {t}</option>)}</select> : <span class="muted">{row.tab}</span>}
    <span class="sp" />{here.length > 0 && <span class="here-h">{here.map(p => <Avatar name={p.name} size={24} title={tr('{x} también tiene abierta esta página', { x: p.name })} />)}<span class="muted sm">{here.length === 1 ? tr('{x} también está aquí', { x: here[0].name }) : tr('{n} personas aquí', { n: here.length })}</span></span>}
    {st.can('deleteRows') && !row.tmp && <button class="icon" title={tr("Eliminar")} onClick={() => { if (confirm(tr('¿Eliminar este elemento del Sheet?'))) { st.deleteRow(row.tab, row.id); onClose(); } }}>🗑</button>}
    <button class="icon" title={full ? tr('Vista lateral') : tr('Pantalla completa')} onClick={() => setFull(!full)}>⤢</button><button class="icon" title={tr("Cerrar (Esc)")} onClick={onClose}>✕</button></div>
    <div class="page-b">
      {meta.cover && <div class="cover" style={coverCss(meta.cover)}>{canMeta && <button class="btn cover-btn" ref={coverRef} onClick={() => setCoverPop(true)}>{tr("Cambiar portada")}</button>}</div>}
      <div class={'page-in' + (meta.cover ? ' has-cover' : '')}>
        {meta.icon && <button class="page-icon" ref={iconRef} onClick={() => canMeta && setIconPop(true)} title={tr("Cambiar ícono")}>{meta.icon}</button>}
        {canMeta && <div class="page-add">{!meta.icon && <button class="mini ghost" ref={iconRef} onClick={() => setIconPop(true)}>{tr("☺ Agregar ícono")}</button>}{!meta.cover && <button class="mini ghost" ref={coverRef} onClick={() => setCoverPop(true)}>{tr("▭ Agregar portada")}</button>}</div>}
        <textarea ref={ta} class="ptitle" rows="1" placeholder={tr("Sin título")} value={title} readOnly={!st.canEditCol(tc) || row.tmp} onInput={e => setTitle(e.target.value)} onFocus={() => focus.current = true}
          onBlur={() => { focus.current = false; if (title !== (row.v[tc] || '')) st.setCell(row.tab, row.id, tc, title.replace(/\s*\n\s*/g, ' ')); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }} />
        {dup && <div class="warn">{tr("Hay otro elemento con este mismo título.")}</div>}
        {row.tmp && <div class="warn">{tr("Esta fila aún no tiene ID en el Sheet, así que es de solo lectura.")}</div>}
        <div class="props">{cols.map(c => <div class="prop"><div class="pl"><span class="tyi">{ICON[st.type(c)]}</span>{c}</div><div class="pv"><Field st={st} row={row} col={c} big /></div></div>)}</div>
        <References st={st} row={row} />
        {recentMerge && <div class="info">↻ {tr('Se combinaron tus cambios con los de {x}', { x: who(st, merged.by) })}{merged.clean ? '.' : tr('; revisa el texto, había cambios en el mismo párrafo.')}</div>}
        <h4 class="sec">{tr("Guion y notas")}</h4>
        <RichEditor key={row.id} value={(S.pages[row.id] || {}).md || ''} version={merged && merged.at} editable={st.can('editPages') && !row.tmp} onChange={md => st.savePage(row.id, md)} onImage={st.ui.canUpload && st.can('upload') ? f => st.ui.uploadFile(f) : null} />
        <YTPreview st={st} row={row} meta={meta} setMeta={p => canMeta && setMeta(p)} />
        <Comments st={st} row={row} />
        {st.can('viewHistory') && <div><h4 class="sec">{tr("Historial")}</h4><HistList st={st} list={hist} /></div>}
      </div></div>
    {iconPop && iconRef.current && <Pop anchor={iconRef.current} width={320} onClose={() => setIconPop(false)}><div class="emoji-grid">{EMOJIS.map(e => <button onClick={() => { setMeta({ icon: e }); setIconPop(false); }}>{e}</button>)}</div>
      <div class="lrow0"><input placeholder={tr("O pega cualquier emoji")} value={emo} onInput={e => setEmo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && emo.trim()) { setMeta({ icon: [...emo.trim()].slice(0, 2).join('') }); setIconPop(false); setEmo(''); } }} />{meta.icon && <button class="mini" onClick={() => { setMeta({ icon: '' }); setIconPop(false); }}>{tr("Quitar")}</button>}</div></Pop>}
    {coverPop && coverRef.current && <Pop anchor={coverRef.current} width={340} onClose={() => setCoverPop(false)}><div class="grad-grid">{Object.entries(GRADS).map(([k, g]) => <button style={{ background: g }} title={k} onClick={() => { setMeta({ cover: 'grad:' + k }); setCoverPop(false); }} />)}</div>
      {thumb && <div class="pop-i" onClick={() => { setMeta({ cover: urls(thumb)[0] || thumb }); setCoverPop(false); }}>{tr("Usar la miniatura del video")}</div>}
      {st.ui.canUpload && <div class="pop-i" onClick={async () => { setCoverPop(false); const u = await st.ui.uploadPick(); if (u) setMeta({ cover: u }); }}>{tr("Subir imagen…")}</div>}
      <div class="lrow0"><input placeholder={tr("O pega el enlace de una imagen")} onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { setMeta({ cover: e.target.value.trim() }); setCoverPop(false); } }} /></div>
      {meta.cover && <div class="pop-i muted" onClick={() => { setMeta({ cover: '' }); setCoverPop(false); }}>{tr("Quitar portada")}</div>}</Pop>}
  </aside>;
}
