"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { MindMap, MindMapNode } from "@/types";
import { openTab } from "@/lib/tabs";

interface Props {
  currentMapId: string;
  onClose: () => void;
}

const LINE_ROOT: MindMapNode = { id: "root", text: "LINEシナリオ設計", x: 0, y: 0, parentId: null, color: "#06C755" };
const BLANK_ROOT: MindMapNode = { id: "root", text: "中心テーマ", x: 0, y: 0, parentId: null, color: "#6366f1" };

export default function TabMapPickerModal({ currentMapId, onClose }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "maps"), where("ownerId", "==", user.uid)))
      .then(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as MindMap));
        data.sort((a, b) => b.updatedAt - a.updatedAt);
        setMaps(data);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = maps.filter(m =>
    !search || m.title.toLowerCase().includes(search.toLowerCase())
  );

  const openMap = (id: string, title: string) => {
    openTab(id, title);
    router.push(`/maps/${id}`);
    onClose();
  };

  const createNew = async (template: "blank" | "line") => {
    if (!user || creating) return;
    setCreating(true);
    const now = Date.now();
    const isLine = template === "line";
    const title = isLine ? "LINEシナリオ設計" : "新しいマップ";
    const ref = await addDoc(collection(db, "maps"), {
      title,
      nodes: [isLine ? LINE_ROOT : BLANK_ROOT],
      ownerId: user.uid,
      createdAt: now,
      updatedAt: now,
      mode: isLine ? "line" : "mindmap",
    });
    openTab(ref.id, title);
    router.push(`/maps/${ref.id}`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-96 max-h-[75vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">マップを選択</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none transition-colors">×</button>
          </div>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="マップ名で検索..."
            className="w-full px-3 py-2 text-sm bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 transition"
          />
        </div>

        {/* 新規作成 */}
        <div className="px-4 py-3 border-b border-gray-100 shrink-0">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">新規作成</p>
          <div className="flex gap-2">
            <button
              onClick={() => createNew("blank")}
              disabled={creating}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left disabled:opacity-50"
            >
              <span className="text-xl">🗺️</span>
              <p className="text-xs font-semibold text-gray-800">空白マップ</p>
            </button>
            <button
              onClick={() => createNew("line")}
              disabled={creating}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 hover:border-[#06C755] hover:bg-green-50 transition-colors text-left disabled:opacity-50"
            >
              <span className="text-xl">📱</span>
              <p className="text-xs font-semibold text-gray-800">LINE構築</p>
            </button>
          </div>
        </div>

        {/* マップリスト */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-center text-xs text-gray-400 py-8">読み込み中...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">
              {search ? `"${search}" は見つかりません` : "マップがありません"}
            </p>
          ) : (
            filtered.map(m => {
              const isCurrent = m.id === currentMapId;
              return (
                <button
                  key={m.id}
                  onClick={() => openMap(m.id, m.title)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors flex items-center justify-between gap-2
                    ${isCurrent ? "bg-indigo-50 hover:bg-indigo-100" : "hover:bg-gray-50"}`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrent ? "text-indigo-700" : "text-gray-800"}`}>
                      {m.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <span>{new Date(m.updatedAt).toLocaleDateString("ja-JP")} · {m.nodes.length}ノード</span>
                      {m.mode === "line" && (
                        <span className="bg-[#06C755] text-white px-1.5 py-0.5 rounded text-[10px] font-semibold">LINE</span>
                      )}
                    </p>
                  </div>
                  {isCurrent ? (
                    <span className="text-[11px] text-indigo-500 font-semibold shrink-0 bg-indigo-100 px-1.5 py-0.5 rounded-full">表示中</span>
                  ) : (
                    <span className="text-gray-300 text-xs shrink-0">→</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
