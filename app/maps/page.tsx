"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { MindMap } from "@/types";

export default function MapsPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
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
    });
    setCreating(false);
    router.push(`/maps/${ref.id}`);
  };

  const deleteMap = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("このマップを削除しますか？")) return;
    await deleteDoc(doc(db, "maps", id));
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">FutaMindMap</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.displayName}</span>
          <button onClick={signOut} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-gray-800">マイマップ</h2>
          <button
            onClick={createMap}
            disabled={creating}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium disabled:opacity-50"
          >
            ＋ 新しいマップ
          </button>
        </div>

        {maps.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">🗺️</p>
            <p>まだマップがありません。作成してみましょう！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {maps.map((map) => (
              <div
                key={map.id}
                onClick={() => router.push(`/maps/${map.id}`)}
                className="bg-white rounded-xl border border-gray-100 p-5 cursor-pointer hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-gray-800 group-hover:text-indigo-600 transition-colors">
                    {map.title}
                  </h3>
                  <button
                    onClick={(e) => deleteMap(e, map.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(map.updatedAt).toLocaleDateString("ja-JP")}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
