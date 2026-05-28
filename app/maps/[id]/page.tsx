"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc, addDoc, collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { MindMap, MindMapNode, StickyNote, CanvasArea, LineMessageData, HistoryEntry } from "@/types";
import MindMapCanvas from "@/components/MindMapCanvas";
import NotePanel from "@/components/NotePanel";
import LineMessagePanel from "@/components/LineMessagePanel";
import LinePreviewModal from "@/components/LinePreviewModal";
import SettingsModal from "@/components/SettingsModal";
import PageSettingsModal from "@/components/PageSettingsModal";
import { useVersionCheck } from "@/hooks/useVersionCheck";

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
  const [edgeStyle, setEdgeStyle] = useState<"curve" | "straight">("curve");
  const [defaultShape, setDefaultShape] = useState<"pill" | "rect" | "circle" | "diamond" | "text">("pill");
  const [nodeBorderWidth, setNodeBorderWidth] = useState<number>(0);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [showShareUrl, setShowShareUrl] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<{ msg: LineMessageData; name: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyMenuId, setHistoryMenuId] = useState<string | null>(null);
  const [historyPreview, setHistoryPreview] = useState<HistoryEntry | null>(null);
  const [showManualSave, setShowManualSave] = useState(false);
  const [manualSaveName, setManualSaveName] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saving" | "ok" | "error">("idle");
  const [noteOpenNodeId, setNoteOpenNodeId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string>("");
  const { hasUpdate, latestVersion } = useVersionCheck();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportRef = useRef<{ exportSVG: () => void; exportPNG: () => void } | null>(null);
  const lastHistorySave = useRef<number>(0);
  const flushSavesRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // 保存待ちデータを種類別に蓄積（タイマーが上書きされても消えないよう）
  const pendingSave = useRef<{
    nodes?: MindMapNode[];
    stickyNotes?: StickyNote[];
    areas?: CanvasArea[];
  }>({});

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "maps", id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as MindMap;
        console.log("[fmm:snap] received", { nodeCount: data.nodes?.length, fromCache: snap.metadata.fromCache });
        setMap(data);
        setTitle(data.title);
        setIsPublic(data.isPublic ?? false);
        setEdgeStyle(data.edgeStyle ?? "curve");
        setDefaultShape(data.defaultShape ?? "pill");
        setNodeBorderWidth(data.nodeBorderWidth ?? 0);
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

  // pending に溜め込んで一括フラッシュ（タイマー共有でデータが消えるバグを防止）
  const flushSaves = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const p = pendingSave.current;
    if (Object.keys(p).length === 0) { console.log("[fmm:save] skip (nothing pending)"); return; }
    pendingSave.current = {};
    const now = Date.now();
    console.log("[fmm:save] writing", { fields: Object.keys(p), nodeCount: p.nodes?.length, id });
    setSaveStatus("saving");
    try {
      const clean = JSON.parse(JSON.stringify({ ...p, updatedAt: now }));
      await updateDoc(doc(db, "maps", id), clean);
      console.log("[fmm:save] ✅ success");
      setSaveStatus("ok");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[fmm:save] ❌ FAILED", e);
      pendingSave.current = p;  // 失敗したら戻す
      setSaveStatus("error");
      setSaveError(msg);
    }
    if (p.nodes && now - lastHistorySave.current >= 60 * 1000) {
      lastHistorySave.current = now;
      try {
        await addDoc(collection(db, "maps", id, "history"), { nodes: p.nodes, savedAt: now });
      } catch (e) {
        console.error("[fmm:history] ❌ FAILED", e);
      }
    }
  }, [id]);

  useEffect(() => { flushSavesRef.current = flushSaves; }, [flushSaves]);
  useEffect(() => { return () => { flushSavesRef.current(); }; }, []);
  useEffect(() => {
    const handle = () => { flushSavesRef.current(); };
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("pending");
    saveTimer.current = setTimeout(() => flushSaves(), 800);
  }, [flushSaves]);

  const saveNodes = useCallback((nodes: MindMapNode[]) => {
    pendingSave.current = { ...pendingSave.current, nodes };
    scheduleSave();
  }, [scheduleSave]);

  const saveStickyNotes = useCallback((stickyNotes: StickyNote[]) => {
    pendingSave.current = { ...pendingSave.current, stickyNotes };
    scheduleSave();
  }, [scheduleSave]);

  const updateNoteContent = useCallback((nodeId: string, noteContent: string) => {
    if (!map) return;
    const updated = map.nodes.map(n => n.id === nodeId ? { ...n, noteContent } : n);
    saveNodes(updated);
  }, [map, saveNodes]);

  const saveAreas = useCallback((areas: CanvasArea[]) => {
    pendingSave.current = { ...pendingSave.current, areas };
    scheduleSave();
  }, [scheduleSave]);

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
    setHistoryPreview(null);
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
    await flushSaves();
    router.push("/maps");
  }, [title, user, router, flushSaves]);

  const saveManualSnapshot = async () => {
    if (!map) return;
    const name = manualSaveName.trim() || undefined;
    await addDoc(collection(db, "maps", id, "history"), {
      nodes: map.nodes,
      savedAt: Date.now(),
      ...(name ? { name } : {}),
    });
    setManualSaveName("");
    setShowManualSave(false);
  };

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${id}` : "";

  if (loading || !map) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">読み込み中...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={async () => { await flushSaves(); router.push("/maps"); }} className="text-gray-400 hover:text-gray-600 transition-colors text-sm shrink-0">
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
            onClick={() => setShowPageSettings(true)}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >🗺️ ページ設定</button>
          <button
            onClick={togglePublic}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${isPublic ? "bg-green-100 text-green-600 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >{isPublic ? "🔓 公開中" : "🔒 共有"}</button>
          <button
            onClick={() => setShowHistory(h => !h)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${showHistory ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >🕐 履歴</button>
          {saveStatus === "idle" && <span className="text-xs text-gray-300">自動保存</span>}
          {saveStatus === "pending" && <span className="text-xs text-yellow-400">● 保存待ち</span>}
          {saveStatus === "saving" && <span className="text-xs text-blue-400">● 保存中...</span>}
          {saveStatus === "ok" && <span className="text-xs text-green-500">✓ 保存済み</span>}
          {saveStatus === "error" && (
            <span className="text-xs text-red-500 font-semibold" title={saveError}>
              ✕ 保存失敗: {saveError.slice(0, 60)}
            </span>
          )}
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
        <div className="flex-1 overflow-hidden relative">
          {/* ① 履歴プレビュー中はバナーを表示して readOnly キャンバスに切り替え（サイドバーはそのまま）*/}
          {historyPreview && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center gap-3 shrink-0">
              <span className="text-xs font-semibold text-indigo-700">
                🕐 プレビュー — {new Date(historyPreview.savedAt).toLocaleString("ja-JP", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-xs text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded">読み取り専用</span>
              <div className="flex-1" />
              <button
                onClick={async () => { await restoreVersion(historyPreview.nodes); }}
                className="px-3 py-1 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
              >このバージョンを復元する</button>
              <button
                onClick={() => setHistoryPreview(null)}
                className="px-3 py-1 text-xs bg-white text-gray-600 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
              >閉じる</button>
            </div>
          )}
          {historyPreview
            ? <MindMapCanvas initialNodes={historyPreview.nodes} onNodesChange={() => {}} readOnly edgeStyle={edgeStyle} />
            : <MindMapCanvas
                initialNodes={map.nodes}
                onNodesChange={saveNodes}
                initialStickyNotes={map.stickyNotes}
                onStickyNotesChange={saveStickyNotes}
                initialAreas={map.areas}
                onAreasChange={saveAreas}
                onSelectionChange={setSelectedNodeId}
                onNoteOpen={setNoteOpenNodeId}
                mode={map.mode ?? "mindmap"}
                exportRef={exportRef}
                edgeStyle={edgeStyle}
                defaultShape={defaultShape}
                nodeBorderWidth={nodeBorderWidth}
              />
          }

          {/* 全体設定ボタン（右下固定） */}
          <button
            onClick={() => setShowSettings(true)}
            title="アプリ設定"
            className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all backdrop-blur-sm z-20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            {hasUpdate && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-400 rounded-full border-2 border-white" />
            )}
          </button>
        </div>

        {/* LINE メッセージパネル（LINEモード時は常時表示） */}
        {map.mode === "line" && !showHistory && !historyPreview && (
          <div className="w-72 bg-white border-l border-gray-100 flex flex-col overflow-hidden shrink-0">
            <LineMessagePanel
              node={selectedNodeId ? (map.nodes.find(n => n.id === selectedNodeId) ?? null) : null}
              onUpdate={updates => {
                const updated = map.nodes.map(n => n.id === selectedNodeId ? { ...n, ...updates } : n);
                saveNodes(updated);
              }}
              onPreview={(msg) => {
                const node = map.nodes.find(n => n.id === selectedNodeId);
                setPreviewMessage({ msg, name: node?.text ?? "配信プレビュー" });
              }}
            />
          </div>
        )}

        {noteOpenNodeId && (() => {
          const noteNode = map.nodes.find(n => n.id === noteOpenNodeId);
          return noteNode ? (
            <NotePanel
              node={noteNode}
              onUpdate={(content) => updateNoteContent(noteOpenNodeId, content)}
              onClose={() => setNoteOpenNodeId(null)}
            />
          ) : null;
        })()}

        {showHistory && (
          <div className="w-64 bg-white border-l border-gray-100 flex flex-col overflow-hidden shrink-0">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">バージョン履歴</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowManualSave(v => !v); setManualSaveName(""); }}
                  className="text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors font-medium"
                >💾 保存</button>
                <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              </div>
            </div>
            {/* 手動保存フォーム */}
            {showManualSave && (
              <div className="px-3 py-2.5 border-b border-gray-100 bg-indigo-50/50">
                <p className="text-xs text-indigo-600 font-medium mb-1.5">この状態を保存</p>
                <input
                  type="text"
                  value={manualSaveName}
                  onChange={e => setManualSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveManualSnapshot(); if (e.key === "Escape") setShowManualSave(false); }}
                  placeholder="保存名（省略可）"
                  autoFocus
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 outline-none focus:border-indigo-400 bg-white mb-2"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={saveManualSnapshot}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors font-medium"
                  >保存する</button>
                  <button
                    onClick={() => setShowManualSave(false)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                  >キャンセル</button>
                </div>
              </div>
            )}
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
                        className="text-sm text-gray-700 hover:text-indigo-600 text-left flex-1 min-w-0 transition-colors"
                      >
                        <span className="block truncate">
                          {entry.name
                            ? <><span className="font-medium text-indigo-600">📌 {entry.name}</span></>
                            : new Date(entry.savedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
                          }
                        </span>
                        {entry.name && (
                          <span className="text-xs text-gray-400">
                            {new Date(entry.savedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setHistoryMenuId(historyMenuId === entry.id ? null : entry.id); }}
                        className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none px-1 shrink-0"
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

      {/* LINE プレビューモーダル */}
      {previewMessage && (
        <LinePreviewModal
          message={previewMessage.msg}
          nodeName={previewMessage.name}
          onClose={() => setPreviewMessage(null)}
        />
      )}

      {/* 全体設定モーダル */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          initialHasUpdate={hasUpdate}
          initialLatestVersion={latestVersion}
          onBeforeReload={flushSaves}
        />
      )}

      {/* ページ設定モーダル */}
      {showPageSettings && (
        <PageSettingsModal
          edgeStyle={edgeStyle}
          defaultShape={defaultShape}
          nodeBorderWidth={nodeBorderWidth}
          onEdgeStyleChange={async (v) => {
            setEdgeStyle(v);
            await updateDoc(doc(db, "maps", id), { edgeStyle: v });
          }}
          onDefaultShapeChange={async (v) => {
            setDefaultShape(v);
            await updateDoc(doc(db, "maps", id), { defaultShape: v });
          }}
          onNodeBorderWidthChange={async (v) => {
            setNodeBorderWidth(v);
            await updateDoc(doc(db, "maps", id), { nodeBorderWidth: v });
          }}
          onClose={() => setShowPageSettings(false)}
        />
      )}
    </div>
  );
}
