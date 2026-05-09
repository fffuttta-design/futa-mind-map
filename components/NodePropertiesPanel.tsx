"use client";

import { useState } from "react";
import { MindMapNode } from "@/types";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#f59e0b", "#10b981", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#1e293b",
];

const ICONS = ["💡", "⭐", "🔥", "✅", "❌", "📌", "🎯", "💬", "🔗", "📝", "⚠️", "🚀", "💰", "🎨", "🔑", "📊"];

interface Props {
  node: MindMapNode;
  onUpdate: (node: MindMapNode) => void;
  onClose: () => void;
}

export default function NodePropertiesPanel({ node, onUpdate, onClose }: Props) {
  const [tab, setTab] = useState<"style" | "note" | "url">("style");

  return (
    <div className="absolute right-4 top-16 w-64 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">ノードの設定</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      <div className="flex border-b border-gray-100">
        {(["style", "note", "url"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === t ? "text-indigo-600 border-b-2 border-indigo-500" : "text-gray-400 hover:text-gray-600"}`}
          >
            {t === "style" ? "スタイル" : t === "note" ? "メモ" : "URL"}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "style" && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">色</p>
              <div className="grid grid-cols-6 gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => onUpdate({ ...node, color: c })}
                    className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: node.color === c ? "2.5px solid #1e293b" : "none",
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">アイコン</p>
              <div className="grid grid-cols-8 gap-1">
                <button
                  onClick={() => onUpdate({ ...node, icon: undefined })}
                  className={`w-7 h-7 rounded text-xs flex items-center justify-center border transition-colors ${!node.icon ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  ✕
                </button>
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => onUpdate({ ...node, icon })}
                    className={`w-7 h-7 rounded text-sm flex items-center justify-center border transition-colors ${node.icon === icon ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "note" && (
          <textarea
            value={node.note ?? ""}
            onChange={(e) => onUpdate({ ...node, note: e.target.value })}
            placeholder="メモを入力..."
            className="w-full h-32 text-sm text-gray-700 border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:border-indigo-400"
          />
        )}

        {tab === "url" && (
          <div className="space-y-2">
            <input
              type="url"
              value={node.url ?? ""}
              onChange={(e) => onUpdate({ ...node, url: e.target.value })}
              placeholder="https://..."
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
            />
            {node.url && (
              <a
                href={node.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-indigo-500 hover:underline truncate"
              >
                {node.url}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
