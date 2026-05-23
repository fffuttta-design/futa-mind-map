"use client";

import { useState, useEffect } from "react";
import { MindMapNode, LineMessageData, LineCarouselCard, LineButton } from "@/types";

interface Props {
  node: MindMapNode | null;
  onUpdate: (updates: Partial<MindMapNode>) => void;
  onPreview: (message: LineMessageData) => void;
}

const DEFAULT_CARD: LineCarouselCard = { imageUrl: "", title: "", text: "", buttons: [{ label: "", url: "" }] };

export default function LineMessagePanel({ node, onUpdate, onPreview }: Props) {
  const [draft, setDraft] = useState<LineMessageData | null>(null);

  useEffect(() => {
    if (!node) { setDraft(null); return; }
    setDraft(node.lineMessage ?? null);
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center gap-3">
        <span className="text-4xl">📱</span>
        <p className="text-sm">ノードを選択すると<br />LINE配信を設定できます</p>
      </div>
    );
  }

  const initDraft = (type: LineMessageData["type"]) => {
    const base: LineMessageData =
      type === "text" ? { type: "text", text: "" } :
      type === "button" ? { type: "button", buttonImageUrl: "", buttonTitle: "", buttonText: "", buttons: [{ label: "", url: "" }] } :
      { type: "carousel", cards: [{ ...DEFAULT_CARD }, { ...DEFAULT_CARD }] };
    setDraft(base);
  };

  const save = () => {
    if (!draft) return;
    onUpdate({ lineMessage: draft });
  };

  const clear = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { lineMessage: _, ...rest } = node;
    onUpdate({ lineMessage: undefined });
    setDraft(null);
  };

  // ── カルーセル helpers ──
  const updateCard = (idx: number, patch: Partial<LineCarouselCard>) => {
    if (!draft || draft.type !== "carousel") return;
    const cards = draft.cards!.map((c, i) => i === idx ? { ...c, ...patch } : c);
    setDraft({ ...draft, cards });
  };

  const updateCardButton = (cardIdx: number, btnIdx: number, patch: Partial<LineButton>) => {
    if (!draft || draft.type !== "carousel") return;
    const cards = draft.cards!.map((c, ci) => {
      if (ci !== cardIdx) return c;
      const buttons = (c.buttons ?? []).map((b, bi) => bi === btnIdx ? { ...b, ...patch } : b);
      return { ...c, buttons };
    });
    setDraft({ ...draft, cards });
  };

  const addCard = () => {
    if (!draft || draft.type !== "carousel") return;
    setDraft({ ...draft, cards: [...draft.cards!, { ...DEFAULT_CARD, buttons: [{ label: "", url: "" }] }] });
  };

  const removeCard = (idx: number) => {
    if (!draft || draft.type !== "carousel" || draft.cards!.length <= 1) return;
    setDraft({ ...draft, cards: draft.cards!.filter((_, i) => i !== idx) });
  };

  const updateButton = (idx: number, patch: Partial<LineButton>) => {
    if (!draft || draft.type !== "button") return;
    const buttons = (draft.buttons ?? []).map((b, i) => i === idx ? { ...b, ...patch } : b);
    setDraft({ ...draft, buttons });
  };

  const addButton = () => {
    if (!draft || draft.type !== "button") return;
    setDraft({ ...draft, buttons: [...(draft.buttons ?? []), { label: "", url: "" }] });
  };

  const removeButton = (idx: number) => {
    if (!draft || draft.type !== "button") return;
    setDraft({ ...draft, buttons: (draft.buttons ?? []).filter((_, i) => i !== idx) });
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">LINE配信設定</p>
        <p className="text-sm font-medium text-gray-700 mt-0.5 truncate">{node.text}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* メッセージタイプ選択 */}
        {!draft ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">メッセージタイプを選択</p>
            {([
              { type: "text" as const, label: "テキスト", desc: "シンプルな文章メッセージ", icon: "💬" },
              { type: "button" as const, label: "ボタン", desc: "画像＋テキスト＋ボタン", icon: "🖼️" },
              { type: "carousel" as const, label: "カルーセル", desc: "複数カードを横並びに", icon: "📋" },
            ] as const).map(({ type, label, desc, icon }) => (
              <button
                key={type}
                onClick={() => initDraft(type)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-green-400 hover:bg-green-50 text-left transition-colors"
              >
                <span className="text-lg">{icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* タイプ切替タブ */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["text", "button", "carousel"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => initDraft(t)}
                  className={`flex-1 py-1 text-xs rounded-md transition-colors font-medium ${draft.type === t ? "bg-white text-green-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {t === "text" ? "テキスト" : t === "button" ? "ボタン" : "カルーセル"}
                </button>
              ))}
            </div>

            {/* テキスト */}
            {draft.type === "text" && (
              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-medium">メッセージ本文</label>
                <textarea
                  value={draft.text ?? ""}
                  onChange={e => setDraft({ ...draft, text: e.target.value })}
                  rows={5}
                  placeholder="配信するテキストを入力..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-400 resize-none"
                />
              </div>
            )}

            {/* ボタン */}
            {draft.type === "button" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">画像URL（省略可）</label>
                  <input value={draft.buttonImageUrl ?? ""} onChange={e => setDraft({ ...draft, buttonImageUrl: e.target.value })}
                    placeholder="https://..." className="w-full mt-1 text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">タイトル（省略可）</label>
                  <input value={draft.buttonTitle ?? ""} onChange={e => setDraft({ ...draft, buttonTitle: e.target.value })}
                    placeholder="タイトル" className="w-full mt-1 text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">テキスト</label>
                  <textarea value={draft.buttonText ?? ""} onChange={e => setDraft({ ...draft, buttonText: e.target.value })}
                    rows={3} placeholder="メッセージ本文" className="w-full mt-1 text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-400 resize-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">ボタン</label>
                  <div className="mt-1 space-y-2">
                    {(draft.buttons ?? []).map((btn, i) => (
                      <div key={i} className="flex gap-1.5 items-center">
                        <input value={btn.label} onChange={e => updateButton(i, { label: e.target.value })}
                          placeholder="ラベル" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-green-400" />
                        <input value={btn.url ?? ""} onChange={e => updateButton(i, { url: e.target.value })}
                          placeholder="URL（省略可）" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-green-400" />
                        <button onClick={() => removeButton(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none shrink-0">×</button>
                      </div>
                    ))}
                    {(draft.buttons ?? []).length < 4 && (
                      <button onClick={addButton} className="text-xs text-green-600 hover:text-green-700">＋ ボタンを追加</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* カルーセル */}
            {draft.type === "carousel" && (
              <div className="space-y-4">
                {(draft.cards ?? []).map((card, ci) => (
                  <div key={ci} className="border border-gray-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500">カード {ci + 1}</p>
                      <button onClick={() => removeCard(ci)} className="text-xs text-gray-300 hover:text-red-400">削除</button>
                    </div>
                    <input value={card.imageUrl ?? ""} onChange={e => updateCard(ci, { imageUrl: e.target.value })}
                      placeholder="画像URL（省略可）" className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-green-400" />
                    <input value={card.title ?? ""} onChange={e => updateCard(ci, { title: e.target.value })}
                      placeholder="タイトル" className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-green-400" />
                    <input value={card.text ?? ""} onChange={e => updateCard(ci, { text: e.target.value })}
                      placeholder="テキスト" className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-green-400" />
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-400">ボタン</p>
                      {(card.buttons ?? []).map((btn, bi) => (
                        <div key={bi} className="flex gap-1 items-center">
                          <input value={btn.label} onChange={e => updateCardButton(ci, bi, { label: e.target.value })}
                            placeholder="ラベル" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-green-400" />
                          <input value={btn.url ?? ""} onChange={e => updateCardButton(ci, bi, { url: e.target.value })}
                            placeholder="URL（省略可）" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-green-400" />
                          <button onClick={() => {
                            const buttons = (card.buttons ?? []).filter((_, i) => i !== bi);
                            updateCard(ci, { buttons });
                          }} className="text-gray-300 hover:text-red-400 text-lg leading-none shrink-0">×</button>
                        </div>
                      ))}
                      {(card.buttons ?? []).length < 3 && (
                        <button onClick={() => updateCard(ci, { buttons: [...(card.buttons ?? []), { label: "", url: "" }] })}
                          className="text-xs text-green-600 hover:text-green-700">＋ ボタンを追加</button>
                      )}
                    </div>
                  </div>
                ))}
                {(draft.cards ?? []).length < 10 && (
                  <button onClick={addCard} className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors">
                    ＋ カードを追加
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* フッター */}
      {draft && (
        <div className="px-4 py-3 border-t border-gray-100 shrink-0 flex flex-col gap-2">
          <button
            onClick={() => { save(); onPreview(draft); }}
            className="w-full py-2 bg-[#06C755] text-white rounded-xl text-sm font-semibold hover:bg-[#05b34c] transition-colors flex items-center justify-center gap-2"
          >
            <span>📱</span> プレビューを確認
          </button>
          <div className="flex gap-2">
            <button onClick={save} className="flex-1 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">保存</button>
            <button onClick={clear} className="py-1.5 px-3 text-red-400 hover:bg-red-50 rounded-lg text-xs transition-colors">削除</button>
          </div>
        </div>
      )}
    </div>
  );
}
