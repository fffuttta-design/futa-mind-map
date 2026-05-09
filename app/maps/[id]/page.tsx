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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  if (loading || !map) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">読み込み中...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-4 shrink-0">
        <button onClick={() => router.push("/maps")} className="text-gray-400 hover:text-gray-600 transition-colors text-sm">
          ← 戻る
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => saveTitle(title)}
          onKeyDown={(e) => e.key === "Enter" && saveTitle(title)}
          className="text-lg font-semibold text-gray-800 bg-transparent border-none outline-none focus:bg-gray-50 rounded px-2 py-1 flex-1"
        />
        <span className="text-xs text-gray-400">自動保存</span>
      </header>
      <div className="flex-1 overflow-hidden">
        <MindMapCanvas initialNodes={map.nodes} onNodesChange={saveNodes} />
      </div>
    </div>
  );
}
