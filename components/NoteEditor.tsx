"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { parseNoteInitial } from "@/lib/noteMarkdown";
import "./note-editor.css";

const TEXT_COLORS = ["", "#DC2626", "#EA580C", "#CA8A04", "#16A34A", "#2563EB", "#7C3AED", "#DB2777", "#6B7280"];
const BG_COLORS = ["", "#FEF9CD", "#D8F3DC", "#D8EEF9", "#EDE9FE", "#FEE2E2", "#FCE7F3", "#F1F1EF"];

interface Props {
  initialContent: string;       // noteContent（TipTap JSON or 旧Markdown）
  onChange: (json: string) => void; // TipTap JSON 文字列を返す（デバウンス済み）
  readOnly?: boolean;
}

export default function NoteEditor({ initialContent, onChange, readOnly = false }: Props) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    editable: !readOnly,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Placeholder.configure({ placeholder: "ここに書く（# 見出し、- リスト、**太字** などそのまま使えます）" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: true, autolink: true }),
      TextStyle,
      Color,
      Underline,
    ],
    content: parseNoteInitial(initialContent),
    editorProps: { attributes: { class: "note-prose min-h-[40vh]" } },
    onUpdate: ({ editor }) => {
      if (readOnly) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        onChangeRef.current(JSON.stringify(editor.getJSON()));
      }, 700);
    },
  });

  // アンマウント時に保存を確定
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (editor && !readOnly) onChangeRef.current(JSON.stringify(editor.getJSON()));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, readOnly]);

  if (!editor) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {!readOnly && <Toolbar editor={editor} />}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [colorOpen, setColorOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm transition ${active ? "bg-indigo-100 text-indigo-700 font-semibold" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-gray-50 px-3 py-1.5">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>B</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}><i>I</i></button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))}><u>U</u></button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))}><s>S</s></button>
      <button onClick={() => editor.chain().focus().toggleCode().run()} className={btn(editor.isActive("code"))}>{"<>"}</button>

      <div className="relative">
        <button onClick={() => { setColorOpen(v => !v); setBgOpen(false); }} className={btn(colorOpen)} title="文字色">A<span className="text-[8px]">▾</span></button>
        {colorOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-xl" style={{ width: 150 }}>
            {TEXT_COLORS.map(c => (
              <button key={c} title={c || "標準"}
                onClick={() => { c ? editor.chain().focus().setColor(c).run() : editor.chain().focus().unsetColor().run(); setColorOpen(false); }}
                className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold hover:ring-2 hover:ring-indigo-400"
                style={{ color: c || "#111", border: "1px solid #e5e7eb" }}>A</button>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <button onClick={() => { setBgOpen(v => !v); setColorOpen(false); }} className={btn(bgOpen)} title="マーカー">🖍</button>
        {bgOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-xl" style={{ width: 150 }}>
            {BG_COLORS.map(c => (
              <button key={c} title={c || "なし"}
                onClick={() => { c ? editor.chain().focus().toggleHighlight({ color: c }).run() : editor.chain().focus().unsetHighlight().run(); setBgOpen(false); }}
                className="h-6 w-6 rounded hover:ring-2 hover:ring-indigo-400"
                style={{ background: c || "white", border: "1px solid #e5e7eb" }} />
            ))}
          </div>
        )}
      </div>

      <Sep />
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))}>H1</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>H2</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive("heading", { level: 3 }))}>H3</button>
      <Sep />
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>• リスト</button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>1. リスト</button>
      <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={btn(editor.isActive("taskList"))}>☑ Todo</button>
      <Sep />
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))}>❝ 引用</button>
      <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btn(editor.isActive("codeBlock"))}>コード</button>
      <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btn(false)}>──</button>
    </div>
  );
}

function Sep() {
  return <span className="mx-1 h-5 self-center border-r border-gray-200" />;
}
