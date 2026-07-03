"use client"

import { useState, useCallback, useRef } from "react"
import JSZip from "jszip"
import UploadZone from "@/components/UploadZone"
import SizeCard from "@/components/SizeCard"
import { BANNER_SIZES, PLATFORMS } from "@/lib/bannerSizes"

type Status = "idle" | "loading" | "done" | "error"

interface SizeState {
  status: Status
  resultUrl?: string
}

type LayoutType = "person_right" | "person_left" | "person_center" | "text_only" | "auto"

interface LayoutInfo {
  layoutType: LayoutType
  layoutName: string
  description: string
}

export default function Home() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imgMeta, setImgMeta] = useState<{ width: number; height: number } | null>(null)
  const [sizeStates, setSizeStates] = useState<Record<string, SizeState>>({})
  const [activePlatform, setActivePlatform] = useState<string>("全部")
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchAiLoading, setBatchAiLoading] = useState(false)
  const [zipLoading, setZipLoading] = useState(false)
  const [layoutInfo, setLayoutInfo] = useState<LayoutInfo | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleUpload = useCallback(async (file: File, url: string) => {
    setOriginalFile(file)
    setPreviewUrl(url)
    setSizeStates({})
    setLayoutInfo(null)
    const img = new Image()
    img.onload = () => setImgMeta({ width: img.naturalWidth, height: img.naturalHeight })
    img.src = url

    // 自动调用布局分析
    setAnalyzing(true)
    try {
      const fd = new FormData()
      fd.append("image", file)
      const res = await fetch("/api/analyze", { method: "POST", body: fd })
      if (res.ok) {
        const data = await res.json()
        setLayoutInfo({
          layoutType: data.layoutType,
          layoutName: data.layoutName,
          description: data.description,
        })
      }
    } catch {
      // 分析失败不阻塞主流程，使用 auto 兜底
    } finally {
      setAnalyzing(false)
    }
  }, [])

  const updateSize = (id: string, patch: Partial<SizeState>) => {
    setSizeStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: "idle", ...patch },
    }))
  }

  const handleCrop = useCallback(
    async (id: string) => {
      if (!originalFile) return
      const size = BANNER_SIZES.find((s) => s.id === id)!
      updateSize(id, { status: "loading" })
      try {
        // 根据布局类型决定裁切偏好
        let bias = size.cropBias || "right"
        if (layoutInfo?.layoutType === "person_left") bias = "left"
        else if (layoutInfo?.layoutType === "person_center" || layoutInfo?.layoutType === "text_only") bias = "center"

        const fd = new FormData()
        fd.append("image", originalFile)
        fd.append("width", String(size.width))
        fd.append("height", String(size.height))
        fd.append("bias", bias)
        const res = await fetch("/api/crop", { method: "POST", body: fd })
        if (!res.ok) throw new Error("裁切失败")
        const blob = await res.blob()
        updateSize(id, { status: "done", resultUrl: URL.createObjectURL(blob) })
      } catch {
        updateSize(id, { status: "error" })
      }
    },
    [originalFile, layoutInfo]
  )

  const handleGenerate = useCallback(
    async (id: string) => {
      if (!originalFile) return
      const size = BANNER_SIZES.find((s) => s.id === id)!
      updateSize(id, { status: "loading" })
      try {
        const fd = new FormData()
        fd.append("image", originalFile)
        fd.append("width", String(size.width))
        fd.append("height", String(size.height))
        fd.append("sizeName", size.name)
        fd.append("layoutType", layoutInfo?.layoutType || "auto")
        const res = await fetch("/api/generate", { method: "POST", body: fd })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "AI 生成失败")
        }
        const blob = await res.blob()
        updateSize(id, { status: "done", resultUrl: URL.createObjectURL(blob) })
      } catch {
        updateSize(id, { status: "error" })
      }
    },
    [originalFile, layoutInfo]
  )

  const handleBatchCrop = useCallback(async () => {
    if (!originalFile) return
    setBatchLoading(true)
    const targets = activePlatform === "全部"
      ? BANNER_SIZES
      : BANNER_SIZES.filter((s) => s.platform === activePlatform)
    await Promise.all(targets.map((s) => handleCrop(s.id)))
    setBatchLoading(false)
  }, [originalFile, activePlatform, handleCrop])

  const handleBatchGenerate = useCallback(async () => {
    if (!originalFile) return
    setBatchAiLoading(true)
    const targets = activePlatform === "全部"
      ? BANNER_SIZES
      : BANNER_SIZES.filter((s) => s.platform === activePlatform)
    await Promise.all(targets.map((s) => handleGenerate(s.id)))
    setBatchAiLoading(false)
  }, [originalFile, activePlatform, handleGenerate])

  const handleDownloadZip = useCallback(async () => {
    setZipLoading(true)
    try {
      const zip = new JSZip()
      const doneEntries = BANNER_SIZES.filter(
        (s) => sizeStates[s.id]?.status === "done" && sizeStates[s.id]?.resultUrl
      )
      await Promise.all(
        doneEntries.map(async (size) => {
          const url = sizeStates[size.id].resultUrl!
          const res = await fetch(url)
          const blob = await res.blob()
          const fileName = `${size.name}_${size.width}x${size.height}.png`
          zip.file(fileName, blob)
        })
      )
      const content = await zip.generateAsync({ type: "blob" })
      const date = new Date()
      const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
      const a = document.createElement("a")
      a.href = URL.createObjectURL(content)
      a.download = `banner_export_${dateStr}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setZipLoading(false)
    }
  }, [sizeStates])

  const filteredSizes = activePlatform === "全部"
    ? BANNER_SIZES
    : BANNER_SIZES.filter((s) => s.platform === activePlatform)

  const allStates = Object.values(sizeStates)
  const doneCount = allStates.filter((s) => s.status === "done").length
  const loadingCount = allStates.filter((s) => s.status === "loading").length

  return (
    <div className="min-h-screen pb-16">
      <header className="border-b border-white/5 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        </div>
        <div>
          <h1 className="text-white/90 font-semibold text-sm">Banner 延展工具</h1>
          <p className="text-white/30 text-xs">上传一张，自动生成所有平台尺寸</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8">

          <div className="flex flex-col gap-4">
            <UploadZone onUpload={handleUpload} />

            {previewUrl && (
              <div className="glass-card rounded-xl p-4">
                <p className="text-white/50 text-xs mb-2 font-medium uppercase tracking-wider">原图预览</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={previewUrl} alt="原图" className="w-full rounded-lg object-cover" />
                {imgMeta && (
                  <div className="flex gap-4 mt-3">
                    <div>
                      <p className="text-white/30 text-xs">尺寸</p>
                      <p className="text-white/70 text-sm font-mono">{imgMeta.width} × {imgMeta.height}</p>
                    </div>
                    <div>
                      <p className="text-white/30 text-xs">文件名</p>
                      <p className="text-white/70 text-sm truncate max-w-[160px]">{originalFile?.name}</p>
                    </div>
                  </div>
                )}

                {/* 布局智能识别结果 */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-white/30 text-xs mb-1.5">布局识别</p>
                  {analyzing ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                      <span className="text-white/40 text-xs">分析中…</span>
                    </div>
                  ) : layoutInfo ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-emerald-300/90 text-sm font-medium">{layoutInfo.layoutName}</span>
                      </div>
                      {layoutInfo.description && (
                        <p className="text-white/40 text-xs leading-relaxed">{layoutInfo.description}</p>
                      )}
                      <p className="text-white/25 text-xs mt-1.5">
                        AI 生成时将自动适配此布局，无需强制左文右图
                      </p>
                    </div>
                  ) : (
                    <p className="text-white/30 text-xs">未识别（将使用自适应模式）</p>
                  )}
                </div>
              </div>
            )}

            {originalFile && (
              <div className="glass-card rounded-xl p-4 flex flex-col gap-3">
                <p className="text-white/50 text-xs font-medium uppercase tracking-wider">批量操作</p>
                <button
                  onClick={handleBatchCrop}
                  disabled={batchLoading || batchAiLoading}
                  className="btn-primary text-white text-sm font-medium py-2.5 rounded-lg w-full"
                >
                  {batchLoading ? "批量裁切中…" : `一键裁切（${filteredSizes.length} 个尺寸）`}
                </button>
                <button
                  onClick={handleBatchGenerate}
                  disabled={batchLoading || batchAiLoading}
                  className="text-sm font-medium py-2.5 rounded-lg w-full border transition disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500/40 hover:border-indigo-500/60 text-indigo-300 hover:text-indigo-200"
                >
                  {batchAiLoading ? "AI 生成中…" : `一键 AI 生成（${filteredSizes.length} 个尺寸）`}
                </button>
                {(doneCount > 0 || loadingCount > 0) && (
                  <p className="text-xs text-center leading-relaxed">
                    <span className="text-emerald-400/80">已完成 {doneCount} / {filteredSizes.length} 个</span>
                    {loadingCount > 0 && (
                      <span className="text-orange-400/80 ml-2">生成中 {loadingCount} 个</span>
                    )}
                  </p>
                )}
                {doneCount >= 2 && (
                  <button
                    onClick={handleDownloadZip}
                    disabled={zipLoading}
                    className="text-sm font-medium py-2.5 rounded-lg w-full border transition disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300 hover:text-emerald-200"
                  >
                    {zipLoading ? "打包中…" : `📦 打包下载全部（${doneCount} 张）`}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="border-b border-white/5 pb-3 mb-1">
              <div className="flex gap-2 flex-wrap">
                {["全部", ...PLATFORMS].map((p) => (
                  <button
                    key={p}
                    onClick={() => setActivePlatform(p)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      activePlatform === p
                        ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                        : "bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                    }`}
                  >
                    {p}
                    {p !== "全部" && (
                      <span className="ml-1 opacity-60">
                        {BANNER_SIZES.filter((s) => s.platform === p).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredSizes.map((size) => (
                <SizeCard
                  key={size.id}
                  size={size}
                  status={sizeStates[size.id]?.status ?? "idle"}
                  resultUrl={sizeStates[size.id]?.resultUrl}
                  originalRatio={imgMeta ? imgMeta.width / imgMeta.height : undefined}
                  disabled={!originalFile}
                  onCrop={() => handleCrop(size.id)}
                  onGenerate={() => handleGenerate(size.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
