"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** 今月の AI 利用料（円・概算）を購読する。¥100 超でアプリ内アラートに使う。 */
export function useAiUsage(thresholdJpy = 100) {
  const [costJpy, setCostJpy] = useState(0);
  const [calls, setCalls] = useState(0);

  useEffect(() => {
    const now = new Date();
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const unsub = onSnapshot(doc(db, "ai_usage", ym), (snap) => {
      const data = snap.data();
      setCostJpy(data?.costJpy ?? 0);
      setCalls(data?.calls ?? 0);
    }, () => {
      // 読み取り権限が無い・未作成などは 0 のまま
    });
    return unsub;
  }, []);

  return { costJpy, calls, over: costJpy >= thresholdJpy, thresholdJpy };
}
