import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
  timeout: 120_000,
})

type LayoutType = "person_right" | "person_left" | "person_center" | "text_only" | "auto"

// 通用关键规则
const COMMON_RULES = `关键要求：
1. 单纯延展尺寸，禁止添加任何标注或额外元素
2. 保持原画面元素完全一致，禁止添加任何额外元素
3. 标题文字根据新尺寸自动适配行数（1-4行），保证文字可读性和视觉美观
4. 背景不变，风格样式与原始图片保持完全一致
5. 保持原文案不变
6. 文字、元素、人像不要拉伸变形，脸部要清晰
7. logo/角标高度固定，不要丢失且清晰可见（logo整体大小占尺寸的30%）
8. 生成一张直接可以宣传的图片
9. 保持图片完整，禁止画中画，四周不要留白

# 人物与画面保护规则（必须严格遵守）
- 人像清晰无变形，脸部细节完整，禁止模糊
- 禁止拉伸人像，人像比例须与原图完全一致
- 文字、元素不拉伸变形
- 禁止画中画，四周不留白，保持图片完整铺满

# Logo 等比缩放约束（必须严格遵守）
- Logo/角标必须等比例缩放，严禁拉伸或压扁，宽高比与原图 Logo 保持完全一致
- Logo 在超宽尺寸（宽高比 > 2.5:1）中，高度不低于画布高度的 18%，以等比方式决定宽度

# 文字间距自适应规则（必须严格遵守）
- 主标题文字间距（letter-spacing）根据画布宽度自适应：宽幅尺寸（宽 > 700px）适当加宽间距增强视觉舒适感，窄幅尺寸（宽 < 400px）收紧间距确保完整显示
- 副标题和底部辅助文字间距保持自然，不拉伸、不压缩，与主标题间距保持协调
- 禁止出现字符间距异常过宽（如底部日期/学时文字间距与主标题相同）`

// 根据布局类型返回对应的"构图方向"片段
function layoutStrategy(layout: LayoutType): string {
  switch (layout) {
    case "person_right":
      return `# 布局策略：人物居右 · 左文右图
- 整体构图：左文右图布局，文字区在左侧，人物在右侧
- 顶部预留 logo/角标区域
- 人物固定在右侧图片区，不得越出边界
- 文字信息集中在左侧文字安全区内`
    case "person_left":
      return `# 布局策略：人物居左 · 右文左图
- 整体构图：右文左图布局，人物在左侧，文字区在右侧
- 顶部预留 logo/角标区域
- 人物固定在左侧图片区，保持原位置不动，不得越出边界
- 文字信息集中在右侧文字安全区内
- 注意：禁止将人物强制移到右侧，必须保留原图的人物在左的位置`
    case "person_center":
      return `# 布局策略：人物居中
- 整体构图：人物居中布局，文字在人物上下或两侧
- 顶部预留 logo/角标区域
- 人物保持原位置居中，不得越出边界
- 文字根据新比例在人物周围合理分布
- 当目标尺寸更宽时，人物保持居中，文字向两侧延展
- 当目标尺寸更窄时，文字可置于人物上方或下方`
    case "text_only":
      return `# 布局策略：纯文字主视觉
- 整体构图：以大字标题为视觉主体，居中或铺满布局
- 顶部预留 logo/角标区域
- 标题文字作为主视觉元素，保持原图大字气势和位置
- 当目标尺寸更宽时，文字保持原字号或适当加大，背景向两侧延展
- 当目标尺寸更窄时，文字自动换行适配，但保持醒目
- 禁止将大字标题强行挤到一侧
- 辅助文字（日期、副标题）置于标题下方或两侧`
    default:
      return `# 布局策略：自适应
- 顶部预留 logo/角标区域
- 根据原图的视觉重心合理布局
- 保持原图所有元素的位置关系`
  }
}

// 布局头部前缀
function layoutHeader(w: number, h: number, name: string, layout: LayoutType): string {
  return `将这张图生成以下尺寸的新 banner，具体尺寸和设计规范：
#尺寸：${w}px × ${h}px
#用途：${name}
${layoutStrategy(layout)}`
}

