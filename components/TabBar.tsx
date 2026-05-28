"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tab, loadTabs, closeTab } from "@/lib/tabs";

interface Props {
  currentId: string;
}

export default function TabBar({ currentId }: Props) {
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>([]);

  // 初期読み込み & storageイベントで他タブと同期
  useEffect(() => {
    setTabs(loadTabs());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "fmm-tabs") setTabs(loadTabs());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // currentIdが変わったとき（ページ遷移後）にタブ一覧を再読み込み
  useEffect(() => {
    setTabs(loadTabs());
  }, [currentId]);

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const prevTabs = loadTabs();
    const remaining = closeTab(id);
    setTabs(remaining);
    if (id === currentId) {
      if (remaining.length > 0) {
        // 閉じたタブの左隣へ（なければ右隣）
        const closedIdx = prevTabs.findIndex(t => t.id === id);
        const nextIdx = Math.max(0, closedIdx - 1);
        const next = remaining[nextIdx] ?? remaining[0];
        router.push(`/maps/${next.id}`);
      } else {
        router.push("/maps");
      }
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-end gap-px px-2 pt-1 bg-gray-100 border-b border-gray-200 overflow-x-auto shrink-0 select-none">
      {tabs.map(tab => {
        const isActive = tab.id === currentId;
        return (
          <div
            key={tab.id}
            onClick={() => !isActive && router.push(`/maps/${tab.id}`)}
            className={`group flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-xs font-medium shrink-0 max-w-[180px] border border-b-0 transition-colors
              ${isActive
                ? "bg-white text-gray-800 border-gray-200 shadow-sm -mb-px cursor-default z-10"
                : "bg-gray-100 text-gray-500 hover:bg-gray-50 hover:text-gray-700 border-transparent cursor-pointer"
              }`}
          >
            {/* マップアイコン */}
            <span className="text-[10px] opacity-60 shrink-0">🗺️</span>
            <span className="truncate max-w-[110px]">{tab.title}</span>
            <button
              onClick={e => handleClose(e, tab.id)}
              className="ml-0.5 shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-all"
              title="タブを閉じる"
            >
              ×
            </button>
          </div>
        );
      })}

      {/* マップ一覧を開く */}
      <button
        onClick={() => router.push("/maps")}
        title="マップ一覧を開く"
        className="ml-1 px-2.5 py-1.5 text-gray-400 hover:text-indigo-500 text-sm leading-none transition-colors shrink-0 rounded-t"
      >
        ＋
      </button>
    </div>
  );
}
