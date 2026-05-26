"use client";

import { useState } from "react";
import { APP_VERSION } from "@/lib/version";

interface Props {
  onClose: () => void;
  /** 起動時の自動チェック結果を渡す（バッジ→モーダル連携用） */
  initialLatestVersion?: string | null;
  initialHasUpdate?: boolean;
}

type CheckState = "idle" | "checking" | "latest" | "update-available";

export default function SettingsModal({ onClose, initialLatestVersion, initialHasUpdate }: Props) {
  const [checkState, setCheckState] = useState<CheckState>(
    initialHasUpdate ? "update-available" : "idle"
  );
  const [latestVersion, setLatestVersion] = useState<string | null>(initialLatestVersion ?? null);

  const handleCheckVersion = async () => {
    setCheckState("checking");
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      const data = await res.json();
      setLatestVersion(data.version);
      setCheckState(data.version !== APP_VERSION ? "update-available" : "latest");
    } catch {
      setCheckState("idle");
    }
  };

  const handleUpdate = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-96 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <h2 className="text-base font-semibold text-gray-800">アプリ設定</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* バージョン */}
        <div className="px-6 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">バージョン情報</p>
          <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">FutaMindMap</p>
              <p className="text-xs text-gray-400 mt-0.5">現在のバージョン：v{APP_VERSION}</p>
              {checkState === "latest" && (
                <p className="text-xs text-emerald-500 mt-1 font-medium">✓ 最新バージョンです</p>
              )}
              {checkState === "update-available" && latestVersion && (
                <p className="text-xs text-indigo-500 mt-1 font-medium">
                  🆕 v{latestVersion} が利用可能です
                </p>
              )}
            </div>

            {checkState === "update-available" ? (
              <button
                onClick={handleUpdate}
                className="shrink-0 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                今すぐ更新
              </button>
            ) : (
              <button
                onClick={handleCheckVersion}
                disabled={checkState === "checking" || checkState === "latest"}
                className={`shrink-0 px-4 py-2 rounded-lg text-xs font-semibold transition-colors
                  ${checkState === "checking" || checkState === "latest"
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-800 hover:bg-gray-700 text-white shadow-sm"
                  }`}
              >
                {checkState === "checking" ? "確認中…" : "アップデートを確認"}
              </button>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 pb-5">
          <p className="text-xs text-gray-300 text-center">© 2025 FutaMindMap</p>
        </div>
      </div>
    </div>
  );
}
