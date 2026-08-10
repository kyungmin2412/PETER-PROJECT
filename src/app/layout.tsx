import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "미국 시장 데일리 | Peter's Dashboard",
  description: "미국·한국 시장 데일리 브리핑 대시보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
