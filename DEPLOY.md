# Vercel 部署指南

## 方式一：Vercel CLI 部署（推荐）

### 1. 安装 Vercel CLI
```bash
npm i -g vercel
```

### 2. 登录 Vercel
```bash
vercel login
```
- 按提示在浏览器完成登录

### 3. 进入项目目录并部署
```bash
cd ~/Projects/banner-extend-tool
vercel --prod
```

### 4. 配置环境变量
在 Vercel Dashboard → 项目设置 → Environment Variables 中添加：
- `OPENAI_API_KEY`: 你的 API Key（不含 sk- 前缀）
- `OPENAI_BASE_URL`: https://api.aimindsky.com/v1

---

## 方式二：GitHub + Vercel 自动部署

### 1. 创建 GitHub 仓库
```bash
cd ~/Projects/banner-extend-tool
git init
git add .
git commit -m "Initial commit"
gh repo create banner-extend-tool --public --source=. --push
```

### 2. 在 Vercel 导入项目
1. 访问 https://vercel.com/new
2. 选择 GitHub 导入 banner-extend-tool
3. 配置环境变量（同上）
4. 点击 Deploy

---

## 部署后验证

1. 访问分配的域名（如 https://banner-extend-tool.vercel.app）
2. 上传一张 Banner 图测试生成
3. 如一切正常，分享给同事使用
