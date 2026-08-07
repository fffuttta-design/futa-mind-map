"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { APP_VERSION } from "@/lib/version";

/**
 * Web / デスクトップ（Electron）向けの自動アップデート通知バナー。
 *
 * 機能改修のほとんどは Vercel（Web）側の配信で、EXE シェル自体は変わらないため
 * electron-updater は無反応になる。すると開きっぱなしのデスクトップ窓は古いページを
 * 読み込んだまま更新通知が出ず、本人が手動でチェックすることになっていた。
 *
 * そこで /api/version を「起動後・約2分ごと・窓に戻ってきた（focus/visible）とき」に
 * 取得し、読み込み済み APP_VERSION と食い違えば新バージョン公開とみなしてバナーを出す。
 * 「再読み込み」で最新ページを取り直す（Next.js の資産はハッシュ付きなので確実に最新化される）。
 *
 * Android ネイティブは APK 更新を AndroidUpdateBanner が担当するので、こちらは動かさない。
 */
export default function WebUpdateBanner() {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const snoozedRef = useRef<string | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      const v = data.version;
      if (!v || v === APP_VERSION) return;      // 同一なら何もしない
      if (v === snoozedRef.current) return;      // 「あとで」で伏せた版は出さない
      setNewVersion(v);
    } catch {
      /* オフライン等は無視 */
    }
  }, []);

  useEffect(() => {
    // Android ネイティブは APK 更新バナー側に任せる
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return;

    snoozedRef.current = sessionStorage.getItem("fmm-web-snooze");

    const t = setTimeout(check, 3000);                 // 起動3秒後に1回
    const iv = setInterval(check, 2 * 60 * 1000);      // 以降2分ごと
    const onFocus = () => check();                     // 窓に戻ってきたら即チェック
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(t);
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  if (!newVersion) return null;

  const reload = () => {
    if (reloading) return;
    setReloading(true);
    sessionStorage.setItem("justUpdated", "1"); // 再読み込み後に「アップデート完了！」トーストを出す
    window.location.reload();
  };
  const snooze = () => {
    sessionStorage.setItem("fmm-web-snooze", newVersion);
    snoozedRef.current = newVersion;
    setNewVersion(null);
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[70] bg-indigo-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">新しいバージョン v{newVersion} が公開されました</p>
        <p className="text-xs text-indigo-100 truncate">再読み込みすると最新になります（現在 v{APP_VERSION}）</p>
      </div>
      <button onClick={snooze} className="shrink-0 text-xs text-indigo-100 hover:text-white px-2 py-1">あとで</button>
      <button
        onClick={reload}
        disabled={reloading}
        className="shrink-0 bg-white text-indigo-600 text-sm font-semibold rounded-lg px-4 py-1.5 hover:bg-indigo-50 disabled:opacity-60"
      >
        {reloading ? "更新中…" : "再読み込み"}
      </button>
    </div>
  );
}
