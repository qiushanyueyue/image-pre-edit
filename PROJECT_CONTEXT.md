# 项目上下文 (Project Context)

这份文档旨在帮助 AI 模型快速理解本项目结构、技术栈及运行方式。

## 1. 项目概述
本项目是一个**AI 辅助图片预处理与编辑工具**。它结合了基于 Canvas 的手动编辑功能和基于 Gemini Vision 的 AI 分析功能。
主要用途：上传图片，进行 AI 分析（获取场景、颜色、元素等信息），并提供画笔、形状、裁剪等工具进行手动标注或修改，最终导出分析结果和处理后的图片。

## 2. 技术栈

### 前端 (Frontend)
*   **框架**: React 19 + TypeScript
*   **构建工具**: Vite
*   **UI 库**: Tailwind CSS, Lucide React (图标)
*   **状态管理**: Zustand (带持久化存储 `persist`)
*   **Canvas 引擎**: Konva / React-Konva
*   **HTTP 客户端**: Fetch API (目前直接在组件或 Store 中调用)

### 后端 (Backend)
*   **框架**: FastAPI (Python 3.10+)
*   **服务器**: Uvicorn
*   **AI 模型**: Google Gemini Pro Vision (`google-generativeai`)
*   **图像处理**: Pillow (PIL), NumPy
*   **依赖管理**: `requirements.txt`

## 3. 项目结构
```text
/
├── backend/                # 后端代码
│   ├── main.py             # FastAPI 主程序入口 & API 定义
│   ├── requirements.txt    # Python 依赖
│   ├── .env                # 环境变量 (GEMINI_API_KEY)
│   └── uploads/            # 图片上传存储目录
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   │   ├── Canvas/     # 画布相关组件
│   │   │   ├── Panels/     # 左/右侧面板
│   │   │   └── Tools/      # 工具栏组件
│   │   ├── store/          # Zustand 状态管理 (useStore.ts)
│   │   ├── types/          # TypeScript 类型定义
│   │   ├── App.tsx         # 根组件
│   │   └── main.tsx        # 入口文件
│   ├── vite.config.ts      # Vite 配置 (端口 3333)
│   ├── tailwind.config.js  # Tailwind 配置
│   └── package.json        # Node 依赖
└── PROJECT_CONTEXT.md      # 本文件
```

## 4. 核心功能与逻辑

### 4.1 图片分析 (AI Analyze)
*   **入口**: 后端 `/api/ai-analyze`
*   **流程**: 
    1.  接收前端上传的图片。
    2.  调用 Google Gemini Vision API。
    3.  使用特定 Prompt 要求 AI 返回 JSON 格式数据（包含尺寸、场景、颜色、元素、细节、提示词）。
    4.  后端解析 Markdown 包裹的 JSON 并返回给前端。
*   **数据结构** (部分):
    ```json
    {
      "图片大小": {"宽": 1024, "高": 1024},
      "场景描述": "...",
      "颜色分析": ["#FF0000 红色", ...],
      "主要元素与位置": ["天空 (顶部)", ...],
      "建议提示词": ["..."]
    }
    ```

### 4.2 图片编辑
*   **核心库**: `react-konva`
*   **工具**: 
    *   `select` (选择)
    *   `brush` (画笔 - 支持颜色、大小、透明度)
    *   `eraser` (橡皮擦)
    *   `rect`/`circle`/`line`/`arrow` (形状)
    *   `crop` (裁剪)
*   **状态**: 所有编辑状态（元素列表、画笔设置、图片 URL）均存储在 Zustand Store 中，并自动持久化到 `localStorage` (`ai-image-editor-storage`)。

## 5. 环境配置与运行

### 后端
1.  进入 `backend` 目录。
2.  创建 `.env` 文件并填入 `GEMINI_API_KEY`。
3.  安装依赖: `pip install -r requirements.txt`
4.  运行: `uvicorn main:app --host 0.0.0.0 --port 8011 --reload`
    *   API 文档: `http://localhost:8011/docs`

### 前端
1.  进入 `frontend` 目录。
2.  安装依赖: `npm install`
3.  运行: `npm run dev`
    *   访问地址: `http://localhost:3333`

## 6. 注意事项与待优化
*   **跨域**: 后端已配置 CORS 允许所有来源 (`*`)。
*   **存储**: 图片目前存储在本地 `backend/uploads` 目录，通过静态文件服务 `StaticFiles` 提供访问。
*   **AI 限制**: 依赖 Gemini API，需确保网络通畅且 Key 有效。
*   **状态同步**: 前端 Zustand 持久化可能会导致刷新后保留旧的错误状态，开发调试时有时需要手动清除 LocalStorage。
