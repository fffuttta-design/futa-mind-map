import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#6366f1",
          borderRadius: 7,
          position: "relative",
          display: "flex",
        }}
      >
        {/* 接続線（回転した細い div で表現）*/}
        <div style={{ position: "absolute", left: 12, top: 12, width: 9, height: 2, background: "rgba(255,255,255,0.65)", transform: "rotate(-30deg)", transformOrigin: "left center" }} />
        <div style={{ position: "absolute", left: 12, top: 19, width: 9, height: 2, background: "rgba(255,255,255,0.65)", transform: "rotate(30deg)",  transformOrigin: "left center" }} />
        <div style={{ position: "absolute", right: 12, top: 12, width: 9, height: 2, background: "rgba(255,255,255,0.65)", transform: "rotate(30deg)",  transformOrigin: "right center" }} />
        <div style={{ position: "absolute", right: 12, top: 19, width: 9, height: 2, background: "rgba(255,255,255,0.65)", transform: "rotate(-30deg)", transformOrigin: "right center" }} />

        {/* 子ノード（左）*/}
        <div style={{ position: "absolute", left: 1,  top: 7,  width: 11, height: 6, background: "rgba(255,255,255,0.85)", borderRadius: 3 }} />
        <div style={{ position: "absolute", left: 1,  top: 19, width: 11, height: 6, background: "rgba(255,255,255,0.85)", borderRadius: 3 }} />

        {/* 中央ノード */}
        <div style={{ position: "absolute", left: 8,  top: 13, width: 16, height: 6, background: "white", borderRadius: 3 }} />

        {/* 子ノード（右）*/}
        <div style={{ position: "absolute", right: 1, top: 7,  width: 11, height: 6, background: "rgba(255,255,255,0.85)", borderRadius: 3 }} />
        <div style={{ position: "absolute", right: 1, top: 19, width: 11, height: 6, background: "rgba(255,255,255,0.85)", borderRadius: 3 }} />
      </div>
    ),
    { ...size }
  );
}
