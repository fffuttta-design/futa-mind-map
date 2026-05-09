"use client";

import { useState, useEffect, useRef } from "react";
import { MindMapNode } from "@/types";

type Tab = "style" | "text" | "media" | "link" | "note" | null;

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#f59e0b", "#10b981", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#1e293b",
  "#ffffff", "#000000",
];
const TEXT_COLORS = ["#ffffff", "#1e293b", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
const ICONS = ["💡", "⭐", "🔥", "✅", "❌", "📌", "🎯", "💬", "🔗", "📝", "⚠️", "🚀", "💰", "🎨", "🔑", "📊", "🏆", "💎", "🌟", "🎵", "🌈", "🎪"];

interface Props {
  node: MindMapNode;
  screenX: number;
  screenY: number;
  onUpdate: (node: MindMapNode) => void;
}

const SHAPES = [
  { id: "pill", label: "⬭" },
  { id: "rect", label: "▭" },
  { id: "circle", label: "⊙" },
  { id: "diamond", label: "◇" },
  { id: "text", label: "T" },
] as const;

export default function NodeToolbar({ node, screenX, screenY, onUpdate }: Props) {
  const [tab, setTab] = useState<Tab>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setTab(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const BUTTONS: { id: Tab; icon: string; title: string }[] = [
    { id: "style", icon: "🎨", title: "形・カラー" },
    { id: "text",  icon: "Ａ", title: "テキスト" },
    { id: "media", icon: "🖼️", title: "画像・アイコン" },
    { id: "link",  icon: "🔗", title: "リンク" },
    { id: "note",  icon: "💬", title: "メモ" },
  ];

  const TOOLBAR_W = 220;
  const left = Math.max(8, screenX - TOOLBAR_W / 2);
  const top = screenY - 52;

  return (
    <div ref={ref} style={{ position: "absolute", left, top, zIndex: 30, width: TOOLBAR_W }}>
      {/* Toolbar strip */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-2 py-1.5 flex items-center gap-0.5">
        {BUTTONS.map(btn => (
          <button
            key={btn.id}
            title={btn.title}
            onClick={() => setTab(tab === btn.id ? null : btn.id)}
            className={`flex-1 h-8 rounded-lg text-sm transition-colors ${tab === btn.id ? "bg-indigo-100 text-indigo-600" : "text-gray-500 hover:bg-gray-100"}`}
          >
            {btn.icon}
          </button>
        ))}
      </div>

      {/* Dropdown panel */}
      {tab && (
        <div className="mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 p-4">

          {tab === "style" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-2">形</p>
                <div className="flex gap-1.5">
                  {SHAPES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => onUpdate({ ...node, shape: s.id })}
                      className={`flex-1 h-8 rounded border text-base transition-colors ${(node.shape ?? "pill") === s.id ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                    >{s.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">カラー</p>
                <div className="grid grid-cols-7 gap-1">
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
            </div>
          )}

          {tab === "text" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-2">スタイル・サイズ</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onUpdate({ ...node, fontBold: !node.fontBold })}
                    className={`w-9 h-8 rounded border font-bold text-sm transition-colors ${node.fontBold ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                  >B</button>
                  <button
                    onClick={() => onUpdate({ ...node, fontItalic: !node.fontItalic })}
                    className={`w-9 h-8 rounded border italic text-sm transition-colors ${node.fontItalic ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                  >i</button>
                  {([11, 13, 15, 17] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => onUpdate({ ...node, fontSize: size })}
                      className={`flex-1 h-8 rounded border text-xs transition-colors ${(node.fontSize ?? 13) === size ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                    >{size}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">文字色</p>
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
            </div>
          )}

          {tab === "media" && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-2">アイコン</p>
                <div className="grid grid-cols-8 gap-1">
                  <button
                    onClick={() => onUpdate({ ...node, icon: undefined })}
                    className={`w-7 h-7 rounded border text-xs flex items-center justify-center transition-colors ${!node.icon ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
                  >✕</button>
                  {ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => onUpdate({ ...node, icon })}
                      className={`w-7 h-7 rounded border text-sm flex items-center justify-center transition-colors ${node.icon === icon ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
                    >{icon}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">画像URL</p>
                <input
                  type="url"
                  value={node.imageUrl ?? ""}
                  onChange={e => onUpdate({ ...node, imageUrl: e.target.value || undefined })}
                  placeholder="https://..."
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                />
                {node.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={node.imageUrl} alt="" className="mt-2 w-full h-20 object-cover rounded border border-gray-200" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
              </div>
            </div>
          )}

          {tab === "link" && (
            <div>
              <p className="text-xs text-gray-500 mb-2">リンクURL</p>
              <input
                type="url"
                value={node.url ?? ""}
                onChange={e => onUpdate({ ...node, url: e.target.value || undefined })}
                placeholder="https://..."
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-400"
              />
              {node.url && (
                <a href={node.url} target="_blank" rel="noopener noreferrer" className="block mt-2 text-xs text-indigo-500 hover:underline truncate">{node.url}</a>
              )}
            </div>
          )}

          {tab === "note" && (
            <div>
              <p className="text-xs text-gray-500 mb-2">メモ</p>
              <textarea
                value={node.note ?? ""}
                onChange={e => onUpdate({ ...node, note: e.target.value || undefined })}
                placeholder="メモを入力..."
                className="w-full h-28 text-xs border border-gray-200 rounded p-2 resize-none focus:outline-none focus:border-indigo-400"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
