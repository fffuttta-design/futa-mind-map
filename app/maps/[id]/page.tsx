"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, addDoc, collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { MindMap, MindMapNode, HistoryEntry } from "@/types";
import MindMapCanvas from "@/components/MindMapCanvas";

function groupByDate(entries: HistoryEntry[]) {
  const groups: { date: string; entries: HistoryEntry[] }[] = [];
  const seen = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const date = new Date(entry.savedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
    if (!seen.has(date)) { const arr: HistoryEntry[] = []; seen.set(date, arr); groups.push({ date, entries: arr }); }
    seen.get(date)!.push(entry);
  }
  return groups;
}

export default function MapEditorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [map, setMap] = useState<MindMap | null>(null);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [showShareUrl, setShowShareUrl] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyMenuId, setHistoryMenuId] = useState<string | null>(null);
  const [historyPreview, setHistoryPreview] = useState<HistoryEntry | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportRef = useRef<{ exportSVG: () => void; exportPNG: () => void } | null>(null);
  const lastHistorySave = useRef<number>(0);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "maps", id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as MindMap;
        setMap(data);
        setTitle(data.title);
        setIsPublic(data.isPublic ?? false);
      }
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, "maps", id, "history"), orderBy("savedAt", "desc"), limit(50));
    const unsub = onSnapshot(q, snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as HistoryEntry)));
    });
    return unsub;
  }, [id]);

  const saveNodes = useCallback((nodes: MindMapNode[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const now = Date.now();
      await updateDoc(doc(db, "maps", id), { nodes, updatedAt: now });
      if (now - lastHistorySave.current >= 60 * 1000) {
        lastHistorySave.current = now;
        await addDoc(collection(db, "maps", id, "history"), { nodes, savedAt: now });
      }
    }, 800);
  }, [id]);

  const saveTitle = async (newTitle: string) => {
    await updateDoc(doc(db, "maps", id), { title: newTitle, updatedAt: Date.now() });
  };

  const togglePublic = async () => {
    const next = !isPublic;
    setIsPublic(next);
    await updateDoc(doc(db, "maps", id), { isPublic: next });
    if (next) setShowShareUrl(true);
  };

  const restoreVersion = useCallback(async (historyNodes: MindMapNode[]) => {
    const ts = Date.now();
    await updateDoc(doc(db, "maps", id), { nodes: historyNodes, updatedAt: ts });
    setHistoryMenuId(null);
    setShowHistory(false);
  }, [id]);

  const createCopy = useCallback(async (historyNodes: MindMapNode[]) => {
    const ts = Date.now();
    await addDoc(collection(db, "maps"), {
      title: `${title} のコピー`,
      nodes: historyNodes,
      ownerId: user!.uid,
      createdAt: ts,
      updatedAt: ts,
      folder: null,
      tags: [],
    });
    setHistoryMenuId(null);
    router.push("/maps");
  }, [title, user, router]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${id}` : "";

  // ④ Version history preview modal
  if (historyPreview) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold text-gray-700">
            🕐 プレビュー — {new Date(historyPreview.savedAt).toLocaleString("ja-JP", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">読み取り専用</span>
          <div className="flex-1" />
          <button
            onClick={async () => { await restoreVersion(historyPreview.nodes); setHistoryPreview(null); }}
            className="px-4 py-1.5 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
          >このバージョンを復元する</button>
          <button
            onClick={() => setHistoryPreview(null)}
            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >閉じる</button>
        </div>
        <div className="flex-1 overflow-hidden">
          <MindMapCanvas initialNodes={historyPreview.nodes} onNodesChange={() => {}} readOnly />
        </div>
      </div>
    );
  }

  if (loading || !map) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">読み込み中...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => router.push("/maps")} className="text-gray-400 hover:text-gray-600 transition-colors text-sm shrink-0">
          ← 戻る
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => saveTitle(title)}
          onKeyDown={(e) => e.key === "Enter" && saveTitle(title)}
          className="text-lg font-semibold text-gray-800 bg-transparent border-none outline-none focus:bg-gray-50 rounded px-2 py-1 flex-1"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => exportRef.current?.exportSVG()}
            className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >SVG</button>
          <button
            onClick={() => exportRef.current?.exportPNG()}
            className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >PNG</button>
          <button
            onClick={togglePublic}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${isPublic ? "bg-green-100 text-green-600 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >{isPublic ? "🔓 公開中" : "🔒 共有"}</button>
          <button
            onClick={() => setShowHistory(h => !h)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showHistory ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >🕐 履歴</button>
          <span className="text-xs text-gray-400">自動保存</span>
        </div>
      </header>

      {showShareUrl && isPublic && (
        <div className="bg-green-50 border-b border-green-100 px-4 py-2 flex items-center gap-3">
          <span className="text-xs text-green-700 font-medium">共有URL:</span>
          <code className="text-xs text-green-800 bg-green-100 px-2 py-0.5 rounded flex-1 truncate">{shareUrl}</code>
          <button onClick={() => navigator.clipboard.writeText(shareUrl)} className="text-xs text-green-600 hover:text-green-800 shrink-0">コピー</button>
          <button onClick={() => setShowShareUrl(false)} className="text-green-400 hover:text-green-600 text-lg leading-none">×</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <MindMapCanvas initialNodes={map.nodes} onNodesChange={saveNodes} exportRef={exportRef} />
        </div>

        {showHistory && (
          <div className="w-64 bg-white border-l border-gray-100 flex flex-col overflow-hidden shrink-0">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">バージョン履歴</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-3" onClick={() => setHistoryMenuId(null)}>
              {history.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-8">まだ履歴がありません<br />編集すると1分ごとに保存されます</p>
              )}
              {groupByDate(history).map(group => (
                <div key={group.date}>
                  <p className="text-xs text-gray-400 font-semibold mt-3 mb-1 px-1">{group.date}</p>
                  {group.entries.map(entry => (
                    <div key={entry.id} className="relative flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group">
                      <button
                        onClick={e => { e.stopPropagation(); setHistoryPreview(entry); }}
                        className="text-sm text-gray-700 hover:text-indigo-600 text-left flex-1"
                      >
                        {new Date(entry.savedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setHistoryMenuId(historyMenuId === entry.id ? null : entry.id); }}
                        className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none px-1"
                      >···</button>
                      {historyMenuId === entry.id && (
                        <div
                          className="absolute right-2 top-9 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-44"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => restoreVersion(entry.nodes)}
                            className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                          >このバージョンを復元する</button>
                          <button
                            onClick={() => createCopy(entry.nodes)}
                            className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50"
                          >コピーを作成する</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
