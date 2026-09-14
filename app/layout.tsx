import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KOMSCO PulseBoard",
  description: "경영정보 고객사이트 서버 헬스체크 대시보드"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
