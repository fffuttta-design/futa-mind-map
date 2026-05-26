"use client";

import { useState, useEffect } from "react";
import { APP_VERSION } from "@/lib/version";

export interface VersionCheckResult {
  hasUpdate: boolean;
  latestVersion: string | null;
  recheck: () => void;
}

export function useVersionCheck(): VersionCheckResult {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setLatestVersion(data.version);
          setHasUpdate(data.version !== APP_VERSION);
        }
      } catch {
        // ネットワーク不可の場合は無視
      }
    };

    // 初回は 2 秒後に実行（初期レンダリングを邪魔しない）
    const delay = tick === 0 ? 2000 : 0;
    const timer = setTimeout(run, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tick]);

  const recheck = () => setTick(t => t + 1);

  return { hasUpdate, latestVersion, recheck };
}
