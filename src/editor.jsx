// Editor visual de páginas: se escribe con formato a la vista y se guarda como markdown (con HTML para bloques especiales).
import { useState, useEffect, useRef } from 'preact/hooks';
import { Editor as TipTap, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Ic } from './shared.jsx';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Markdown } from 'tiptap-markdown';
import { imgSrc } from './util.js';
import { t as tr } from './i18n.js';

// Bloque destacado con emoji (💡 nota, ⚠️ aviso…).
const Callout = Node.create({
  name: 'callout', group: 'block', content: 'block+', defining: true,
  addAttributes() { return { emoji: { default: '💡', parseHTML: el => el.getAttribute('data-callout') || '💡', renderHTML: a => ({ 'data-callout': a.emoji }) } }; },
  parseHTML() { return [{ tag: 'div[data-callout]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { class: 'callout' }), 0]; },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div'); dom.className = 'callout'; const em = document.createElement('button'); em.className = 'co-em'; em.contentEditable = 'false'; em.textContent = node.attrs.emoji; em.title = tr('Cambiar ícono');
      const EM = ['💡', '⚠️', '✅', '❗', '📌', '🎬', '🔥', '💬', 'ℹ️'];
      em.onmousedown = e => { e.preventDefault(); if (!editor.isEditable) return; const next = EM[(EM.indexOf(node.attrs.emoji) + 1) % EM.length]; editor.view.dispatch(editor.view.state.tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, emoji: next })); };
      const c = document.createElement('div'); c.className = 'co-c'; dom.append(em, c);
      return { dom, contentDOM: c, update: n => { if (n.type.name !== 'callout') return false; node = n; em.textContent = n.attrs.emoji; return true; } };
    };
  },
});
// Bloque desplegable: la primera línea es el título; el resto se oculta al plegar.
const Toggle = Node.create({
  name: 'toggle', group: 'block', content: 'paragraph block*', defining: true,
  addAttributes() { return { open: { default: true, parseHTML: el => el.getAttribute('data-toggle') !== 'closed', renderHTML: a => ({ 'data-toggle': a.open ? 'open' : 'closed' }) } }; },
  parseHTML() { return [{ tag: 'div[data-toggle]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { class: 'toggle' }), 0]; },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div'); dom.className = 'toggle'; dom.dataset.toggle = node.attrs.open ? 'open' : 'closed';
      const b = document.createElement('button'); b.className = 'tg-btn'; b.contentEditable = 'false'; b.textContent = '▸';
      b.onmousedown = e => { e.preventDefault(); const tr = editor.view.state.tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, open: !node.attrs.open }); if (!editor.isEditable) { dom.dataset.toggle = node.attrs.open ? 'closed' : 'open'; node = node.type.create({ ...node.attrs, open: !node.attrs.open }, node.content); return; } editor.view.dispatch(tr); };
      const c = document.createElement('div'); c.className = 'tg-c'; dom.append(b, c);
      return { dom, contentDOM: c, update: n => { if (n.type.name !== 'toggle') return false; node = n; dom.dataset.toggle = n.attrs.open ? 'open' : 'closed'; return true; } };
    };
  },
});

const BLOCKS = [
  [tr('Texto'), 'texto parrafo text paragraph', c => c.setParagraph()], [tr('Título 1'), 'h1 titulo heading title', c => c.setHeading({ level: 1 })], [tr('Título 2'), 'h2 titulo subtitulo heading subtitle', c => c.setHeading({ level: 2 })], [tr('Título 3'), 'h3 titulo heading', c => c.setHeading({ level: 3 })],
  [tr('Lista'), 'lista viñetas bullet list', c => c.toggleBulletList()], [tr('Lista numerada'), 'numerada ordenada numbered ordered list', c => c.toggleOrderedList()], [tr('Tareas'), 'tareas checklist pendientes casillas todo tasks', c => c.toggleTaskList()],
  [tr('Cita'), 'cita quote', c => c.toggleBlockquote()], [tr('Destacado'), 'destacado callout nota aviso note warning', c => c.insertContent({ type: 'callout', attrs: { emoji: '💡' }, content: [{ type: 'paragraph' }] })],
  [tr('Desplegable'), 'desplegable toggle plegable collapse', c => c.insertContent({ type: 'toggle', attrs: { open: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: tr('Título del desplegable') }] }, { type: 'paragraph' }] })],
  [tr('Tabla'), 'tabla table', c => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true })], [tr('Código'), 'codigo code', c => c.toggleCodeBlock()], [tr('Línea divisoria'), 'linea separador hr divider line', c => c.setHorizontalRule()],
  [tr('Imagen'), 'imagen foto picture image photo', null],
];
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const TB = [['H1', c => c.toggleHeading({ level: 1 }), e => e.isActive('heading', { level: 1 }), tr('Título 1')], ['H2', c => c.toggleHeading({ level: 2 }), e => e.isActive('heading', { level: 2 }), tr('Título 2')], ['H3', c => c.toggleHeading({ level: 3 }), e => e.isActive('heading', { level: 3 }), tr('Título 3')],
  ['B', c => c.toggleBold(), e => e.isActive('bold'), tr('Negrita (Ctrl+B)')], ['I', c => c.toggleItalic(), e => e.isActive('italic'), tr('Cursiva (Ctrl+I)')], ['S', c => c.toggleStrike(), e => e.isActive('strike'), tr('Tachado')],
  ['• Lista', c => c.toggleBulletList(), e => e.isActive('bulletList'), tr('Lista')], ['1. Lista', c => c.toggleOrderedList(), e => e.isActive('orderedList'), tr('Lista numerada')], ['☑ Tareas', c => c.toggleTaskList(), e => e.isActive('taskList'), tr('Lista de tareas')]];

