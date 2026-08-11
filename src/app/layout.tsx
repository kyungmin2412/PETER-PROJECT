import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "투자 대시보드 | Peter's Dashboard",
  description: "미국·한국 시장 지표를 한눈에 보는 투자 대시보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