// 专用 Prompt Map，key = "宽x高"
const PROMPT_MAP: Record<string, (name: string, layout: LayoutType) => string> = {

  // 研修 PC 端 698×308（比例约2.27:1）
  "698x308": (name, layout) => `${layoutHeader(698, 308, name, layout)}
-文字安全区域（白色块）边界约束（百分比，百分比不显示）：
- -顶部logo/角标区距离顶边距 左边距：36%
- -文字安全区域左内边距：60%
- -文字安全区域右内边距：60%
- -文字安全区域上内边距（距logo区底部）：44%
- -文字安全区域下内边距：88%
${COMMON_RULES}`,

  // 学科网 Banner PC 642×206（超宽扁平）
  "642x206": (name, layout) => `${layoutHeader(642, 206, name, layout)}
-文字安全区域（白色块）边界约束（百分比，百分比不显示）：
- -顶部logo/角标区距离顶边距 左边距：28%
- -文字安全区域左内边距：55%
- -文字安全区域右内边距：55%
- -文字安全区域上内边距（距logo区底部）：40%
- -文字安全区域下内边距：84%
${COMMON_RULES}`,

  // M 站 Banner 696×226（超宽扁平）
  "696x226": (name, layout) => `${layoutHeader(696, 226, name, layout)}
-文字安全区域（白色块）边界约束（百分比，百分比不显示）：
- -顶部logo/角标区距离顶边距 左边距：29%
- -文字安全区域左内边距：56%
- -文字安全区域右内边距：56%
- -文字安全区域上内边距（距logo区底部）：41%
- -文字安全区域下内边距：85%
${COMMON_RULES}`,

  // 子站 Banner 627×201（超宽扁平）
  "627x201": (name, layout) => `${layoutHeader(627, 201, name, layout)}
-文字安全区域（白色块）边界约束（百分比，百分比不显示）：
- -顶部logo/角标区距离顶边距 左边距：28%
- -文字安全区域左内边距：55%
- -文字安全区域右内边距：55%
- -文字安全区域上内边距（距logo区底部）：40%
- -文字安全区域下内边距：84%
${COMMON_RULES}`,

  // 直播系统封面 288×180（接近16:9）
  "288x180": (_name, layout) => `基于参考图生成 288×180px 直播系统封面。

#尺寸：288px × 180px
${layoutStrategy(layout)}
- 文字安全区约束：
  - 顶部 logo/角标区距顶边距左边距：22%
  - 文字安全区左内边距：62%
  - 文字安全区右内边距：62%
  - 文字安全区上内边距（距 logo 底部）：40%
  - 文字安全区下内边距：85%

#关键要求
1. 单纯延展尺寸，禁止添加任何标注或额外元素
2. 保持原画面元素完全一致，禁止添加任何额外元素
3. 标题文字根据新尺寸自动适配行数（1-3行），保证文字可读性
4. 背景不变，风格样式与原始图片保持完全一致
5. 保持原文案不变
6. 文字、元素、人像不要拉伸变形，脸部清晰
7. logo/角标高度固定，清晰可见（logo 整体大小占尺寸的 22%）
8. 生成一张直接可以宣传的图片
9. 保持图片完整，禁止画中画，四周不留白
10. 人像清晰无变形，禁止拉伸`,

  // 新媒体推文 Banner 900×383
  "900x383": (_name, layout) => `基于参考图生成 900×383px 新媒体推文 Banner。

#尺寸：900px × 383px
${layoutStrategy(layout)}
- 文字安全区约束：
  - 顶部 logo/角标区距顶边距左边距：36%
  - 文字安全区左内边距：60%
  - 文字安全区右内边距：60%
  - 文字安全区上内边距（距 logo 底部）：44%
  - 文字安全区下内边距：88%

#关键要求
1. 单纯延展尺寸，禁止添加任何标注或额外元素
2. 保持原画面元素完全一致，禁止添加任何额外元素
3. 标题文字根据新尺寸自动适配行数（1-4行），保证文字可读性和视觉美观
4. 背景不变，风格样式与原始图片保持完全一致
5. 保持原文案不变
6. 文字、元素、人像不要拉伸变形，脸部清晰
7. logo/角标高度固定，清晰可见（logo 整体大小占尺寸的 30%）
8. 生成一张直接可以宣传的图片
9. 保持图片完整，禁止画中画，四周不留白
10. 人像清晰无变形，禁止拉伸`,

  // 小鹅通 直播暖场 750×423
  "750x423": (_name, layout) => `基于参考图生成 750×423px 小鹅通直播暖场 Banner。

#尺寸：750px × 423px
${layoutStrategy(layout)}
- 文字安全区约束：
  - 顶部 logo/角标区距顶边距左边距：26%
  - 文字安全区左内边距：65%
  - 文字安全区右内边距：65%
  - 文字安全区上内边距（距 logo 底部）：42%
  - 文字安全区下内边距：86%

#关键要求
1. 单纯延展尺寸，禁止添加任何标注或额外元素
2. 保持原画面元素完全一致，禁止添加任何额外元素
3. 标题文字根据新尺寸自动适配行数（1-4行），允许换行至3-4行，保证可读性
4. 背景不变，风格样式与原始图片保持完全一致
5. 保持原文案不变
6. 文字、元素、人像不要拉伸变形，脸部清晰
7. logo/角标高度固定，清晰可见（logo 整体大小占尺寸的 26%）
8. 生成一张直接可以宣传的图片
9. 保持图片完整，禁止画中画，四周不留白
10. 人像清晰无变形，禁止拉伸，人物可展示 3/4 身`,

  // 小鹅通 宣传 Banner 750×240（超宽扁平）
  "750x240": (name, layout) => `${layoutHeader(750, 240, name, layout)}
-文字安全区域（白色块）边界约束（百分比，百分比不显示）：
- -顶部logo/角标区距离顶边距 左边距：29%
- -文字安全区域左内边距：55%
- -文字安全区域右内边距：55%
- -文字安全区域上内边距（距logo区底部）：40%
- -文字安全区域下内边距：84%
${COMMON_RULES}`,

  // 小鹅通 中职 Banner 715×260
  "715x260": (name, layout) => `${layoutHeader(715, 260, name, layout)}
-文字安全区域（白色块）边界约束（百分比，百分比不显示）：
- -顶部logo/角标区距离顶边距 左边距：32%
- -文字安全区域左内边距：58%
- -文字安全区域右内边距：58%
- -文字安全区域上内边距（距logo区底部）：43%
- -文字安全区域下内边距：86%
${COMMON_RULES}`,

  // 矩形侧边栏 80×200（极窄竖版，按布局类型差异化处理）
  "80x200": (_name, layout) => `基于参考图生成 80px×200px 竖版角标。严格按 80×200px 输出，无任何像素偏差。

# 文案提取规则（核心：精简到 4-6 字关键词，禁止照搬原标题）
- 必须从原标题中提取最具识别度的核心关键词，控制在 4-6 字以内
- 禁止直接竖排堆叠原标题（如"全场精品资源低至1元"→提取"精品1元"；"期末备考专场"→提取"期末备考"或"备考专场"）
- 辅助短句控制在 1-4 字（如"1元抢""领证书""限时购"），字号为核心标题的 30%-35%
${
  layout === "text_only"
    ? `- 布局类型：纯文字主视觉。采用激进精简策略，只保留 4 个最具视觉冲击力的核心字，舍去所有修饰词和连接词\n- 例：原标题"全场精品资源低至1元"→核心字"精品1元"或"1元精选"`
    : layout === "person_right" || layout === "person_left" || layout === "person_center"
      ? `- 布局类型：人物素材。可保留人物头像缩略图置于顶部（高度不超过 35%），核心关键词置于人物下方竖排\n- 例：原标题"期末备考专场"→核心字"期末备考"或"备考专场"`
      : `- 布局类型：自适应。提取 4-6 字核心关键词竖排`
}

# 竖排排版规则（必须严格遵守，解决重叠问题）
- 竖排最多 3 行，每行 2-3 字，禁止单列堆叠 4 字以上
- 推荐分组示例（4字→2行：精品/1元；5字→2行：期末/备考专场→改为 期末/备考；6字→3行：教师/AI/素养）
- 每行字符横向居中排列，行与行之间垂直堆叠
- 行间距：相邻两行之间必须留出清晰可见的垂直空白，间距不小于单字高度的 25%
- 严禁字符上下重叠、咬合、贴边堆叠
- 字符间距（letter-spacing）均匀，禁止忽宽忽窄

# 字号自适应规则（防止撑爆 80px 宽度）
- 单个汉字宽度不得超过画布宽度的 70%（即 ≤56px），左右各留至少 12px 安全边距
- 字数越少字号越大，但任何情况下单字都不接触左右边缘
- 字数 2-3 字：字号约占画布宽度 60%-70%
- 字数 4-6 字：字号约占画布宽度 45%-55%
- 整组核心标题垂直高度占画布 55%-65%（不含底部辅助区）

# 垂直分区布局（自上而下）
- 顶部 0%-12%：留白或 logo/角标区（本尺寸可不放 logo）
- 中部 12%-80%：核心关键词竖排居中区域
- 底部 80%-100%：辅助短句区（1-4 字福利/日期/动作词），字号小、居中、与核心标题保持明显间距
- 严禁辅助文字与核心标题挤在一起

# 背景与视觉规则
- 极窄空间下背景保持纯色或简单线性渐变，禁止复杂纹理、图案、噪点干扰文字
- 可复用参考图的主色调和氛围（如蓝紫渐变、橙黄渐变），但简化为纯净底色
- 核心标题字形样式（描边、渐变填色）尽量复刻原图风格，但字号必须按上述规则缩小
- 禁止在 80px 宽度内塞入原图的小图标、金币、按钮等细碎元素

# 禁止项
- 禁止字符上下重叠、咬合、贴边
- 禁止单字宽度超过画布 70%
- 禁止横向排列核心标题（必须竖排分组）
- 禁止照搬原标题全文
- 禁止复杂背景纹理
- 禁止添加标注、边框、多余文字、Logo
- 禁止缩边/裁剪、画中画、四周留白
- 生成后可直接作为角标使用`,
}

