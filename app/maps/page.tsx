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

type FolderMeta = { name: string; icon: string };

const FOLDER_ICONS = ["📁", "📂", "🗂️", "⭐", "🔥", "💼", "🎬", "📱", "💡", "🎯", "📊", "🚀", "❤️", "📌", "🧠", "💰", "🌱", "🏷️", "🔖", "✅"];
const SIDEBAR_MIN = 168, SIDEBAR_MAX = 420, SIDEBAR_DEFAULT = 224;

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

  // フォルダ（名前＋アイコン＋並び順）を端末に保存。空フォルダも保持できる。
  const [folderMeta, setFolderMeta] = useState<FolderMeta[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);

  // マップの手動並び順（ID配列）を端末に保存
  const [order, setOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);       // ドラッグ中のマップ
  const [draggingFolder, setDraggingFolder] = useState<string | null>(null); // ドラッグ中のフォルダ
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null); // "" = すべて（フォルダ解除）

  // サイドバー幅（可変・記憶）
  const [sidebarWidth, setSidebarWidth] = useState<number>(SIDEBAR_DEFAULT);
  // モバイル: サイドバーをドロワーで開閉
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { hasUpdate, latestVersion } = useVersionCheck();

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  // ローカル保存の読み込み（フォルダ／並び順／サイドバー幅）。旧形式(string[])も移行。
  useEffect(() => {
    if (!user) return;
    try {
      const f = localStorage.getItem(`fmm-folders-${user.uid}`);
      if (f) {
        const parsed = JSON.parse(f);
        if (Array.isArray(parsed)) {
          setFolderMeta(parsed.map((x: unknown) =>
            typeof x === "string" ? { name: x, icon: "📁" } : (x as FolderMeta)
          ).filter((x: FolderMeta) => x && x.name));
        }
      }
      const o = localStorage.getItem(`fmm-order-${user.uid}`);
      if (o) setOrder(JSON.parse(o));
      const w = localStorage.getItem(`fmm-sidebar-w-${user.uid}`);
      if (w) setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Number(w) || SIDEBAR_DEFAULT)));
    } catch { /* noop */ }
  }, [user]);

  const persistFolders = useCallback((metas: FolderMeta[]) => {
    setFolderMeta(metas);
    if (user) { try { localStorage.setItem(`fmm-folders-${user.uid}`, JSON.stringify(metas)); } catch { /* noop */ } }
  }, [user]);

  const persistOrder = useCallback((ids: string[]) => {
    setOrder(ids);
    if (user) { try { localStorage.setItem(`fmm-order-${user.uid}`, JSON.stringify(ids)); } catch { /* noop */ } }
  }, [user]);

  const persistSidebar = useCallback((w: number) => {
    setSidebarWidth(w);
    if (user) { try { localStorage.setItem(`fmm-sidebar-w-${user.uid}`, String(w)); } catch { /* noop */ } }
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

  // マップに実在するフォルダ名を folderMeta に取り込む（順序の正はfolderMeta）
  useEffect(() => {
    if (!user) return;
    const known = new Set(folderMeta.map(f => f.name));
    const missing = [...new Set(maps.map(m => m.folder).filter(Boolean) as string[])].filter(n => !known.has(n));
    if (missing.length) persistFolders([...folderMeta, ...missing.map(n => ({ name: n, icon: "📁" }))]);
  }, [maps, folderMeta, user, persistFolders]);

  const folders = folderMeta; // 表示順＝folderMetaの順
  const allTags = useMemo(() => [...new Set(maps.flatMap(m => m.tags ?? []))], [maps]);
  const folderCount = useCallback((f: string) => maps.filter(m => m.folder === f).length, [maps]);
  const iconOf = useCallback((name: string | null | undefined) => folderMeta.find(f => f.name === name)?.icon ?? "📁", [folderMeta]);

  // 手動並び順を優先し、未指定（新規）マップは更新日の新しい順で上に置く
  const sortedMaps = useMemo(() => {
    if (order.length === 0) return maps;
    const idx = new Map(order.map((id, i) => [id, i]));
    return [...maps].sort((a, b) => {
      const ha = idx.has(a.id), hb = idx.has(b.id);
      if (ha && hb) return idx.get(a.id)! - idx.get(b.id)!;
      if (ha) return 1;
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

  // 並び替えはタグ絞り込み・検索が無いときに有効（フォルダ選択中や「すべて」表示でも可）
  const canReorder = selectedTag === null && !searchQuery;
  // 「すべて」表示のときはフォルダごとにセクション分けする
  const grouped = selectedFolder === null && selectedTag === null && !searchQuery;

  const reorderTo = useCallback((dragId: string, targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = sortedMaps.map(m => m.id).filter(id => id !== dragId);
    const ti = ids.indexOf(targetId);
    if (ti < 0) return;
    ids.splice(ti, 0, dragId);
    persistOrder(ids);
  }, [sortedMaps, persistOrder]);

  // フォルダごとのセクション（グループ表示用）。フォルダ順→最後に「フォルダなし」。
  const sections = useMemo(() => {
    const byFolder = new Map<string, MindMap[]>();
    for (const m of filteredMaps) {
      const key = m.folder ?? "";
      const arr = byFolder.get(key);
      if (arr) arr.push(m); else byFolder.set(key, [m]);
    }
    const out: { key: string; icon: string; name: string; items: MindMap[] }[] = [];
    for (const f of folderMeta) {
      const items = byFolder.get(f.name);
      if (items && items.length) out.push({ key: f.name, icon: f.icon, name: f.name, items });
    }
    const none = byFolder.get("");
    if (none && none.length) out.push({ key: "", icon: "🗂️", name: "フォルダなし", items: none });
    return out;
  }, [filteredMaps, folderMeta]);

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
    if (!name) return;
    if (folderMeta.some(f => f.name === name)) { setSelectedFolder(name); return; }
    persistFolders([...folderMeta, { name, icon: "📁" }]);
    setSelectedFolder(name);
  };

  const renameFolder = async (oldName: string) => {
    const name = renameValue.trim();
    setRenamingFolder(null);
    setRenameValue("");
    if (!name || name === oldName) return;
    const targets = maps.filter(m => m.folder === oldName);
    if (targets.length) {
      const batch = writeBatch(db);
      targets.forEach(m => batch.update(doc(db, "maps", m.id), { folder: name }));
      await batch.commit();
    }
    persistFolders(folderMeta.map(f => f.name === oldName ? { ...f, name } : f));
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
    persistFolders(folderMeta.filter(f => f.name !== name));
    if (selectedFolder === name) setSelectedFolder(null);
  };

  const setFolderIcon = (name: string, icon: string) => {
    persistFolders(folderMeta.map(f => f.name === name ? { ...f, icon } : f));
    setIconPickerFor(null);
  };

  const reorderFolder = (dragName: string, targetName: string) => {
    if (!dragName || dragName === targetName) return;
    const arr = folderMeta.filter(f => f.name !== dragName);
    const ti = arr.findIndex(f => f.name === targetName);
    if (ti < 0) return;
    const moved = folderMeta.find(f => f.name === dragName);
    if (!moved) return;
    arr.splice(ti, 0, moved);
    persistFolders(arr);
  };

  // ── サイドバー幅のドラッグ ──────────────────────
  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    let latest = startW;
    const onMove = (ev: MouseEvent) => {
      latest = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + ev.clientX - startX));
      setSidebarWidth(latest);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      persistSidebar(latest);
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const sameFolder = (aId: string | null, bFolder: string | null | undefined) => {
    const a = maps.find(m => m.id === aId);
    return a ? (a.folder ?? "") === (bFolder ?? "") : false;
  };

  const renderRow = (map: MindMap) => (
    <div
      key={map.id}
      draggable
      onDragStart={e => { setDraggingId(map.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragEnd={() => { setDraggingId(null); setDragOverId(null); setDragOverFolder(null); }}
      onDragOver={e => { if (draggingId && draggingId !== map.id && canReorder && sameFolder(draggingId, map.folder)) { e.preventDefault(); setDragOverId(map.id); } }}
      onDragLeave={() => setDragOverId(cur => (cur === map.id ? null : cur))}
      onDrop={e => { if (draggingId && canReorder && sameFolder(draggingId, map.folder)) { e.preventDefault(); reorderTo(draggingId, map.id); setDraggingId(null); setDragOverId(null); } }}
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

      <select
        value={map.folder ?? ""}
        onClick={e => e.stopPropagation()}
        onChange={e => moveToFolder(map.id, e.target.value)}
        title="フォルダを移動"
        className={`shrink-0 text-xs bg-transparent border border-transparent hover:border-gray-200 rounded px-1 py-0.5 outline-none max-w-[9rem] transition-opacity cursor-pointer ${map.folder ? "opacity-100 text-indigo-500" : "opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400"}`}
      >
        <option value="">📁 なし</option>
        {folders.map(f => <option key={f.name} value={f.name}>{f.icon} {f.name}</option>)}
      </select>

      <button
        onClick={e => deleteMap(e, map.id, map.title)}
        title="削除"
        className="shrink-0 text-gray-300 hover:text-red-400 transition-colors text-lg leading-none opacity-0 group-hover:opacity-100 w-5"
      >
        ×
      </button>
    </div>
  );

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 px-3 md:px-6 py-3 flex items-center gap-2 md:gap-4 shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          title="フォルダ"
          className="md:hidden shrink-0 w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 text-xl leading-none"
        >☰</button>
        <div className="flex items-baseline gap-2 shrink-0">
          <h1 className="text-base md:text-xl font-bold text-gray-900">FutaMindMap</h1>
          <span className="hidden sm:inline text-xs text-gray-300 font-mono">v{APP_VERSION}</span>
        </div>
        <div className="flex-1 min-w-0 md:max-w-md">
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

      <div className="flex flex-1 min-h-0">
        {/* モバイル: ドロワーの背景 */}
        {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
        <aside
          className={`bg-white border-r border-gray-100 p-4 shrink-0 relative overflow-y-auto md:overflow-visible fixed md:relative inset-y-0 left-0 z-40 md:z-auto transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
          style={{ width: sidebarWidth }}>
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
              onClick={() => { setSelectedFolder(null); setSidebarOpen(false); }}
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
                key={f.name}
                draggable={renamingFolder !== f.name}
                onDragStart={e => { if (renamingFolder === f.name) return; setDraggingFolder(f.name); e.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={() => { setDraggingFolder(null); setDragOverFolder(null); }}
                onDragOver={e => {
                  if (draggingId || (draggingFolder && draggingFolder !== f.name)) { e.preventDefault(); setDragOverFolder(f.name); }
                }}
                onDragLeave={() => setDragOverFolder(cur => (cur === f.name ? null : cur))}
                onDrop={e => {
                  e.preventDefault();
                  if (draggingId) { moveToFolder(draggingId, f.name); setDraggingId(null); }
                  else if (draggingFolder && draggingFolder !== f.name) { reorderFolder(draggingFolder, f.name); setDraggingFolder(null); }
                  setDragOverFolder(null);
                }}
                className={`group flex items-center gap-0.5 rounded-md relative ${draggingFolder === f.name ? "opacity-40" : ""} ${dragOverFolder === f.name ? "ring-2 ring-indigo-400 bg-indigo-50" : ""}`}
              >
                {renamingFolder === f.name ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") renameFolder(f.name); if (e.key === "Escape") { setRenamingFolder(null); setRenameValue(""); } }}
                    onBlur={() => renameFolder(f.name)}
                    className="flex-1 text-sm border border-indigo-300 rounded-md px-2.5 py-1.5 outline-none"
                  />
                ) : (
                  <>
                    <button
                      onClick={() => setIconPickerFor(cur => cur === f.name ? null : f.name)}
                      title="アイコンを変更"
                      className="shrink-0 w-6 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-base leading-none"
                    >{f.icon}</button>
                    <button
                      onClick={() => { setSelectedFolder(f.name); setSidebarOpen(false); }}
                      className={`flex-1 min-w-0 text-left px-1 py-1.5 rounded-md text-sm truncate transition-colors ${selectedFolder === f.name ? "text-indigo-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
                    >
                      {f.name} <span className="text-gray-400 text-xs">({folderCount(f.name)})</span>
                    </button>
                    {/* 操作ボタンは絶対配置（非表示時に幅を専有せず、名前の見切れを防ぐ） */}
                    <div className="absolute right-0.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-white/95 pl-1 rounded">
                      <button onClick={() => { setRenamingFolder(f.name); setRenameValue(f.name); }} title="名前を変更" className="text-gray-300 hover:text-indigo-500 text-xs w-5 h-5 leading-none">✎</button>
                      <button onClick={() => deleteFolder(f.name)} title="フォルダを削除" className="text-gray-300 hover:text-red-400 text-base w-5 h-5 leading-none">×</button>
                    </div>
                  </>
                )}

                {iconPickerFor === f.name && (
                  <div className="absolute z-30 top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1 w-52" onClick={e => e.stopPropagation()}>
                    {FOLDER_ICONS.map(ic => (
                      <button key={ic} onClick={() => setFolderIcon(f.name, ic)} className={`w-8 h-8 flex items-center justify-center rounded hover:bg-indigo-50 text-lg ${f.icon === ic ? "bg-indigo-100" : ""}`}>{ic}</button>
                    ))}
                  </div>
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

          {/* 幅リサイズハンドル */}
          <div
            onMouseDown={startSidebarResize}
            title="ドラッグで幅を調整"
            className="hidden md:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-200 active:bg-indigo-300 transition-colors"
          />
        </aside>

        <main className="flex-1 p-4 md:p-6 lg:p-8 min-w-0 w-full">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-800 min-w-0 truncate">
              {selectedFolder ? `${iconOf(selectedFolder)} ${selectedFolder}` : "すべてのマップ"}
              <span className="text-sm font-normal text-gray-400 ml-2">{filteredMaps.length}件</span>
              {searchQuery && <span className="hidden sm:inline text-sm font-normal text-gray-400 ml-2">「{searchQuery}」の検索結果</span>}
            </h2>
            <button
              onClick={() => setShowTemplateDialog(true)}
              disabled={creating}
              className="shrink-0 whitespace-nowrap px-3 md:px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium disabled:opacity-50"
            >
              ＋ <span className="hidden sm:inline">新しいマップ</span><span className="sm:hidden">新規</span>
            </button>
          </div>

          {filteredMaps.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-4xl mb-4">🗺️</p>
              <p>{searchQuery ? "検索結果がありません" : "まだマップがありません"}</p>
            </div>
          ) : grouped ? (
            <div className="space-y-6">
              {sections.map(sec => (
                <section key={sec.key || "_none"}>
                  <div className="flex items-center gap-2 px-1 mb-2 text-sm font-semibold text-gray-500">
                    <span className="text-base">{sec.icon}</span>
                    <span>{sec.name}</span>
                    <span className="text-xs text-gray-400 font-normal">{sec.items.length}</span>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                    {sec.items.map(renderRow)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {filteredMaps.map(renderRow)}
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
