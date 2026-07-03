export interface BannerSize {
  id: string
  name: string
  platform: string
  width: number
  height: number
  cropBias?: "left" | "center" | "right" // 裁切偏好，默认 right
  forceRecommend?: "crop" | "ai" // 强制覆盖推荐逻辑
}

export const BANNER_SIZES: BannerSize[] = [
  // 学科网 / 研修网
  {
    id: "xueke_pc",
    name: "学科网 Banner PC",
    platform: "学科网",
    width: 642,
    height: 206,
    cropBias: "right",
  },
  {
    id: "yanxiu_pc",
    name: "研修 PC 端",
    platform: "学科网",
    width: 698,
    height: 308,
    cropBias: "right",
  },
  {
    id: "m_station",
    name: "M 站 Banner",
    platform: "学科网",
    width: 696,
    height: 226,
    cropBias: "right",
  },
  {
    id: "sub_station",
    name: "子站 Banner",
    platform: "学科网",
    width: 627,
    height: 201,
    cropBias: "right",
  },
  {
    id: "live_cover",
    name: "直播系统封面",
    platform: "学科网",
    width: 288,
    height: 180,
    cropBias: "center",
    forceRecommend: "ai", // 比例差异大且尺寸小，强制推荐 AI
  },
  {
    id: "social_banner",
    name: "新媒体推文 Banner",
    platform: "学科网",
    width: 900,
    height: 383,
    cropBias: "center",
  },
  {
    id: "sidebar",
    name: "矩形侧边栏",
    platform: "学科网",
    width: 80,
    height: 200,
    cropBias: "center",
    forceRecommend: "ai", // 极窄竖版，必须 AI 重新排版
  },
  // 小鹅通
  {
    id: "xiaoetong_live",
    name: "直播暖场",
    platform: "小鹅通",
    width: 750,
    height: 423,
    cropBias: "right",
  },
  {
    id: "xiaoetong_promo",
    name: "宣传 Banner",
    platform: "小鹅通",
    width: 750,
    height: 240,
    cropBias: "right",
  },
  {
    id: "xiaoetong_zhongzhi",
    name: "中职 Banner",
    platform: "小鹅通",
    width: 715,
    height: 260,
    cropBias: "right",
  },
]

export const PLATFORMS = [...new Set(BANNER_SIZES.map((b) => b.platform))]
