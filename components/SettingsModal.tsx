"use client";

import { useRef, useState } from "react";
import { APP_VERSION } from "@/lib/version";
import { FMMFile, importFromFMM } from "@/lib/fmm";

interface Props {
  onClose: () => void;
  /** 起動時の自動チェック結果を渡す（バッジ→モーダル連携用） */
  initialLatestVersion?: string | null;
  initialHasUpdate?: boolean;
  /** リロード前に呼ぶ保存フラッシュ（未保存データ消失を防ぐ） */
  onBeforeReload?: () => Promise<void>;
  /** エクスポート実行（.fmm ファイルをダウンロード） */
  onExport?: () => void;
  /** インポート実行（読み込んだ FMMFile を受け取る） */
  onImport?: (fmm: FMMFile) => Promise<void>;
}

type CheckState = "idle" | "checking" | "latest" | "update-available";

export default function SettingsModal({
  onClose,
  initialLatestVersion,
  initialHasUpdate,
  onBeforeReload,
  onExport,
  onImport,
}: Props) {
  const [checkState, setCheckState] = useState<CheckState>(
    initialHasUpdate ? "update-available" : "idle"
  );
  const [latestVersion, setLatestVersion] = useState<string | null>(initialLatestVersion ?? null);
  const [reloading, setReloading] = useState(false);
  const [importState, setImportState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /** リロード前に自動エクスポート → 保存フラッシュ → リロード */
  const doReload = async (withJustUpdated = false) => {
    if (reloading) return;
    setReloading(true);
    // ① バックアップを自動ダウンロード
    try { onExport?.(); } catch { /* ignore */ }
    // ② 未保存データをフラッシュ
    try { await onBeforeReload?.(); } catch { /* ignore */ }
    if (withJustUpdated) sessionStorage.setItem("justUpdated", "1");
    window.location.reload();
  };

  const handleUpdate = () => doReload(true);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImport) return;
    setImportState("loading");
    setImportError("");
    try {
      const fmm = await importFromFMM(file);
      await onImport(fmm);
      setImportState("done");
    } catch (err) {
      setImportState("error");
      setImportError(err instanceof Error ? err.message : "不明なエラー");
    } finally {
      // input をリセットして同じファイルを再選択できるようにする
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        <div className="px-6 py-5 border-b border-gray-100">
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
                disabled={reloading}
                className="shrink-0 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {reloading ? "準備中…" : "今すぐ更新"}
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

        {/* バックアップ (.fmm) */}
        {(onExport || onImport) && (
          <div className="px-6 py-5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">バックアップ / 復元</p>
            <p className="text-[11px] text-gray-400 mb-3">
              .fmm ファイルにすべてのノード・エリア・付箋を保存します。<br />
              ※ 更新・再起動ボタンを押すと自動でダウンロードされます
            </p>

            <div className="flex flex-col gap-2">
              {/* エクスポート */}
              {onExport && (
                <button
                  onClick={() => { onExport(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium transition-colors border border-indigo-200"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  バックアップをダウンロード (.fmm)
                </button>
              )}

              {/* インポート */}
              {onImport && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importState === "loading"}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm font-medium transition-colors border border-gray-200 disabled:opacity-50"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 5 17 10"/>
                      <line x1="12" y1="5" x2="12" y2="17"/>
                    </svg>
                    {importState === "loading" ? "復元中…" : ".fmm ファイルから復元"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".fmm,.json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  {importState === "done" && (
                    <p className="text-xs text-emerald-600 font-medium px-1">✓ 復元しました。ページをリロードして確認してください。</p>
                  )}
                  {importState === "error" && (
                    <p className="text-xs text-red-500 px-1">⚠ {importError}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 再起動 */}
        <div className="px-6 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">アプリ操作</p>
          <button
            onClick={() => doReload(false)}
            disabled={reloading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm font-medium transition-colors border border-gray-200 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            {reloading ? "バックアップ保存中…" : "再起動"}
          </button>
        </div>

        {/* フッター */}
        <div className="px-6 pb-4">
          <p className="text-xs text-gray-300 text-center">© 2025 FutaMindMap</p>
        </div>
      </div>
    </div>
  );
}
