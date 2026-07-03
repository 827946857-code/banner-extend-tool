import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"

// bias: "left" | "center" | "right"
// left  → 保留左侧（文字区优先）
// right → 保留右侧（人物区优先）
// center → 居中裁切
function calcCrop(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  bias: "left" | "center" | "right"
) {
  const targetRatio = targetW / targetH
  const srcRatio = srcW / srcH

  let cropW: number, cropH: number, left: number, top: number

  if (srcRatio > targetRatio) {
    // 原图更宽 → 水平裁切
    cropH = srcH
    cropW = Math.round(srcH * targetRatio)
    if (bias === "left") {
      left = 0
    } else if (bias === "right") {
      left = srcW - cropW
    } else {
      left = Math.round((srcW - cropW) / 2)
    }
    top = 0
  } else {
    // 原图更高 → 垂直裁切，偏上（banner 主体通常在上方）
    cropW = srcW
    cropH = Math.round(srcW / targetRatio)
    left = 0
    top = Math.round((srcH - cropH) * 0.25)
  }

  return { left, top, width: cropW, height: cropH }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("image") as File | null
    const width = parseInt(formData.get("width") as string)
    const height = parseInt(formData.get("height") as string)
    const bias = (formData.get("bias") as string) || "right"

    if (!file || !width || !height) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const meta = await sharp(buffer).metadata()
    const { left, top, width: cropW, height: cropH } = calcCrop(
      meta.width!,
      meta.height!,
      width,
      height,
      bias as "left" | "center" | "right"
    )

    const outputBuffer = await sharp(buffer)
      .extract({ left, top, width: cropW, height: cropH })
      .resize(width, height, { fit: "fill" })
      .png()
      .toBuffer()

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    })
  } catch (err) {
    console.error("crop error:", err)
    return NextResponse.json({ error: "裁切失败" }, { status: 500 })
  }
}
