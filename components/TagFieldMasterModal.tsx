"use client";

import { useState } from "react";
import { TagGroup, TagDef, FriendFieldDef, MindMapNode } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  tagGroups: TagGroup[];
  tagDefs: TagDef[];
  friendFields: FriendFieldDef[];
  nodes: MindMapNode[]; // 使用数カウント・削除時の掃除用
  onSaveMasters: (partial: { tagGroups?: TagGroup[]; tagDefs?: TagDef[]; friendFields?: FriendFieldDef[] }) => void;
  // マスタ削除時に各ノードの参照も掃除する
  onCleanupNodeRefs: (removedTagIds: string[], removedFieldIds: string[]) => void;
}

const PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#f59e0b", "#10b981", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#0f172a",
];

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export default function TagFieldMasterModal({
  open, onClose, tagGroups, tagDefs, friendFields, nodes, onSaveMasters, onCleanupNodeRefs,
}: Props) {
  const [tab, setTab] = useState<"tags" | "fields">("tags");
  const [newGroupName, setNewGroupName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PALETTE[0]);
  const [newTagGroup, setNewTagGroup] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState("");

  if (!open) return null;

  const tagUseCount = (tagId: string) => nodes.filter(n => n.tagIds?.includes(tagId)).length;
  const fieldUseCount = (fid: string) => nodes.filter(n => n.friendFieldIds?.includes(fid)).length;

  // ── グループ操作 ──
  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    onSaveMasters({ tagGroups: [...tagGroups, { id: uid(), name }] });
    setNewGroupName("");
  };
  const renameGroup = (gid: string, name: string) =>
    onSaveMasters({ tagGroups: tagGroups.map(g => g.id === gid ? { ...g, name } : g) });
  const deleteGroup = (gid: string) => {
    // グループ削除：所属タグは「未分類」に移す（タグ自体は残す）
    onSaveMasters({
      tagGroups: tagGroups.filter(g => g.id !== gid),
      tagDefs: tagDefs.map(t => t.groupId === gid ? { ...t, groupId: null } : t),
    });
  };

  // ── タグ操作 ──
  const addTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    onSaveMasters({ tagDefs: [...tagDefs, { id: uid(), name, color: newTagColor, groupId: newTagGroup }] });
    setNewTagName("");
  };
  const updateTag = (tid: string, patch: Partial<TagDef>) =>
    onSaveMasters({ tagDefs: tagDefs.map(t => t.id === tid ? { ...t, ...patch } : t) });
  const deleteTag = (tid: string) => {
    const cnt = tagUseCount(tid);
    if (cnt > 0 && !confirm(`このタグは ${cnt} 個のノードで使われています。削除すると各ノードからも外れます。よろしいですか？`)) return;
    onSaveMasters({ tagDefs: tagDefs.filter(t => t.id !== tid) });
    onCleanupNodeRefs([tid], []);
  };

  // ── 友だち情報項目操作 ──
  const addField = () => {
    const name = newFieldName.trim();
    if (!name) return;
    onSaveMasters({ friendFields: [...friendFields, { id: uid(), name }] });
    setNewFieldName("");
  };
  const renameField = (fid: string, name: string) =>
    onSaveMasters({ friendFields: friendFields.map(f => f.id === fid ? { ...f, name } : f) });
  const deleteField = (fid: string) => {
    const cnt = fieldUseCount(fid);
    if (cnt > 0 && !confirm(`この項目は ${cnt} 個のノードで使われています。削除すると各ノードからも外れます。よろしいですか？`)) return;
    onSaveMasters({ friendFields: friendFields.filter(f => f.id !== fid) });
    onCleanupNodeRefs([], [fid]);
  };

  // グループ別にタグを整理（未分類は最後）
  const grouped: { group: TagGroup | null; tags: TagDef[] }[] = [
    ...tagGroups.map(g => ({ group: g, tags: tagDefs.filter(t => t.groupId === g.id) })),
    { group: null, tags: tagDefs.filter(t => !t.groupId || !tagGroups.some(g => g.id === t.groupId)) },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[620px] max-w-[94vw] max-h-[88vh] flex flex-col overflow-hidden"
        onMouseDown={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-lg">🏷️</span>
          <h2 className="text-base font-bold text-gray-800">タグ・友だち情報マスタ</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* タブ */}
        <div className="px-5 pt-3 flex gap-2 border-b border-gray-100">
          <button onClick={() => setTab("tags")}
            className={`px-3 py-2 text-sm rounded-t-lg ${tab === "tags" ? "bg-indigo-50 text-indigo-600 font-semibold" : "text-gray-500 hover:bg-gray-50"}`}>
            🏷️ タグ（{tagDefs.length}）
          </button>
          <button onClick={() => setTab("fields")}
            className={`px-3 py-2 text-sm rounded-t-lg ${tab === "fields" ? "bg-indigo-50 text-indigo-600 font-semibold" : "text-gray-500 hover:bg-gray-50"}`}>
            📝 友だち情報（{friendFields.length}）
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {tab === "tags" ? (
            <div className="flex flex-col gap-4">
              {/* グループ追加 */}
              <div className="flex items-center gap-2">
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addGroup()}
                  placeholder="新しいグループ名（例: ステータス）"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400" />
                <button onClick={addGroup} className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">＋グループ</button>
              </div>

              {/* グループ別タグ一覧 */}
              {grouped.map(({ group, tags }) => (
                (group || tags.length > 0) && (
                  <div key={group?.id ?? "__none"} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {group ? (
                        <>
                          <input defaultValue={group.name} onBlur={e => renameGroup(group.id, e.target.value)}
                            className="text-sm font-semibold text-gray-700 bg-transparent outline-none border-b border-transparent focus:border-gray-300" />
                          <button onClick={() => deleteGroup(group.id)} className="ml-auto text-xs text-gray-400 hover:text-red-500">グループ削除</button>
                        </>
                      ) : (
                        <span className="text-sm font-semibold text-gray-400">未分類</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {tags.map(t => (
                        <div key={t.id} className="flex items-center gap-2">
                          <input type="color" value={t.color} onChange={e => updateTag(t.id, { color: e.target.value })}
                            className="w-6 h-6 rounded cursor-pointer border border-gray-200" title="色" />
                          <input defaultValue={t.name} onBlur={e => updateTag(t.id, { name: e.target.value })}
                            className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 outline-none focus:border-indigo-400" />
                          <select value={t.groupId ?? ""} onChange={e => updateTag(t.id, { groupId: e.target.value || null })}
                            className="text-xs border border-gray-200 rounded px-1 py-1 text-gray-600">
                            <option value="">未分類</option>
                            {tagGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                          <span className="text-[11px] text-gray-400 w-10 text-right">{tagUseCount(t.id)}件</span>
                          <button onClick={() => deleteTag(t.id)} className="text-gray-300 hover:text-red-500 text-sm">🗑</button>
                        </div>
                      ))}
                      {tags.length === 0 && <span className="text-xs text-gray-300">（タグなし）</span>}
                    </div>
                  </div>
                )
              ))}

              {/* タグ追加 */}
              <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
                <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border border-gray-200" />
                <input value={newTagName} onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTag()}
                  placeholder="新しいタグ名（例: 見込み客）"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400" />
                <select value={newTagGroup ?? ""} onChange={e => setNewTagGroup(e.target.value || null)}
                  className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600">
                  <option value="">未分類</option>
                  {tagGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button onClick={addTag} className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">＋タグ</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                {friendFields.map(f => (
                  <div key={f.id} className="flex items-center gap-2">
                    <span className="text-gray-400">📝</span>
                    <input defaultValue={f.name} onBlur={e => renameField(f.id, e.target.value)}
                      className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 outline-none focus:border-indigo-400" />
                    <span className="text-[11px] text-gray-400 w-10 text-right">{fieldUseCount(f.id)}件</span>
                    <button onClick={() => deleteField(f.id)} className="text-gray-300 hover:text-red-500 text-sm">🗑</button>
                  </div>
                ))}
                {friendFields.length === 0 && <span className="text-xs text-gray-300">（項目なし）</span>}
              </div>
              <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
                <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addField()}
                  placeholder="新しい項目名（例: 氏名 / メール / 流入経路）"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-400" />
                <button onClick={addField} className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">＋項目</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