export function RichEditor({ value, editable, onChange, placeholder, onImage, version }) {
  const host = useRef(), ed = useRef(), last = useRef(value || ''), cb = useRef(onChange), imgCb = useRef(onImage); cb.current = onChange; imgCb.current = onImage;
  const [, tick] = useState(0), [ask, setAsk] = useState(null), [url, setUrl] = useState(''), [slash, setSlash] = useState(null), [up, setUp] = useState(0); const sl = useRef(null); sl.current = slash;
  const fileIn = useRef();
  const upload = async files => {
    const e = ed.current; const list = [...files].filter(f => /^image\//.test(f.type)); if (!list.length) return false;
    if (!imgCb.current) return false;
    for (const f of list) { setUp(n => n + 1); try { const u = await imgCb.current(f); if (u) e.chain().focus().setImage({ src: imgSrc(u) }).run(); } finally { setUp(n => n - 1); } }
    return true;
  };
  const shown = () => { const s = sl.current; if (!s) return []; const k = norm(s.q); return BLOCKS.filter(([l, kw]) => !k || norm(l + ' ' + kw).includes(k)); };
  const runBlock = b => {
    const e = ed.current, s = sl.current; if (!e || !s) return; setSlash(null);
    const chain = e.chain().focus().deleteRange({ from: s.from, to: e.state.selection.from });
    if (b[2]) b[2](chain).run(); else { chain.run(); fileIn.current && fileIn.current.click(); }
  };
  useEffect(() => {
    let timer; const flush = () => { clearTimeout(timer); timer = null; const md = e.storage.markdown.getMarkdown(); if (md !== last.current) { last.current = md; cb.current(md); } };
    const detect = () => {
      const { state } = e, { $from, empty } = state.selection; if (!empty || !e.isEditable) { if (sl.current) setSlash(null); return; }
      const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼'); const m = before.match(/(?:^|\s)\/([\wáéíóúñ ]{0,20})$/i);
      if (m && $from.parent.type.name === 'paragraph') { const c = e.view.coordsAtPos($from.pos); setSlash({ q: m[1], from: $from.pos - m[1].length - 1, x: c.left, y: c.bottom, hi: sl.current && sl.current.q === m[1] ? sl.current.hi : 0 }); }
      else if (sl.current) setSlash(null);
    };
    const e = new TipTap({
      element: host.current, editable, content: value || '',
      extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), Link.configure({ openOnClick: false, autolink: true }), Image, Callout, Toggle, Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
        Placeholder.configure({ placeholder: placeholder || tr('Escribe aquí, o pulsa «/» para insertar títulos, listas, tablas, imágenes…') }), Markdown.configure({ html: true, transformPastedText: true, breaks: false })],
      editorProps: {
        handleKeyDown: (_v, ev) => {
          const s = sl.current; if (!s) return false; const list = shown();
          if (ev.key === 'ArrowDown') { setSlash({ ...s, hi: Math.min(s.hi + 1, list.length - 1) }); return true; }
          if (ev.key === 'ArrowUp') { setSlash({ ...s, hi: Math.max(s.hi - 1, 0) }); return true; }
          if (ev.key === 'Enter' || ev.key === 'Tab') { if (list[s.hi]) { runBlock(list[s.hi]); return true; } setSlash(null); return false; }
          if (ev.key === 'Escape') { setSlash(null); return true; }
          return false;
        },
        handlePaste: (_v, ev) => { const f = ev.clipboardData && ev.clipboardData.files; if (f && f.length && imgCb.current) { upload(f); return true; } return false; },
        handleDrop: (_v, ev) => { const f = ev.dataTransfer && ev.dataTransfer.files; if (f && f.length && imgCb.current) { ev.preventDefault(); upload(f); return true; } return false; },
      },
      onUpdate: () => { clearTimeout(timer); timer = setTimeout(flush, 700); detect(); }, onSelectionUpdate: () => { tick(x => x + 1); detect(); }, onTransaction: () => tick(x => x + 1), onBlur: () => setTimeout(() => setSlash(null), 150),
    });
    ed.current = e; last.current = e.storage.markdown.getMarkdown();
    return () => { if (timer) flush(); e.destroy(); };
  }, []);
  // Cambios que llegan de fuera (sincronización o fusión con otra persona).
  useEffect(() => {
    const e = ed.current; if (!e || (value || '') === last.current) return;
    if (!e.isFocused || version) { const { from, to } = e.state.selection; e.commands.setContent(value || '', false); last.current = e.storage.markdown.getMarkdown(); const max = e.state.doc.content.size; try { e.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) }); } catch { } }
  }, [value, version]);
  useEffect(() => { ed.current && ed.current.setEditable(editable); }, [editable]);
  const e = ed.current; const run = f => f(e.chain().focus()).run();
  const okAsk = () => { if (url.trim()) { if (ask === 'link') run(c => c.extendMarkRange('link').setLink({ href: url.trim() })); else run(c => c.setImage({ src: imgSrc(url.trim()) })); } setAsk(null); setUrl(''); };
  const list = shown();
  return <div class="rich">
    {editable && e && <div class="toolbar">{TB.map(([l, f, a, t]) => <button title={t} class={a(e) ? 'on' : ''} onMouseDown={ev => { ev.preventDefault(); run(f); }}>{l}</button>)}
      <button title={tr("Enlace")} class={e.isActive('link') ? 'on' : ''} onMouseDown={ev => { ev.preventDefault(); if (e.isActive('link')) run(c => c.unsetLink()); else setAsk('link'); }}><Ic n="link" s={14} /></button>
      <button title={tr("Imagen")} onMouseDown={ev => { ev.preventDefault(); if (onImage) fileIn.current.click(); else setAsk('image'); }}><Ic n="image" s={14} /></button>
      {onImage && <button title={tr("Imagen por enlace")} onMouseDown={ev => { ev.preventDefault(); setAsk('image'); }}><Ic n="globe" s={14} /></button>}
      <button title={tr("Más bloques: escribe / en una línea vacía")} onMouseDown={ev => { ev.preventDefault(); run(c => c.insertContent('/')); }}>{tr("＋ Bloque")}</button>
      {up > 0 && <span class="muted sm">{tr("Subiendo imagen…")}</span>}</div>}
    <input type="file" accept="image/*" multiple hidden ref={fileIn} onChange={ev => { upload(ev.target.files); ev.target.value = ''; }} />
    {ask && <div class="askbar"><input ref={el => el && !el.dataset.af && (el.dataset.af = 1, el.focus())} placeholder={ask === 'link' ? tr('Pega el enlace…') : tr('Pega el enlace de la imagen (web, Drive o YouTube)…')} value={url} onInput={ev => setUrl(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') okAsk(); if (ev.key === 'Escape') { setAsk(null); setUrl(''); } ev.stopPropagation(); }} /><button class="btn" onClick={okAsk}>{tr("Aceptar")}</button></div>}
    <div ref={host} class="prose" />
    {slash && list.length > 0 && <div class="slash" style={{ left: Math.min(slash.x, innerWidth - 250) + 'px', top: (slash.y + 220 > innerHeight ? slash.y - 240 : slash.y + 6) + 'px' }}>
      <div class="ctx-t">{tr("Insertar bloque")}</div>{list.map((b, i) => <div class={'ctx-i' + (i === slash.hi ? ' hi' : '')} onMouseDown={ev => { ev.preventDefault(); runBlock(b); }} onMouseEnter={() => setSlash({ ...slash, hi: i })}>{b[0]}</div>)}</div>}
  </div>;
}
