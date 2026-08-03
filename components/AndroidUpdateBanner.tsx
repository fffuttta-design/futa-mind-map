"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Android（Capacitor）専用のOTA更新バナー。
 * 起動時に /app/update.json を見て、配布中のversionCodeがインストール済みより新しければ
 * バナーを出す。「更新」で配布APKのURLをシステムブラウザで開き、本人がインストールする。
 * Web/デスクトップでは何もしない（Capacitorネイティブ時のみ動作）。
 */
type Manifest = { versionCode: number; versionName: string; url: string; notes?: string };

export default function AndroidUpdateBanner() {
  const [info, setInfo] = useState<Manifest | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const cur = await App.getInfo(); // build = versionCode（文字列）
        const curCode = parseInt(cur.build, 10) || 0;
        const res = await fetch(`/app/update.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const m = (await res.json()) as Manifest;
        if (cancelled) return;
        const snoozed = Number(sessionStorage.getItem("fmm-apk-snooze") || 0);
        if (m.versionCode > curCode && m.versionCode !== snoozed) setInfo(m);
      } catch { /* オフライン等は無視 */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!info) return null;

  const update = async () => {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: info.url });
    } catch {
      window.open(info.url, "_blank");
    }
  };
  const snooze = () => { sessionStorage.setItem("fmm-apk-snooze", String(info.versionCode)); setInfo(null); };

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] bg-indigo-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">新しいバージョン v{info.versionName} があります</p>
        {info.notes && <p className="text-xs text-indigo-100 truncate">{info.notes}</p>}
      </div>
      <button onClick={snooze} className="shrink-0 text-xs text-indigo-100 hover:text-white px-2 py-1">あとで</button>
      <button onClick={update} className="shrink-0 bg-white text-indigo-600 text-sm font-semibold rounded-lg px-4 py-1.5 hover:bg-indigo-50">更新</button>
    </div>
  );
}
