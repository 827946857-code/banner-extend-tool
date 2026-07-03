import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Banner 延展工具",
  description: "上传一张 Banner，自动生成所有平台尺寸",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
