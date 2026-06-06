"use client";

import { useState } from "react";
import { TagGroup, TagDef, FriendFieldDef, MindMapNode } from "@/types";

interface Props {
  node: MindMapNode;                 // 対象ノード
  screenX: number;                   // 表示位置（コンテナ内座標）
  screenY: number;
  tagGroups: TagGroup[];
  tagDefs: TagDef[];
  friendFields: FriendFieldDef[];
  onClose: () => void;
  // ノードの付与を更新
  onUpdateNode: (patch: { tagIds?: string[]; friendFieldIds?: string[] }) => void;
  // マスタにその場追加
  onAddTag: (name: string, color: string, groupId: string | null) => string;     // 返り値=新tagId
  onAddField: (name: string) => string;                                          // 返り値=新fieldId
}

const PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#f59e0b", "#10b981", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#0f172a",
];

export default function NodeTagFieldPopup({
  node, screenX, screenY, tagGroups, tagDefs, friendFields, onClose, onUpdateNode, onAddTag, onAddField,
}: Props) {
  const tagIds = node.tagIds ?? [];
  const fieldIds = node.friendFieldIds ?? [];
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PALETTE[0]);
  const [newFieldName, setNewFieldName] = useState("");

  const toggleTag = (tid: string) => {
    const next = tagIds.includes(tid) ? tagIds.filter(x => x !== tid) : [...tagIds, tid];
    onUpdateNode({ tagIds: next });
  };
  const toggleField = (fid: string) => {
    const next = fieldIds.includes(fid) ? fieldIds.filter(x => x !== fid) : [...fieldIds, fid];
    onUpdateNode({ friendFieldIds: next });
  };
  const addAndAttachTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    const id = onAddTag(name, newTagColor, null);
    onUpdateNode({ tagIds: [...tagIds, id] });
    setNewTagName("");
  };
  const addAndAttachField = () => {
    const name = newFieldName.trim();
    if (!name) return;
    const id = onAddField(name);
    onUpdateNode({ friendFieldIds: [...fieldIds, id] });
    setNewFieldName("");
  };

  // グループ別整理
  const grouped: { group: TagGroup | null; tags: TagDef[] }[] = [
    ...tagGroups.map(g => ({ group: g, tags: tagDefs.filter(t => t.groupId === g.id) })),
    { group: null, tags: tagDefs.filter(t => !t.groupId || !tagGroups.some(g => g.id === t.groupId)) },
  ];

  const POPUP_W = 280;

  return (
    <div
      style={{
        position: "absolute", zIndex: 70,
        left: screenX, top: screenY,
        width: POPUP_W, maxHeight: 420, overflowY: "auto",
        background: "white", borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
        border: "1.5px solid #6366f1",
        padding: "12px 14px 14px",
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
        <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>🏷️ タグ・友だち情報</span>
        <button onClick={onClose} style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 16, lineHeight: 1 }}>×</button>
      </div>

      {/* タグ */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", margin: "4px 0 6px" }}>🏷️ タグ</div>
      {grouped.map(({ group, tags }) => (
        tags.length > 0 && (
          <div key={group?.id ?? "__none"} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{group?.name ?? "未分類"}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {tags.map(t => {
                const on = tagIds.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggleTag(t.id)}
                    style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 999,
                      border: `1px solid ${t.color}`,
                      background: on ? t.color : "transparent",
                      color: on ? "white" : t.color,
                      cursor: "pointer", fontWeight: 600,
                    }}>
                    {on ? "✓ " : ""}{t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )
      ))}
      {tagDefs.length === 0 && <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 4 }}>タグ未登録</div>}
      {/* タグその場追加 */}
      <div style={{ display: "flex", gap: 4, marginTop: 4, marginBottom: 10 }}>
        <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)}
          style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #e2e8f0", cursor: "pointer" }} />
        <input value={newTagName} onChange={e => setNewTagName(e.target.value)}
          onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") addAndAttachTag(); }}
          placeholder="新規タグ" style={{ flex: 1, fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 6px", outline: "none" }} />
        <button onClick={addAndAttachTag} style={{ fontSize: 11, padding: "2px 8px", background: "#eef2ff", color: "#6366f1", borderRadius: 6, fontWeight: 600 }}>＋</button>
      </div>

      {/* 友だち情報 */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", margin: "4px 0 6px" }}>📝 友だち情報（この時点で取得/更新）</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {friendFields.map(f => {
          const on = fieldIds.includes(f.id);
          return (
            <label key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: on ? "#334155" : "#94a3b8" }}>
              <input type="checkbox" checked={on} onChange={() => toggleField(f.id)} />
              {f.name}
            </label>
          );
        })}
        {friendFields.length === 0 && <div style={{ fontSize: 11, color: "#cbd5e1" }}>項目未登録</div>}
      </div>
      {/* 項目その場追加 */}
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)}
          onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") addAndAttachField(); }}
          placeholder="新規項目" style={{ flex: 1, fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 6px", outline: "none" }} />
        <button onClick={addAndAttachField} style={{ fontSize: 11, padding: "2px 8px", background: "#eef2ff", color: "#6366f1", borderRadius: 6, fontWeight: 600 }}>＋</button>
      </div>
    </div>
  );
}
