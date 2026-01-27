# Vercel 部署指南

## 前提条件

1. **GitHub 账号**
2. **Vercel 账号**（可以使用 GitHub 登录）
3. **本项目已推送到 GitHub**

## 部署步骤

### 1. 推送代码到 GitHub

```bash
# 初始化 Git 仓库（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: AI Image Editor"

# 连接到 GitHub 远程仓库
# ⚠️ 注意：创建仓库时选择 "Private" (私有) 即可不公开代码
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# 推送代码
git push -u origin main
```

### 2. 在 Vercel 导入项目

1. 访问 [Vercel](https://vercel.com)
2. 点击 **"Add New Project"** 或 **"Import Project"**
3. 选择 **"Import Git Repository"**
4. 选择你的 GitHub 仓库

### 3. 配置环境变量

在 Vercel 项目设置中添加环境变量：

1. 进入项目设置 → **Environment Variables**
2. 添加变量：
   - **Name**: `GEMINI_API_KEY`
   - **Value**: `AIzaSyCcpkwmPgOK82k5wRDOmNqsL6ahMZJzRPo`
   - **Environment**: 选择 `Production`, `Preview`, `Development`（全选）

### 4. 部署

1. 点击 **"Deploy"**
2. Vercel 会自动：
   - 检测项目配置（`vercel.json`）
   - 安装前端依赖
   - 构建前端
   - 部署后端 Serverless Functions
3. 等待部署完成

### 5. 访问应用

部署成功后，Vercel 会提供一个 URL，例如：
```
https://your-project.vercel.app
```

## 项目结构

```
图片预处理/
├── frontend/           # React 前端
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── backend/            # FastAPI 后端
│   ├── main.py
│   ├── requirements.txt
│   └── .env
├── api/                # Vercel Serverless Functions
│   └── index.py
└── vercel.json         # Vercel 配置
```

## 特性说明

### 本地存储
- ✓ 提示词自动保存到浏览器 localStorage
- ✓ 刷新页面后提示词仍然保留
- ✓ 无需注册登录

### AI 分析功能
- ✓ 使用 Gemini API Free Tier
- ✓ 图片智能分析（中文输出）
- ✓ 自动生成 JSON 格式数据

### 图片编辑工具
- ✓ 画笔、橡皮擦
- ✓ 形状工具（矩形、圆形、箭头）
- ✓ 文本工具
- ✓ 裁剪工具
- ✓ 多图层叠加

## 常见问题

### 1. API Key 安全性

⚠️ **重要提示**：
- `.env` 文件已添加到 `.gitignore`，不会上传到 GitHub
- 在 Vercel 中配置的环境变量是安全的
- 不要在前端代码中直接暴露 API Key

### 2. 免费额度

Gemini API Free Tier 限制：
- 每分钟 15 次请求
- 每天 1500 次请求
- 足够个人使用

### 3. 本地开发

```bash
# 前端
cd frontend
npm install
npm run dev

# 后端
cd backend
pip install -r requirements.txt
python main.py
```

## 支持

如有问题，请参考：
- [Vercel 文档](https://vercel.com/docs)
- [Gemini API 文档](https://ai.google.dev/docs)
