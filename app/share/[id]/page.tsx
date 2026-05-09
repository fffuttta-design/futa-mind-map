"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MindMap } from "@/types";
import MindMapCanvas from "@/components/MindMapCanvas";

export default function SharePage() {
  const params = useParams();
  const id = params.id as string;
  const [map, setMap] = useState<MindMap | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "maps", id)).then(snap => {
      if (!snap.exists()) { setError(true); return; }
      const data = { id: snap.id, ...snap.data() } as MindMap;
      if (!data.isPublic) { setError(true); return; }
      setMap(data);
    });
  }, [id]);

  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center text-gray-400">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-medium">このマップは公開されていません</p>
      </div>
    </div>
  );

  if (!map) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">読み込み中...</div>
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <span className="text-lg font-semibold text-gray-800 flex-1">{map.title}</span>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">閲覧のみ</span>
        <Link href="/" className="text-xs text-indigo-500 hover:underline">FutaMindMapを使う</Link>
      </header>
      <div className="flex-1 overflow-hidden">
        <MindMapCanvas initialNodes={map.nodes} onNodesChange={() => {}} readOnly />
      </div>
    </div>
  );
}
