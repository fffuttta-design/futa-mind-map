import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: sizeStr } = await params;
  const s = Math.min(512, Math.max(16, parseInt(sizeStr, 10) || 192));
  const sc = s / 64; // scale factor from 64px base design

  const r = (n: number) => Math.round(n * sc);
  const line = (style: object) => (
    <div style={{ position: "absolute", height: r(2.5), background: "rgba(255,255,255,0.65)", borderRadius: r(2), ...style }} />
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: s, height: s,
          background: "#6366f1",
          borderRadius: r(13),
          position: "relative",
          display: "flex",
        }}
      >
        {/* ─ 接続線（回転した細い div）─ */}
        {/* 左上 */}
        {line({ left: r(17), top: r(29), width: r(8), transform: "rotate(-57deg)", transformOrigin: "left center" })}
        {/* 左下 */}
        {line({ left: r(17), top: r(35), width: r(8), transform: "rotate(57deg)", transformOrigin: "left center" })}
        {/* 右上 */}
        {line({ right: r(17), top: r(29), width: r(8), transform: "rotate(57deg)", transformOrigin: "right center" })}
        {/* 右下 */}
        {line({ right: r(17), top: r(35), width: r(8), transform: "rotate(-57deg)", transformOrigin: "right center" })}

        {/* ─ 子ノード（左）─ */}
        <div style={{ position: "absolute", left: r(2), top: r(14), width: r(20), height: r(10), background: "rgba(255,255,255,0.85)", borderRadius: r(5) }} />
        <div style={{ position: "absolute", left: r(2), top: r(40), width: r(20), height: r(10), background: "rgba(255,255,255,0.85)", borderRadius: r(5) }} />

        {/* ─ 中央ノード ─ */}
        <div style={{ position: "absolute", left: r(15), top: r(26), width: r(34), height: r(12), background: "white", borderRadius: r(6) }} />

        {/* ─ 子ノード（右）─ */}
        <div style={{ position: "absolute", right: r(2), top: r(14), width: r(20), height: r(10), background: "rgba(255,255,255,0.85)", borderRadius: r(5) }} />
        <div style={{ position: "absolute", right: r(2), top: r(40), width: r(20), height: r(10), background: "rgba(255,255,255,0.85)", borderRadius: r(5) }} />
      </div>
    ),
    { width: s, height: s }
  );
}
