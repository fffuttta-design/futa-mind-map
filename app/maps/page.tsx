"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { MindMap, MindMapNode } from "@/types";
import { APP_VERSION } from "@/lib/version";
import SettingsModal from "@/components/SettingsModal";
import { useVersionCheck } from "@/hooks/useVersionCheck";

export default function MapsPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [creating, setCreating] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 空フォルダも保持できるよう、フォルダ名の一覧を端末に保存（マップに紐付く前でも消えない）
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // 手動並び替えの順序（マップID配列）を端末に保存。ドラッグ＆ドロップで更新。
  const [order, setOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null); // "" = すべて（フォルダなし）
  const { hasUpdate, latestVersion } = useVersionCheck();

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  // フォルダ名一覧・並び順のローカル保存の読み込み
  useEffect(() => {
    if (!user) return;
    try {
      const f = localStorage.getItem(`fmm-folders-${user.uid}`);
      if (f) setExtraFolders(JSON.parse(f));
      const o = localStorage.getItem(`fmm-order-${user.uid}`);
      if (o) setOrder(JSON.parse(o));
    } catch { /* noop */ }
  }, [user]);

  const persistFolders = useCallback((names: string[]) => {
    setExtraFolders(names);
    if (user) {
      try { localStorage.setItem(`fmm-folders-${user.uid}`, JSON.stringify(names)); } catch { /* noop */ }
    }
  }, [user]);

  const persistOrder = useCallback((ids: string[]) => {
    setOrder(ids);
    if (user) {
      try { localStorage.setItem(`fmm-order-${user.uid}`, JSON.stringify(ids)); } catch { /* noop */ }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "maps"), where("ownerId", "==", user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLoadError(null);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MindMap));
        data.sort((a, b) => b.updatedAt - a.updatedAt);
        setMaps(data);
      },
      (err) => {
        console.error("[fmm:maps] 取得失敗", err);
        setLoadError(`${err.code ?? "error"}: ${err.message}`);
      }
    );
    return unsub;
  }, [user]);

  // マップに実在するフォルダ ＋ 空フォルダ（ローカル保存）を統合
  const folders = useMemo(() => {
    const fromMaps = maps.map(m => m.folder).filter(Boolean) as string[];
    return [...new Set([...extraFolders, ...fromMaps])].sort((a, b) => a.localeCompare(b, "ja"));
  }, [maps, extraFolders]);
  const allTags = useMemo(() => [...new Set(maps.flatMap(m => m.tags ?? []))], [maps]);
  const folderCount = useCallback((f: string) => maps.filter(m => m.folder === f).length, [maps]);

  // 手動並び順を優先し、未指定（新規）マップは更新日の新しい順で上に置く
  const sortedMaps = useMemo(() => {
    if (order.length === 0) return maps;
    const idx = new Map(order.map((id, i) => [id, i]));
    return [...maps].sort((a, b) => {
      const ha = idx.has(a.id), hb = idx.has(b.id);
      if (ha && hb) return idx.get(a.id)! - idx.get(b.id)!;
      if (ha) return 1;   // 並び順に無い（新規）を上へ
      if (hb) return -1;
      return b.updatedAt - a.updatedAt;
    });
  }, [maps, order]);

  const filteredMaps = useMemo(() => {
    return sortedMaps.filter(m => {
      if (selectedFolder !== null && m.folder !== selectedFolder) return false;
      if (selectedTag !== null && !(m.tags ?? []).includes(selectedTag)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inTitle = m.title.toLowerCase().includes(q);
        const inNodes = m.nodes.some(n => n.text.toLowerCase().includes(q));
        if (!inTitle && !inNodes) return false;
      }
      return true;
    });
  }, [sortedMaps, selectedFolder, selectedTag, searchQuery]);

  // 並び替えは「すべて（絞り込みなし）」表示のときだけ有効
  const canReorder = selectedFolder === null && selectedTag === null && !searchQuery;

  const reorderTo = useCallback((dragId: string, targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = sortedMaps.map(m => m.id).filter(id => id !== dragId);
    const ti = ids.indexOf(targetId);
    if (ti < 0) return;
    ids.splice(ti, 0, dragId);
    persistOrder(ids);
  }, [sortedMaps, persistOrder]);

  const LINE_TEMPLATE_NODES: MindMapNode[] = [
    { id: "root",  text: "LINEシナリオ設計", x: 0,   y: 0,    parentId: null,  color: "#06C755" },
    { id: "n1",    text: "友達追加時",        x: 240,  y: -140, parentId: "root", color: "#05b34c" },
    { id: "n1-1",  text: "ウェルカムメッセージ", x: 520, y: -200, parentId: "n1",  color: "#0891b2" },
    { id: "n1-2",  text: "初回アンケート",    x: 520,  y: -100, parentId: "n1",  color: "#0891b2" },
    { id: "n2",    text: "ステップ配信",      x: 240,  y: 0,    parentId: "root", color: "#05b34c" },
    { id: "n2-1",  text: "1日後 配信",       x: 520,  y: -30,  parentId: "n2",  color: "#6366f1" },
    { id: "n2-2",  text: "3日後 配信",       x: 520,  y: 60,   parentId: "n2",  color: "#6366f1" },
    { id: "n3",    text: "キーワード応答",    x: 240,  y: 140,  parentId: "root", color: "#05b34c" },
    { id: "n3-1",  text: "「詳細」と返信",   x: 520,  y: 140,  parentId: "n3",  color: "#f59e0b" },
  ];

  const createMap = async (template: "blank" | "line") => {
    if (!user || creating) return;
    setCreating(true);
    setShowTemplateDialog(false);
    const now = Date.now();
    const isLine = template === "line";
    const ref = await addDoc(collection(db, "maps"), {
      title: isLine ? "LINEシナリオ設計" : "新しいマップ",
      nodes: isLine
        ? LINE_TEMPLATE_NODES
        : [{ id: "root", text: "中心テーマ", x: 0, y: 0, parentId: null, color: "#6366f1" }],
      ownerId: user.uid,
      createdAt: now,
      updatedAt: now,
      folder: selectedFolder ?? null,
      tags: isLine ? ["LINE"] : [],
      mode: isLine ? "line" : "mindmap",
    });
    setCreating(false);
    router.push(`/maps/${ref.id}`);
  };

  const deleteMap = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (!confirm(`「${title}」を削除しますか？`)) return;
    await deleteDoc(doc(db, "maps", id));
  };

  const moveToFolder = async (mapId: string, folder: string) => {
    await updateDoc(doc(db, "maps", mapId), { folder: folder || null });
  };

  const removeTag = async (mapId: string, tag: string) => {
    const map = maps.find(m => m.id === mapId);
    if (!map) return;
    await updateDoc(doc(db, "maps", mapId), { tags: (map.tags ?? []).filter(t => t !== tag) });
  };

  // ── フォルダ操作 ────────────────────────────────
  const createFolder = () => {
    const name = newFolderName.trim();
    setCreatingFolder(false);
    setNewFolderName("");
    if (!name || folders.includes(name)) { if (name) setSelectedFolder(name); return; }
    persistFolders([...extraFolders, name]);
    setSelectedFolder(name);
  };

  const renameFolder = async (oldName: string) => {
    const name = renameValue.trim();
    setRenamingFolder(null);
    setRenameValue("");
    if (!name || name === oldName) return;
    // 該当フォルダの全マップを一括で付け替え
    const targets = maps.filter(m => m.folder === oldName);
    if (targets.length) {
      const batch = writeBatch(db);
      targets.forEach(m => batch.update(doc(db, "maps", m.id), { folder: name }));
      await batch.commit();
    }
    persistFolders([...new Set(extraFolders.filter(f => f !== oldName).concat(name))]);
    if (selectedFolder === oldName) setSelectedFolder(name);
  };

  const deleteFolder = async (name: string) => {
    const count = folderCount(name);
    if (!confirm(count ? `フォルダ「${name}」を削除しますか？（中の${count}件はフォルダなしに戻ります。マップ自体は消えません）` : `空のフォルダ「${name}」を削除しますか？`)) return;
    const targets = maps.filter(m => m.folder === name);
    if (targets.length) {
      const batch = writeBatch(db);
      targets.forEach(m => batch.update(doc(db, "maps", m.id), { folder: null }));
      await batch.commit();
    }
    persistFolders(extraFolders.filter(f => f !== name));
    if (selectedFolder === name) setSelectedFolder(null);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">読み込み中...</div>;

  const folderBtnBase = "flex-1 text-left px-2.5 py-1.5 rounded-md text-sm truncate transition-colors";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-baseline gap-2 shrink-0">
          <h1 className="text-xl font-bold text-gray-900">FutaMindMap</h1>
          <span className="text-xs text-gray-300 font-mono">v{APP_VERSION}</span>
        </div>
        <div className="flex-1 max-w-md">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="マップ・ノードを検索..."
            className="w-full px-4 py-2 text-sm bg-gray-100 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-indigo-300 transition-all"
          />
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-sm text-gray-400 hidden sm:inline" title={user?.email ?? ""}>
            {user?.displayName}
          </span>
          <button
            onClick={() => setShowSettings(true)}
            title="設定"
            className="relative w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            {hasUpdate && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-400 rounded-full border-2 border-white" />}
          </button>
        </div>
      </header>

      {loadError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-700">
          ⚠️ マップの取得に失敗しました: <code className="text-xs">{loadError}</code>
        </div>
      )}

      <div className="flex flex-1">
        <aside className="w-56 bg-white border-r border-gray-100 p-4 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">フォルダ</p>
            <button
              onClick={() => { setCreatingFolder(true); setNewFolderName(""); }}
              title="新規フォルダ"
              className="text-gray-400 hover:text-indigo-500 transition-colors text-sm leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-indigo-50"
            >＋</button>
          </div>
          <nav className="space-y-0.5">
            <button
              onClick={() => setSelectedFolder(null)}
              onDragOver={e => { if (draggingId) { e.preventDefault(); setDragOverFolder(""); } }}
              onDragLeave={() => setDragOverFolder(cur => (cur === "" ? null : cur))}
              onDrop={e => { if (draggingId) { e.preventDefault(); moveToFolder(draggingId, ""); setDraggingId(null); setDragOverFolder(null); } }}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors ${dragOverFolder === "" ? "ring-2 ring-indigo-400 bg-indigo-50" : selectedFolder === null ? "bg-indigo-50 text-indigo-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
            >
              🗂️ すべて <span className="text-gray-400 text-xs">({maps.length})</span>
            </button>

            {creatingFolder && (
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); } }}
                onBlur={createFolder}
                placeholder="フォルダ名..."
                className="w-full text-sm border border-indigo-300 rounded-md px-2.5 py-1.5 outline-none"
              />
            )}

            {folders.map(f => (
              <div
                key={f}
                className={`group flex items-center gap-1 rounded-md ${dragOverFolder === f ? "ring-2 ring-indigo-400 bg-indigo-50" : ""}`}
                onDragOver={e => { if (draggingId) { e.preventDefault(); setDragOverFolder(f); } }}
                onDragLeave={() => setDragOverFolder(cur => (cur === f ? null : cur))}
                onDrop={e => { if (draggingId) { e.preventDefault(); moveToFolder(draggingId, f); setDraggingId(null); setDragOverFolder(null); } }}
              >
                {renamingFolder === f ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") renameFolder(f); if (e.key === "Escape") { setRenamingFolder(null); setRenameValue(""); } }}
                    onBlur={() => renameFolder(f)}
                    className="flex-1 text-sm border border-indigo-300 rounded-md px-2.5 py-1.5 outline-none"
                  />
                ) : (
                  <>
                    <button
                      onClick={() => setSelectedFolder(f)}
                      className={`${folderBtnBase} ${selectedFolder === f ? "bg-indigo-50 text-indigo-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      📁 {f} <span className="text-gray-400 text-xs">({folderCount(f)})</span>
                    </button>
                    <button onClick={() => { setRenamingFolder(f); setRenameValue(f); }} title="名前を変更" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-indigo-500 text-xs w-5 h-5 shrink-0 transition-all">✎</button>
                    <button onClick={() => deleteFolder(f)} title="フォルダを削除" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-sm w-5 h-5 shrink-0 transition-all leading-none">×</button>
                  </>
                )}
              </div>
            ))}
          </nav>

          {allTags.length > 0 && (
            <>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-6 mb-2">タグ</p>
              <div className="flex flex-wrap gap-1">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-2 py-0.5 rounded-full text-xs transition-colors ${selectedTag === tag ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        <main className="flex-1 p-6 lg:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {selectedFolder ? `📁 ${selectedFolder}` : "すべてのマップ"}
              <span className="text-sm font-normal text-gray-400 ml-2">{filteredMaps.length}件</span>
              {searchQuery && <span className="text-sm font-normal text-gray-400 ml-2">「{searchQuery}」の検索結果</span>}
            </h2>
            <button
              onClick={() => setShowTemplateDialog(true)}
              disabled={creating}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium disabled:opacity-50"
            >
              ＋ 新しいマップ
            </button>
          </div>

          {filteredMaps.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-4xl mb-4">🗺️</p>
              <p>{searchQuery ? "検索結果がありません" : "まだマップがありません"}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {filteredMaps.map(map => (
                <div
                  key={map.id}
                  draggable
                  onDragStart={e => { setDraggingId(map.id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { setDraggingId(null); setDragOverId(null); setDragOverFolder(null); }}
                  onDragOver={e => { if (draggingId && draggingId !== map.id && canReorder) { e.preventDefault(); setDragOverId(map.id); } }}
                  onDragLeave={() => setDragOverId(cur => (cur === map.id ? null : cur))}
                  onDrop={e => { if (draggingId && canReorder) { e.preventDefault(); reorderTo(draggingId, map.id); setDraggingId(null); setDragOverId(null); } }}
                  onClick={() => router.push(`/maps/${map.id}`)}
                  className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer group transition-colors ${draggingId === map.id ? "opacity-40" : "hover:bg-indigo-50/40"} ${dragOverId === map.id ? "border-t-2 border-indigo-400" : "border-t-2 border-transparent"}`}
                >
                  <span className="shrink-0 w-4 text-center text-gray-300 group-hover:text-gray-400 cursor-grab active:cursor-grabbing select-none" title="ドラッグで並び替え・フォルダへ移動">⠿</span>
                  <span className="shrink-0 text-base w-5 text-center" title={map.mode === "line" ? "LINE" : "マインドマップ"}>
                    {map.mode === "line" ? "📱" : "🗺️"}
                  </span>

                  <span className="font-medium text-gray-800 group-hover:text-indigo-600 transition-colors truncate min-w-0">
                    {map.title}
                  </span>

                  {map.isPublic && <span className="shrink-0 text-[10px] text-green-600" title="公開中">●公開</span>}

                  {/* タグ（小さく） */}
                  <div className="hidden md:flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {(map.tags ?? []).slice(0, 3).map(tag => (
                      <span key={tag} className="group/tag inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded text-[11px]">
                        {tag}
                        <button onClick={() => removeTag(map.id, tag)} className="opacity-0 group-hover/tag:opacity-100 text-indigo-300 hover:text-indigo-600 leading-none">×</button>
                      </span>
                    ))}
                  </div>

                  <span className="ml-auto shrink-0 text-xs text-gray-400 whitespace-nowrap tabular-nums">
                    {new Date(map.updatedAt).toLocaleDateString("ja-JP")} · {map.nodes.length}ノード
                  </span>

                  {/* フォルダ移動（ホバーで表示） */}
                  <select
                    value={map.folder ?? ""}
                    onClick={e => e.stopPropagation()}
                    onChange={e => moveToFolder(map.id, e.target.value)}
                    title="フォルダを移動"
                    className="shrink-0 text-xs text-gray-400 bg-transparent border border-transparent hover:border-gray-200 rounded px-1 py-0.5 outline-none max-w-[7rem] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                  >
                    <option value="">📁 なし</option>
                    {folders.map(f => <option key={f} value={f}>📁 {f}</option>)}
                  </select>

                  <button
                    onClick={e => deleteMap(e, map.id, map.title)}
                    title="削除"
                    className="shrink-0 text-gray-300 hover:text-red-400 transition-colors text-lg leading-none opacity-0 group-hover:opacity-100 w-5"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      {/* テンプレート選択ダイアログ */}
      {showTemplateDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowTemplateDialog(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-[420px]"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-1">テンプレートを選択</h3>
            <p className="text-xs text-gray-400 mb-5">作成後にモードを変更することはできません</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => createMap("blank")}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left"
              >
                <span className="text-4xl">🗺️</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">空白マップ</p>
                  <p className="text-xs text-gray-400 mt-0.5">自由に使えるマインドマップ</p>
                </div>
              </button>
              <button
                onClick={() => createMap("line")}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-[#06C755] hover:bg-green-50 transition-colors text-left"
              >
                <span className="text-4xl">📱</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">LINE構築設計</p>
                  <p className="text-xs text-gray-400 mt-0.5">シナリオ設計＋配信プレビュー</p>
                </div>
              </button>
            </div>
            <button onClick={() => setShowTemplateDialog(false)} className="mt-4 w-full py-2 text-sm text-gray-400 hover:text-gray-600">キャンセル</button>
          </div>
        </div>
      )}

      {/* 全体設定モーダル */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          initialHasUpdate={hasUpdate}
          initialLatestVersion={latestVersion}
          onLogout={signOut}
          accountLabel={user?.email ?? user?.displayName ?? undefined}
        />
      )}
    </div>
  );
}
