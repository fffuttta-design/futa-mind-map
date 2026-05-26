"use client";

interface Props {
  edgeStyle: "curve" | "straight";
  defaultShape: "pill" | "rect" | "circle" | "diamond" | "text";
  nodeBorderWidth: number;
  onEdgeStyleChange: (v: "curve" | "straight") => void;
  onDefaultShapeChange: (v: "pill" | "rect" | "circle" | "diamond" | "text") => void;
  onNodeBorderWidthChange: (v: number) => void;
  onClose: () => void;
}

const SHAPES = [
  { id: "pill",    label: "⬭", title: "カプセル" },
  { id: "rect",    label: "▭", title: "四角" },
  { id: "circle",  label: "⊙", title: "円" },
  { id: "diamond", label: "◇", title: "ダイヤ" },
  { id: "text",    label: "T",  title: "テキスト" },
] as const;

const BORDER_OPTIONS = [
  { value: 0, label: "なし" },
  { value: 1, label: "1px" },
  { value: 2, label: "2px" },
  { value: 3, label: "3px" },
];

export default function PageSettingsModal({
  edgeStyle, defaultShape, nodeBorderWidth,
  onEdgeStyleChange, onDefaultShapeChange, onNodeBorderWidthChange,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-88 overflow-hidden"
        style={{ width: 360 }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗺️</span>
            <h2 className="text-base font-semibold text-gray-800">ページ設定</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none transition-colors">×</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* エッジスタイル */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">接続線スタイル</p>
            <div className="flex gap-2">
              {(["curve", "straight"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => onEdgeStyleChange(s)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border
                    ${edgeStyle === s
                      ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
                >
                  {s === "curve" ? "〜 曲線" : "━ 直線"}
                </button>
              ))}
            </div>
          </div>

          {/* デフォルトノード形状 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">新規ノードのデフォルト形状</p>
            <div className="flex gap-1.5">
              {SHAPES.map(s => (
                <button
                  key={s.id}
                  title={s.title}
                  onClick={() => onDefaultShapeChange(s.id)}
                  className={`flex-1 py-2 rounded-xl text-base transition-colors border
                    ${defaultShape === s.id
                      ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* ノード枠線 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">ノード枠線（黒）</p>
            <div className="flex gap-2">
              {BORDER_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => onNodeBorderWidthChange(o.value)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border
                    ${nodeBorderWidth === o.value
                      ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
