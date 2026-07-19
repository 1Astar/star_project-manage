import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS / 部分浏览器用的圆角触控图标 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
          background: "linear-gradient(145deg, #312e81 0%, #4f46e5 55%, #818cf8 100%)",
          color: "#eef2ff",
          fontSize: 96,
          fontWeight: 700,
        }}
      >
        ✦
      </div>
    ),
    { ...size }
  );
}
