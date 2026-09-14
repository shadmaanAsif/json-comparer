import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "./site-config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 24,
        padding: "80px 96px",
        background: "#081018",
        color: "#f0f5f7",
        fontFamily: "sans-serif"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 88,
            height: 88,
            borderRadius: 16,
            background: "#0e1822",
            color: "#3dd7b2",
            fontSize: 44,
            fontWeight: 700
          }}
        >
          {"{ }"}
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>{SITE_NAME}</div>
      </div>
      <div style={{ display: "flex", fontSize: 32, color: "#93a7b5", maxWidth: 900 }}>
        {SITE_DESCRIPTION}
      </div>
    </div>,
    { ...size }
  );
}
