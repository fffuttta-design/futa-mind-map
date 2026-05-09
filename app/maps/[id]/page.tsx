"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { MindMap, MindMapNode } from "@/types";
import MindMapCanvas from "@/components/MindMapCanvas";

export default function MapEditorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [map, setMap] = useState<MindMap | null>(null);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [showShareUrl, setShowShareUrl] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportRef = useRef<{ exportSVG: () => void; exportPNG: () => void } | null>(null);

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

  const saveNodes = useCallback((nodes: MindMapNode[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await updateDoc(doc(db, "maps", id), { nodes, updatedAt: Date.now() });
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

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${id}` : "";

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
          >
            SVG
          </button>
          <button
            onClick={() => exportRef.current?.exportPNG()}
            className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            PNG
          </button>
          <button
            onClick={togglePublic}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${isPublic ? "bg-green-100 text-green-600 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {isPublic ? "🔓 公開中" : "🔒 共有"}
          </button>
          <span className="text-xs text-gray-400">自動保存</span>
        </div>
      </header>

      {showShareUrl && isPublic && (
        <div className="bg-green-50 border-b border-green-100 px-4 py-2 flex items-center gap-3">
          <span className="text-xs text-green-700 font-medium">共有URL:</span>
          <code className="text-xs text-green-800 bg-green-100 px-2 py-0.5 rounded flex-1 truncate">{shareUrl}</code>
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="text-xs text-green-600 hover:text-green-800 shrink-0"
          >コピー</button>
          <button onClick={() => setShowShareUrl(false)} className="text-green-400 hover:text-green-600 text-lg leading-none">×</button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <MindMapCanvas initialNodes={map.nodes} onNodesChange={saveNodes} exportRef={exportRef} />
      </div>
    </div>
  );
}
