"use client";

import { LineMessageData, LineCarouselCard } from "@/types";

interface Props {
  message: LineMessageData;
  nodeName: string;
  onClose: () => void;
}

const LINE_GREEN = "#06C755";

// LINE アイコン SVG（シンプルな吹き出し風）
function LineIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width={64} height={64} rx={16} fill="white" fillOpacity={0.25} />
      <path
        d="M32 10C19.85 10 10 18.73 10 29.5c0 9.32 8.1 17.1 19.08 18.97L28 52l5.38-3.68C45.33 46.7 54 38.72 54 29.5 54 18.73 44.15 10 32 10z"
        fill="white"
      />
      <circle cx="23" cy="30" r="3" fill={LINE_GREEN} />
      <circle cx="32" cy="30" r="3" fill={LINE_GREEN} />
      <circle cx="41" cy="30" r="3" fill={LINE_GREEN} />
    </svg>
  );
}

// カルーセルカード（スクリーンショット準拠）
function CarouselCard({ card, index }: { card: LineCarouselCard; index: number }) {
  const hasImage = !!card.imageUrl;
  return (
    <div className="shrink-0 w-[200px] rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* 画像エリア */}
      <div className="relative w-full h-[120px] flex items-center justify-center" style={{ backgroundColor: LINE_GREEN }}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <LineIcon size={56} />
        )}
        {/* 番号バッジ */}
        <div
          className="absolute bottom-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
          style={{ backgroundColor: LINE_GREEN, border: "1.5px solid white" }}
        >
          {index + 1}
        </div>
      </div>

      {/* テキストエリア */}
      <div className="px-3 pt-2.5 pb-1">
        {card.title && <p className="text-sm font-bold text-gray-900 leading-snug">{card.title}</p>}
        {card.text && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{card.text}</p>}
      </div>

      {/* ボタン */}
      {(card.buttons ?? []).filter(b => b.label).length > 0 && (
        <div className="border-t border-gray-100 mt-2">
          {(card.buttons ?? []).filter(b => b.label).map((btn, bi) => (
            <div key={bi} className={`${bi > 0 ? "border-t border-gray-100" : ""}`}>
              <button className="w-full py-2 text-xs font-medium text-center" style={{ color: LINE_GREEN }}>
                {btn.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// テキストバブル
function TextBubble({ text }: { text: string }) {
  return (
    <div className="flex items-end gap-2">
      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center" style={{ backgroundColor: LINE_GREEN }}>
        <LineIcon size={28} />
      </div>
      <div className="max-w-[75%] bg-white rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

// ボタンメッセージ
function ButtonMessage({ message }: { message: LineMessageData }) {
  const hasImage = !!message.buttonImageUrl;
  return (
    <div className="flex items-end gap-2">
      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center" style={{ backgroundColor: LINE_GREEN }}>
        <LineIcon size={28} />
      </div>
      <div className="w-[220px] rounded-2xl rounded-bl-sm overflow-hidden shadow-sm bg-white border border-gray-100">
        {/* 画像 */}
        <div className="w-full h-[120px] flex items-center justify-center" style={{ backgroundColor: LINE_GREEN }}>
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={message.buttonImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <LineIcon size={56} />
          )}
        </div>
        {/* テキスト */}
        <div className="px-4 pt-3 pb-2">
          {message.buttonTitle && <p className="text-sm font-bold text-gray-900">{message.buttonTitle}</p>}
          {message.buttonText && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{message.buttonText}</p>}
        </div>
        {/* ボタン */}
        {(message.buttons ?? []).filter(b => b.label).length > 0 && (
          <div className="border-t border-gray-100">
            {(message.buttons ?? []).filter(b => b.label).map((btn, i) => (
              <div key={i} className={i > 0 ? "border-t border-gray-100" : ""}>
                <button className="w-full py-2 text-xs font-medium" style={{ color: LINE_GREEN }}>{btn.label}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LinePreviewModal({ message, nodeName, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col"
        style={{ width: 375, maxHeight: "85vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* スマホ外枠 */}
        <div className="bg-gray-900 rounded-[36px] overflow-hidden shadow-2xl flex flex-col" style={{ maxHeight: "85vh" }}>
          {/* ステータスバー */}
          <div className="bg-gray-900 px-6 pt-3 pb-1 flex items-center justify-between shrink-0">
            <span className="text-white text-xs font-semibold">9:41</span>
            <div className="flex gap-1 items-center">
              <span className="text-white text-xs">●●●</span>
            </div>
          </div>

          {/* LINEナビバー */}
          <div className="px-4 py-2.5 flex items-center gap-3 shrink-0" style={{ backgroundColor: LINE_GREEN }}>
            <button onClick={onClose} className="text-white text-lg leading-none">‹</button>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs font-bold">L</span>
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-semibold leading-tight truncate">{nodeName}</p>
              <p className="text-white/70 text-[10px]">公式アカウント</p>
            </div>
          </div>

          {/* チャット画面 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: "#b2c9d9", minHeight: 200 }}>
            {/* 日付ラベル */}
            <div className="flex justify-center">
              <span className="bg-black/20 text-white text-[10px] px-3 py-1 rounded-full">今日</span>
            </div>

            {/* メッセージ本体 */}
            {message.type === "text" && (
              <TextBubble text={message.text || "（テキストが未設定です）"} />
            )}

            {message.type === "button" && (
              <ButtonMessage message={message} />
            )}

            {message.type === "carousel" && (
              <div className="flex items-end gap-2">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center self-end" style={{ backgroundColor: LINE_GREEN }}>
                  <LineIcon size={28} />
                </div>
                {/* 横スクロール */}
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-[300px]" style={{ scrollbarWidth: "none" }}>
                  {(message.cards ?? []).map((card, i) => (
                    <CarouselCard key={i} card={card} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 入力バー */}
          <div className="bg-white px-3 py-2 flex items-center gap-2 shrink-0 border-t border-gray-200">
            <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-xs text-gray-400">メッセージを入力</div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: LINE_GREEN }}>
              <span className="text-white text-xs">↑</span>
            </div>
          </div>
        </div>

        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white text-sm hover:text-gray-300 transition-colors"
        >
          ✕ 閉じる
        </button>
      </div>
    </div>
  );
}
