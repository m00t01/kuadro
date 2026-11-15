// Mini ventana de captura rápida (se abre con el atajo global).
import { render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { t as tr } from './i18n.js';
const cap = window.capture;
function Capture() {
  const [ctx, setCtx] = useState({ tabs: [], def: '', project: '' }), [title, setTitle] = useState(''), [note, setNote] = useState(''), [tab, setTab] = useState(''), [more, setMore] = useState(false), [done, setDone] = useState(false);
  const inp = useRef();
  useEffect(() => cap.onShow(c => { setCtx(c); setTab(c.def || c.tabs[0] || ''); setTitle(''); setNote(''); setDone(false); setTimeout(() => inp.current && inp.current.focus(), 30); }), []);
  const save = () => { if (!title.trim()) return; cap.submit({ title: title.trim(), note: note.trim(), tab }); setDone(true); setTimeout(() => cap.close(), 650); };
  if (!ctx.tabs.length) return <div class="cap"><div class="cap-h"><img src="icon.png" /><b>{tr("Captura rápida")}</b></div><p class="muted">{tr("Abre un proyecto en Kuadro para poder guardar ideas desde aquí.")}</p><button class="btn" onClick={() => cap.close()}>{tr("Cerrar")}</button></div>;
  return <div class="cap" onKeyDown={e => { if (e.key === 'Escape') cap.close(); }}>
    <div class="cap-h"><img src="icon.png" /><b>{tr("Nueva idea")}</b><span class="muted sm">{ctx.project}</span></div>
    {done ? <div class="cap-ok">✓ {tr('Guardada en {x}', { x: tab })}</div> : <>
      <input ref={inp} class="cap-in" placeholder={tr("Escribe la idea y pulsa Enter…")} value={title} onInput={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Tab' && !more) { e.preventDefault(); setMore(true); } }} />
      {more && <textarea class="cap-note" rows="3" placeholder={tr("Notas (opcional)")} value={note} onInput={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); }} />}
      <div class="cap-f"><select value={tab} onChange={e => setTab(e.target.value)}>{ctx.tabs.map(t => <option>{t}</option>)}</select>{!more && <button class="mini" onClick={() => setMore(true)}>{tr("+ Notas")}</button>}<span class="sp" /><span class="muted sm">{tr("Enter guarda · Esc cierra")}</span><button class="btn primary" disabled={!title.trim()} onClick={save}>{tr("Guardar")}</button></div></>}
  </div>;
}
render(<Capture />, document.getElementById('root'));
