import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
  timeout: 30_000,
})

export interface LayoutAnalysis {
  layoutType: "person_right" | "person_left" | "person_center" | "text_only"
  layoutName: string
  hasPerson: boolean
  mainElementPosition: "left" | "center" | "right" | "full"
  description: string
}

const LAYOUT_NAMES: Record<LayoutAnalysis["layoutType"], string> = {
  person_right: "人物居右 · 左文右图",
  person_left: "人物居左 · 右文左图",
  person_center: "人物居中",
  text_only: "纯文字主视觉",
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("image") as File | null

    if (!file) {
      return NextResponse.json({ error: "缺少图片" }, { status: 400 })
    }

    // 转 base64 data URL，gpt-4o 视觉接口要求
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString("base64")
    const mimeType = file.type || "image/png"
    const dataUrl = `data:${mimeType};base64,${base64}`

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `分析这张 Banner 图的布局结构，只返回 JSON，不要任何其他文字。
判断标准：
- 是否包含真人肖像？人物在画面中的位置（左/中/右）？
- 如果没有人像，是否以大字标题为视觉主体？

返回格式（严格 JSON）：
{
  "hasPerson": true/false,
  "personPosition": "left" | "center" | "right" | "none",
  "mainElementPosition": "left" | "center" | "right" | "full",
  "description": "一句话描述这张图的布局特征"
}`,
            },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 200,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: "分析失败" }, { status: 500 })
    }

    const parsed = JSON.parse(content)

    // 推导 layoutType
    let layoutType: LayoutAnalysis["layoutType"]
    if (!parsed.hasPerson || parsed.personPosition === "none") {
      layoutType = "text_only"
    } else if (parsed.personPosition === "right") {
      layoutType = "person_right"
    } else if (parsed.personPosition === "left") {
      layoutType = "person_left"
    } else {
      layoutType = "person_center"
    }

    const result: LayoutAnalysis = {
      layoutType,
      layoutName: LAYOUT_NAMES[layoutType],
      hasPerson: !!parsed.hasPerson,
      mainElementPosition: parsed.mainElementPosition || "center",
      description: parsed.description || "",
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error("analyze error:", err)
    const msg = err instanceof Error ? err.message : "布局分析失败"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
