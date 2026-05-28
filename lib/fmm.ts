/**
 * FutaMindMap ファイル形式 (.fmm)
 * 実体は UTF-8 JSON。専用拡張子でバックアップと一般ファイルを区別する。
 */

import { MindMap } from "@/types";

// ── ファイル構造 ────────────────────────────────────────────────
export interface FMMFile {
  /** 識別子（必須） */
  $schema: "FutaMindMap";
  /** 書き出し時のアプリバージョン */
  version: string;
  /** 書き出し日時 (Unix ms) */
  exportedAt: number;
  // マップ本体データ
  title: string;
  nodes: MindMap["nodes"];
  stickyNotes?: MindMap["stickyNotes"];
  areas?: MindMap["areas"];
  edgeStyle?: MindMap["edgeStyle"];
  defaultShape?: MindMap["defaultShape"];
  nodeBorderWidth?: MindMap["nodeBorderWidth"];
  mode?: MindMap["mode"];
}

// ── エクスポート ─────────────────────────────────────────────────
/**
 * マップを .fmm ファイルとしてブラウザにダウンロードさせる。
 * @param map      現在のマップ状態
 * @param version  APP_VERSION 文字列
 */
export function exportToFMM(map: MindMap, version: string): void {
  const data: FMMFile = {
    $schema: "FutaMindMap",
    version,
    exportedAt: Date.now(),
    title: map.title,
    nodes: map.nodes,
    stickyNotes: map.stickyNotes,
    areas: map.areas,
    edgeStyle: map.edgeStyle,
    defaultShape: map.defaultShape,
    nodeBorderWidth: map.nodeBorderWidth,
    mode: map.mode,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // ファイル名: タイトル_YYYY-MM-DD_HH-MM.fmm
  const safe = map.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
  const ts = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  a.download = `${safe}_${ts}.fmm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── インポート ───────────────────────────────────────────────────
/** .fmm ファイルを読み込んで FMMFile オブジェクトを返す */
export function importFromFMM(file: File): Promise<FMMFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        if (raw.$schema !== "FutaMindMap") {
          throw new Error("FutaMindMap ファイルではありません ($schema 不一致)");
        }
        if (!Array.isArray(raw.nodes)) {
          throw new Error("nodes フィールドが見つかりません");
        }
        resolve(raw as FMMFile);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.readAsText(file, "utf-8");
  });
}