function buildPrompt(width: number, height: number, sizeName: string, layout: LayoutType): string {
  const key = `${width}x${height}`
  const builder = PROMPT_MAP[key]
  if (builder) return builder(sizeName, layout)

  // 兜底
  const ratio = width / height
  const orientation = ratio > 1.5 ? "横版宽幅" : ratio < 0.8 ? "竖版" : "接近正方形"
  return `${layoutHeader(width, height, sizeName, layout)}
-文字安全区域（白色块）边界约束（百分比，百分比不显示）：
- -顶部logo/角标区距离顶边距 左边距：${ratio > 2.5 ? 30 : 36}%
- -文字安全区域左内边距：${ratio > 2.5 ? 55 : 60}%
- -文字安全区域右内边距：${ratio > 2.5 ? 55 : 60}%
- -文字安全区域上内边距（距logo区底部）：44%
- -文字安全区域下内边距：88%
${COMMON_RULES}
整体构图方向：${orientation}`
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("image") as File | null
    const width = parseInt(formData.get("width") as string)
    const height = parseInt(formData.get("height") as string)
    const sizeName = formData.get("sizeName") as string
    const layoutType = (formData.get("layoutType") as LayoutType) || "auto"

    if (!file || !width || !height) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 })
    }

    const prompt = buildPrompt(width, height, sizeName, layoutType)
    const ratio = width / height

    const imageFile = await OpenAI.toFile(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      { type: file.type }
    )

    let size: "1024x1024" | "1536x1024" | "1024x1536"
    if (ratio > 1.3) {
      size = "1536x1024"
    } else if (ratio < 0.77) {
      size = "1024x1536"
    } else {
      size = "1024x1024"
    }

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt,
      size,
      quality: "medium",
    })

    const imageData = response.data?.[0]
    if (!imageData) {
      return NextResponse.json({ error: "AI 未返回图片" }, { status: 500 })
    }

    if (imageData.b64_json) {
      const buf = Buffer.from(imageData.b64_json, "base64")
      return new NextResponse(new Uint8Array(buf), {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
      })
    }

    if (imageData.url) {
      const imgRes = await fetch(imageData.url)
      const buf = Buffer.from(await imgRes.arrayBuffer())
      return new NextResponse(new Uint8Array(buf), {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
      })
    }

    return NextResponse.json({ error: "无法获取图片数据" }, { status: 500 })
  } catch (err: unknown) {
    console.error("generate error:", err)
    const msg = err instanceof Error ? err.message : "AI 生成失败"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
