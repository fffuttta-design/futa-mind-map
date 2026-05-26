"use client";

import { useState, useRef } from "react";
import { MindMapNode, ChecklistItem } from "@/types";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#f59e0b", "#10b981", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#1e293b",
  "#ffffff", "#000000",
];
const TEXT_COLORS = ["#ffffff", "#1e293b", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
const ICONS = ["💡", "⭐", "🔥", "✅", "❌", "📌", "🎯", "💬", "🔗", "📝", "⚠️", "🚀", "💰", "🎨", "🔑", "📊", "🏆", "💎", "🌟", "🎵", "🌈", "🎪"];

const SHAPES = [
  { id: "pill",    label: "⬭", title: "カプセル" },
  { id: "rect",    label: "▭", title: "四角" },
  { id: "circle",  label: "⊙", title: "円" },
  { id: "diamond", label: "◇", title: "ダイヤ" },
  { id: "text",    label: "T", title: "テキスト" },
] as const;

interface Props {
  node: MindMapNode;
  screenX: number;
  screenY: number;
  onUpdate: (node: MindMapNode) => void;
}

type Panel = "nodeColor" | "textColor" | "icon" | "link" | "note" | "media" | "checklist" | null;

export default function NodeToolbar({ node, screenX, screenY, onUpdate }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [newItemText, setNewItemText] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const togglePanel = (p: Panel) => setPanel(prev => prev === p ? null : p);

  const TOOLBAR_W = 420;
  const left = Math.max(8, screenX - TOOLBAR_W / 2);
  const top = screenY - 56;

  return (
    <div ref={ref} style={{ position: "absolute", left, top, zIndex: 30 }}>

      {/* ─── メインツールバー（横一列）─── */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-2 py-1.5 flex items-center gap-0.5"
        style={{ width: TOOLBAR_W }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* 形 */}
        {SHAPES.map(s => (
          <button
            key={s.id}
            title={s.title}
            onClick={() => onUpdate({ ...node, shape: s.id })}
            className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-colors
              ${(node.shape ?? "pill") === s.id
                ? "bg-indigo-100 text-indigo-600"
                : "text-gray-500 hover:bg-gray-100"}`}
          >{s.label}</button>
        ))}

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Bold / Italic */}
        <button
          title="太字"
          onClick={() => onUpdate({ ...node, fontBold: !node.fontBold })}
          className={`w-7 h-7 rounded-lg text-sm font-bold flex items-center justify-center transition-colors
            ${node.fontBold ? "bg-indigo-100 text-indigo-600" : "text-gray-600 hover:bg-gray-100"}`}
        >B</button>
        <button
          title="斜体"
          onClick={() => onUpdate({ ...node, fontItalic: !node.fontItalic })}
          className={`w-7 h-7 rounded-lg text-sm italic flex items-center justify-center transition-colors
            ${node.fontItalic ? "bg-indigo-100 text-indigo-600" : "text-gray-600 hover:bg-gray-100"}`}
        >i</button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* フォントサイズ */}
        <button
          title="小さく"
          onClick={() => onUpdate({ ...node, fontSize: Math.max(9, (node.fontSize ?? 13) - 1) })}
          className="w-5 h-7 rounded text-gray-500 hover:bg-gray-100 flex items-center justify-center text-xs"
        >−</button>
        <span className="text-xs text-gray-700 w-5 text-center tabular-nums">{node.fontSize ?? 13}</span>
        <button
          title="大きく"
          onClick={() => onUpdate({ ...node, fontSize: Math.min(28, (node.fontSize ?? 13) + 1) })}
          className="w-5 h-7 rounded text-gray-500 hover:bg-gray-100 flex items-center justify-center text-xs"
        >+</button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* ノード色 */}
        <button
          title="ノード色"
          onClick={() => togglePanel("nodeColor")}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100
            ${panel === "nodeColor" ? "ring-2 ring-indigo-400" : ""}`}
        >
          <span className="w-4 h-4 rounded-full border border-gray-300 block" style={{ backgroundColor: node.color }} />
        </button>

        {/* 文字色 */}
        <button
          title="文字色"
          onClick={() => togglePanel("textColor")}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100
            ${panel === "textColor" ? "ring-2 ring-indigo-400" : ""}`}
        >
          <span className="text-sm font-bold leading-none" style={{ color: node.textColor ?? "#1e293b", textShadow: node.textColor === "#ffffff" ? "0 0 2px #888" : "none" }}>A</span>
        </button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* アイコン */}
        <button
          title="アイコン"
          onClick={() => togglePanel("icon")}
          className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center hover:bg-gray-100 transition-colors
            ${panel === "icon" ? "bg-indigo-100 text-indigo-600" : "text-gray-500"}`}
        >{node.icon ?? "🙂"}</button>

        {/* 画像 */}
        <button
          title="画像"
          onClick={() => togglePanel("media")}
          className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center hover:bg-gray-100 transition-colors
            ${panel === "media" ? "bg-indigo-100 text-indigo-600" : "text-gray-500"}`}
        >🖼️</button>

        {/* リンク */}
        <button
          title="リンク"
          onClick={() => togglePanel("link")}
          className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center hover:bg-gray-100 transition-colors
            ${panel === "link" ? "bg-indigo-100 text-indigo-600" : "text-gray-500"} ${node.url ? "text-blue-500" : ""}`}
        >🔗</button>

        {/* メモ */}
        <button
          title="メモ"
          onClick={() => togglePanel("note")}
          className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center hover:bg-gray-100 transition-colors
            ${panel === "note" ? "bg-indigo-100 text-indigo-600" : "text-gray-500"} ${node.note ? "text-indigo-500" : ""}`}
        >💬</button>

        {/* チェックリスト */}
        <button
          title="チェックリスト"
          onClick={() => togglePanel("checklist")}
          className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center hover:bg-gray-100 transition-colors
            ${panel === "checklist" ? "bg-indigo-100 text-indigo-600" : "text-gray-500"} ${(node.checklist?.length ?? 0) > 0 ? "text-emerald-500" : ""}`}
        >✅</button>
      </div>

      {/* ─── サブパネル（ノード色）─── */}
      {panel === "nodeColor" && (
        <div className="mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 p-3"
          onMouseDown={e => e.stopPropagation()}>
          <div className="grid grid-cols-7 gap-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => onUpdate({ ...node, color: c })}
                className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: c, outline: node.color === c ? "2px solid #6366f1" : "none", outlineOffset: 1 }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── サブパネル（文字色）─── */}
      {panel === "textColor" && (
        <div className="mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 p-3"
          onMouseDown={e => e.stopPropagation()}>
          <div className="flex gap-1.5">
            {TEXT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => onUpdate({ ...node, textColor: c })}
                className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: c, outline: (node.textColor ?? "#ffffff") === c ? "2px solid #6366f1" : "none", outlineOffset: 1 }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── サブパネル（アイコン）─── */}
      {panel === "icon" && (
        <div className="mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 p-3"
          onMouseDown={e => e.stopPropagation()}>
          <div className="grid grid-cols-8 gap-1">
            <button
              onClick={() => onUpdate({ ...node, icon: undefined })}
              className={`w-7 h-7 rounded border text-xs flex items-center justify-center ${!node.icon ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
            >✕</button>
            {ICONS.map(icon => (
              <button
                key={icon}
                onClick={() => onUpdate({ ...node, icon })}
                className={`w-7 h-7 rounded border text-sm flex items-center justify-center ${node.icon === icon ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
              >{icon}</button>
            ))}
          </div>
        </div>
      )}

      {/* ─── サブパネル（画像）─── */}
      {panel === "media" && (
        <div className="mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 p-3 space-y-2"
          style={{ width: TOOLBAR_W }}
          onMouseDown={e => e.stopPropagation()}>
          <label className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            📁 ローカルファイルを選択
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => { onUpdate({ ...node, imageUrl: ev.target?.result as string }); };
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <div>
            <p className="text-xs text-gray-400 mb-1">または画像URL</p>
            <input
              type="url"
              value={node.imageUrl ?? ""}
              onChange={e => onUpdate({ ...node, imageUrl: e.target.value || undefined })}
              placeholder="https://..."
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400"
            />
            {node.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={node.imageUrl} alt="" className="mt-2 w-full h-20 object-cover rounded border border-gray-200"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>
        </div>
      )}

      {/* ─── サブパネル（リンク）─── */}
      {panel === "link" && (
        <div className="mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 p-3"
          style={{ width: TOOLBAR_W }}
          onMouseDown={e => e.stopPropagation()}>
          <p className="text-xs text-gray-400 mb-1.5">リンクURL</p>
          <input
            type="url"
            value={node.url ?? ""}
            onChange={e => onUpdate({ ...node, url: e.target.value || undefined })}
            placeholder="https://..."
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400"
          />
          {node.url && (
            <a href={node.url} target="_blank" rel="noopener noreferrer"
              className="block mt-2 text-xs text-indigo-500 hover:underline truncate">{node.url}</a>
          )}
        </div>
      )}

      {/* ─── サブパネル（メモ）─── */}
      {panel === "note" && (
        <div className="mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 p-3"
          style={{ width: TOOLBAR_W }}
          onMouseDown={e => e.stopPropagation()}>
          <p className="text-xs text-gray-400 mb-1.5">メモ</p>
          <textarea
            value={node.note ?? ""}
            onChange={e => onUpdate({ ...node, note: e.target.value || undefined })}
            placeholder="メモを入力..."
            className="w-full h-28 text-xs border border-gray-200 rounded p-2 resize-none focus:outline-none focus:border-indigo-400"
            onKeyDown={e => {
              // キャンバスのショートカットに漏れないよう伝播を止める
              e.stopPropagation();
              // Ctrl+A はこのテキストエリア内だけを全選択する
              if (e.ctrlKey && (e.key === "a" || e.key === "A")) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).select();
              }
            }}
          />
        </div>
      )}

      {/* ─── サブパネル（チェックリスト）─── */}
      {panel === "checklist" && (
        <div className="mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 p-3"
          style={{ width: TOOLBAR_W }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 font-medium">チェックリスト</p>
            {(node.checklist?.length ?? 0) > 0 && (
              <span className="text-xs text-emerald-500 font-semibold">
                {node.checklist!.filter(i => i.done).length}/{node.checklist!.length} 完了
              </span>
            )}
          </div>

          {/* アイテム一覧 */}
          <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
            {(node.checklist ?? []).length === 0 && (
              <p className="text-xs text-gray-300 text-center py-3">アイテムがありません</p>
            )}
            {(node.checklist ?? []).map(item => (
              <div key={item.id} className="flex items-center gap-2 group py-0.5">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => onUpdate({
                    ...node,
                    checklist: node.checklist!.map(i => i.id === item.id ? { ...i, done: !i.done } : i),
                  })}
                  className="w-3.5 h-3.5 accent-indigo-500 shrink-0"
                />
                <span className={`flex-1 text-xs break-all ${item.done ? "line-through text-gray-400" : "text-gray-700"}`}>
                  {item.text}
                </span>
                <button
                  onClick={() => {
                    const updated = node.checklist!.filter(i => i.id !== item.id);
                    onUpdate({ ...node, checklist: updated.length > 0 ? updated : undefined });
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity shrink-0"
                >✕</button>
              </div>
            ))}
          </div>

          {/* 新規アイテム入力 */}
          <div className="flex gap-1">
            <input
              type="text"
              value={newItemText}
              onChange={e => setNewItemText(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.ctrlKey && (e.key === "a" || e.key === "A")) {
                  e.preventDefault();
                  (e.target as HTMLInputElement).select();
                }
                if (e.key === "Enter" && newItemText.trim()) {
                  const newItem: ChecklistItem = { id: `item-${Date.now()}`, text: newItemText.trim(), done: false };
                  onUpdate({ ...node, checklist: [...(node.checklist ?? []), newItem] });
                  setNewItemText("");
                }
              }}
              placeholder="＋ アイテムを追加..."
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400"
            />
            <button
              onClick={() => {
                if (!newItemText.trim()) return;
                const newItem: ChecklistItem = { id: `item-${Date.now()}`, text: newItemText.trim(), done: false };
                onUpdate({ ...node, checklist: [...(node.checklist ?? []), newItem] });
                setNewItemText("");
              }}
              disabled={!newItemText.trim()}
              className="px-3 py-1.5 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-40 transition-colors"
            >追加</button>
          </div>
        </div>
      )}
    </div>
  );
}
