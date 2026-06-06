"use client";

import { useState } from "react";
import { generateMindMapFromText } from "@/lib/aiGenerate";
import { MindMapNode } from "@/types";
import { useAiUsage } from "@/hooks/useAiUsage";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 生成されたノード群を受け取る（既存マップに追加する側で処理） */
  onGenerated: (nodes: MindMapNode[], title: string) => void;
  /** ノードを配置する基準点（キャンバス座標） */
  origin: { x: number; y: number };
}

export default function AiGenerateModal({ open, onClose, onGenerated, origin }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { costJpy, over, thresholdJpy } = useAiUsage(100);

  if (!open) return null;

  const handleGenerate = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const { nodes, title } = await generateMindMapFromText(text.trim(), origin);
      onGenerated(nodes, title);
      setText("");
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Functions の HttpsError は message に日本語が入る
      setError(msg.replace(/^.*?:\s*/, "") || "生成に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[560px] max-w-[92vw] max-h-[88vh] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h2 className="text-base font-bold text-gray-800">AIでマインドマップを生成</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* コスト超過アラート */}
        {over && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-xs">
            ⚠️ 今月のAI利用料が¥{thresholdJpy}を超えました（概算 ¥{Math.round(costJpy)}）。使いすぎにご注意ください。
          </div>
        )}

        {/* 本文 */}
        <div className="p-5 flex flex-col gap-3 overflow-y-auto">
          <p className="text-xs text-gray-500 leading-relaxed">
            設計書・企画書・箇条書き・議事録などを貼り付けてください。AIが全体像をマインドマップのたたき台にします（生成後に自由に編集できます）。
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"例）\n LINE構築の流れ\n - 友だち追加\n - あいさつメッセージ\n - アンケート\n - 商談予約\n ..."}
            rows={12}
            className="w-full text-sm border border-gray-200 rounded-lg p-3 outline-none focus:border-indigo-400 resize-none font-mono leading-relaxed"
            disabled={loading}
            autoFocus
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-2">
          <span className="text-[11px] text-gray-400">
            {text.length > 0 ? `${text.length}文字` : "Haikuモデルで生成"}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              disabled={loading}
            >
              キャンセル
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || !text.trim()}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  生成中...
                </>
              ) : (
                "✨ 生成する"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
