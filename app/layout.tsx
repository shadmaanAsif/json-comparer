import type { Metadata } from "next";
import "driver.js/dist/driver.css";
import "./globals.css";
import "@/features/comparer/comparer.css";

export const metadata: Metadata = {
  title: "JSON Comparer",
  description: "Compare JSON responses privately in your browser."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
