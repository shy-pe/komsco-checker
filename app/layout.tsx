import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KOMSCO Service Monitor",
  description: "고객사이트의 접속 상태와 응답 속도를 확인하고 장애 발생 시 알림을 제공하는 서비스 모니터링 대시보드입니다."
};


export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
