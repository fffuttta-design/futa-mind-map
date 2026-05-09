"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { MindMap } from "@/types";
import { APP_VERSION } from "@/lib/version";

export default function MapsPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingFolderFor, setEditingFolderFor] = useState<string | null>(null);
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "maps"), where("ownerId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MindMap));
      data.sort((a, b) => b.updatedAt - a.updatedAt);
      setMaps(data);
    });
    return unsub;
  }, [user]);

  const folders = useMemo(() => [...new Set(maps.map(m => m.folder).filter(Boolean) as string[])], [maps]);
  const allTags = useMemo(() => [...new Set(maps.flatMap(m => m.tags ?? []))], [maps]);

  const filteredMaps = useMemo(() => {
    return maps.filter(m => {
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
  }, [maps, selectedFolder, selectedTag, searchQuery]);

  const createMap = async () => {
    if (!user || creating) return;
    setCreating(true);
    const now = Date.now();
    const ref = await addDoc(collection(db, "maps"), {
      title: "新しいマップ",
      nodes: [{ id: "root", text: "中心テーマ", x: 0, y: 0, parentId: null, color: "#6366f1" }],
      ownerId: user.uid,
      createdAt: now,
      updatedAt: now,
      folder: selectedFolder ?? null,
      tags: [],
    });
    setCreating(false);
    router.push(`/maps/${ref.id}`);
  };

  const deleteMap = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("このマップを削除しますか？")) return;
    await deleteDoc(doc(db, "maps", id));
  };

  const moveToFolder = async (mapId: string, folder: string) => {
    await updateDoc(doc(db, "maps", mapId), { folder: folder || null });
    setEditingFolderFor(null);
    setNewFolder("");
  };

  const addTag = async (mapId: string, tag: string) => {
    if (!tag.trim()) return;
    const map = maps.find(m => m.id === mapId);
    if (!map) return;
    const tags = [...new Set([...(map.tags ?? []), tag.trim()])];
    await updateDoc(doc(db, "maps", mapId), { tags });
    setNewTag("");
  };

  const removeTag = async (mapId: string, tag: string) => {
    const map = maps.find(m => m.id === mapId);
    if (!map) return;
    await updateDoc(doc(db, "maps", mapId), { tags: (map.tags ?? []).filter(t => t !== tag) });
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">読み込み中...</div>;

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
        <div className="flex items-center gap-4 ml-auto">
          <span className="text-sm text-gray-500">{user?.displayName}</span>
          <button onClick={signOut} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">ログアウト</button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-52 bg-white border-r border-gray-100 p-4 shrink-0">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">フォルダ</p>
          <nav className="space-y-1">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFolder === null ? "bg-indigo-50 text-indigo-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
            >
              📁 すべて
            </button>
            {folders.map(f => (
              <button
                key={f}
                onClick={() => setSelectedFolder(f)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFolder === f ? "bg-indigo-50 text-indigo-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
              >
                📁 {f}
              </button>
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

        <main className="flex-1 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              {selectedFolder ? `📁 ${selectedFolder}` : "すべてのマップ"}
              {searchQuery && <span className="text-base font-normal text-gray-400 ml-2">「{searchQuery}」の検索結果</span>}
            </h2>
            <button
              onClick={createMap}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMaps.map(map => (
                <div
                  key={map.id}
                  onClick={() => router.push(`/maps/${map.id}`)}
                  className="bg-white rounded-xl border border-gray-100 p-5 cursor-pointer hover:shadow-md transition-shadow group relative"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-800 group-hover:text-indigo-600 transition-colors flex-1 pr-2">
                      {map.title}
                    </h3>
                    <button
                      onClick={e => deleteMap(e, map.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none shrink-0"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    {new Date(map.updatedAt).toLocaleDateString("ja-JP")} · {map.nodes.length}ノード
                    {map.isPublic && <span className="ml-2 text-green-500">● 公開中</span>}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-2" onClick={e => e.stopPropagation()}>
                    {(map.tags ?? []).map(tag => (
                      <span key={tag} className="group/tag inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs">
                        {tag}
                        <button
                          onClick={() => removeTag(map.id, tag)}
                          className="text-indigo-300 hover:text-indigo-600 opacity-0 group-hover/tag:opacity-100 transition-opacity leading-none"
                        >×</button>
                      </span>
                    ))}
                    {editingTagsFor === map.id ? (
                      <input
                        autoFocus
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") addTag(map.id, newTag);
                          if (e.key === "Escape") setEditingTagsFor(null);
                        }}
                        onBlur={() => setEditingTagsFor(null)}
                        placeholder="タグ名..."
                        className="text-xs border border-indigo-300 rounded px-2 py-0.5 outline-none w-20"
                      />
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setEditingTagsFor(map.id); setNewTag(""); }}
                        className="text-xs text-gray-300 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100"
                      >＋タグ</button>
                    )}
                  </div>

                  <div onClick={e => e.stopPropagation()}>
                    {editingFolderFor === map.id ? (
                      <div className="flex gap-1">
                        <input
                          autoFocus
                          value={newFolder}
                          onChange={e => setNewFolder(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") moveToFolder(map.id, newFolder);
                            if (e.key === "Escape") setEditingFolderFor(null);
                          }}
                          onBlur={() => setEditingFolderFor(null)}
                          placeholder="フォルダ名..."
                          list={`folders-${map.id}`}
                          className="text-xs border border-gray-300 rounded px-2 py-0.5 outline-none flex-1"
                        />
                        <datalist id={`folders-${map.id}`}>
                          {folders.map(f => <option key={f} value={f} />)}
                        </datalist>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingFolderFor(map.id); setNewFolder(map.folder ?? ""); }}
                        className={`text-xs transition-colors ${map.folder ? "text-gray-500 hover:text-indigo-500" : "text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100"}`}
                      >
                        📁 {map.folder ?? "フォルダに追加"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
