"use client"

import { BannerSize } from "@/lib/bannerSizes"

type Status = "idle" | "loading" | "done" | "error"

interface SizeCardProps {
  size: BannerSize
  status: Status
  resultUrl?: string
  originalRatio?: number
  disabled?: boolean
  onCrop: () => void
  onGenerate: () => void
}

function getRecommendation(size: BannerSize, originalRatio?: number) {
  if (size.forceRecommend) return size.forceRecommend === "ai" ? "ai" : "crop"
  if (!originalRatio) return "crop"
  const targetRatio = size.width / size.height
  const diff = Math.abs(targetRatio - originalRatio) / originalRatio
  if (diff < 0.15) return "crop"
  if (diff < 0.4) return "either"
  return "ai"
}

export default function SizeCard({
  size,
  status,
  resultUrl,
  originalRatio,
  disabled = false,
  onCrop,
  onGenerate,
}: SizeCardProps) {
  const ratio = size.width / size.height
  const previewW = Math.min(size.width, 180)
  const previewH = Math.round(previewW / ratio)
  const recommend = getRecommendation(size, originalRatio)

  if (disabled) {
    return (
      <div className="size-card rounded-xl p-4 flex flex-col gap-3 opacity-70">
        {/* 标题行 */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-white/70 text-sm font-medium leading-tight">{size.name}</p>
            <p className="text-white/30 text-xs mt-0.5">
              {size.width} × {size.height} px
            </p>
          </div>
          <span className="tag-platform text-xs px-2 py-0.5 rounded-full whitespace-nowrap opacity-60">
            {size.platform}
          </span>
        </div>

        {/* 骨架预览区 */}
        <div
          className="rounded-lg overflow-hidden bg-white/5 border border-white/5 flex items-center justify-center mx-auto animate-pulse"
          style={{ width: previewW, height: previewH, maxWidth: "100%" }}
        >
          <div className="w-full h-full bg-white/5" />
        </div>

        {/* 禁用按钮 */}
        <div className="flex gap-2">
          <button
            disabled
            className="flex-1 text-xs py-1.5 rounded-lg border transition opacity-30 cursor-not-allowed bg-white/5 border-white/10 text-white/60"
          >
            快速裁切
          </button>
          <button
            disabled
            className="flex-1 text-xs py-1.5 rounded-lg border transition opacity-30 cursor-not-allowed bg-indigo-500/10 border-indigo-500/20 text-indigo-400/70"
          >
            AI 生成
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="size-card rounded-xl p-4 flex flex-col gap-3">
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white/90 text-sm font-medium leading-tight">{size.name}</p>
          <p className="text-white/35 text-xs mt-0.5">
            {size.width} × {size.height} px
          </p>
        </div>
        <span className="tag-platform text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
          {size.platform}
        </span>
      </div>

      {/* 推荐提示 */}
      {originalRatio && (
        <div className={`text-xs px-2 py-1 rounded-md flex items-center gap-1.5 ${
          recommend === "crop"
            ? "bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15"
            : recommend === "ai"
            ? "bg-indigo-500/10 text-indigo-400/80 border border-indigo-500/15"
            : "bg-amber-500/10 text-amber-400/80 border border-amber-500/15"
        }`}>
          {recommend === "crop" && <><span>✓</span><span>比例相近，推荐快速裁切（不变形）</span></>}
          {recommend === "either" && <><span>～</span><span>比例有差异，可裁切也可 AI 生成</span></>}
          {recommend === "ai" && <><span>✦</span><span>比例差异大，推荐 AI 重新生成</span></>}
        </div>
      )}

      {/* 预览区 */}
      <div
        className="rounded-lg overflow-hidden bg-white/5 border border-white/5 flex items-center justify-center mx-auto"
        style={{ width: previewW, height: previewH, maxWidth: "100%" }}
      >
        {status === "loading" ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            <span className="text-white/30 text-xs">生成中…</span>
            <span className="text-white/20 text-[10px] leading-tight text-center px-2">AI 生成约 20–40 秒</span>
          </div>
        ) : resultUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resultUrl} alt={size.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-white/15 text-xs text-center px-2">
            {size.width}×{size.height}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={onCrop}
          disabled={status === "loading"}
          className={`flex-1 text-xs py-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
            recommend === "crop"
              ? "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 text-emerald-300 hover:text-emerald-200 font-medium"
              : "bg-white/5 hover:bg-white/10 border-white/10 text-white/60 hover:text-white/90"
          }`}
        >
          快速裁切
        </button>
        <button
          onClick={onGenerate}
          disabled={status === "loading"}
          className={`flex-1 text-xs py-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
            recommend === "ai"
              ? "bg-indigo-500/30 hover:bg-indigo-500/40 border-indigo-500/50 text-indigo-200 hover:text-indigo-100 font-medium"
              : "bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20 text-indigo-400/70 hover:text-indigo-300"
          }`}
        >
          AI 生成
        </button>
        {status === "done" && resultUrl && (
          <button
            onClick={onGenerate}
            title="重新 AI 生成"
            className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400/70 hover:text-indigo-300 transition text-xs"
          >
            ↺
          </button>
        )}
        {resultUrl && (
          <a
            href={resultUrl}
            download={`${size.id}_${size.width}x${size.height}.png`}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/80 transition text-xs"
          >
            ↓
          </a>
        )}
      </div>

      {status === "error" && (
        <p className="text-red-400/80 text-xs text-center">生成失败，请重试</p>
      )}
    </div>
  )
}
